import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

async function load(path) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const { cleanTitle, buildSearchQueries, resolve, score, normalize } = await load("../shared/utils/spotifyMatcher.ts");

test("cleanTitle strips official video/audio noise, feat suffixes, and redundant artist prefixes", () => {
  assert.equal(cleanTitle("Daft Punk - Get Lucky (Official Audio) ft. Pharrell Williams", "Daft Punk"), "Get Lucky");
  assert.equal(cleanTitle("Guess (Official Music Video) [4K]", "Charli xcx"), "Guess");
});

test("buildSearchQueries generates deduplicated primary, album, and cleaned queries", () => {
  const queries = buildSearchQueries({
    title: "Get Lucky (Official Audio)",
    artist: "Daft Punk",
    album: "Random Access Memories",
    durationMs: 248000,
  });
  assert.deepEqual(queries, [
    "Get Lucky (Official Audio) Daft Punk",
    "Get Lucky (Official Audio) Random Access Memories",
    "Get Lucky Daft Punk",
  ]);
});

test("resolve matches the exact track and rejects remix/live version conflicts", () => {
  const source = {
    title: "Levitating",
    artist: "Dua Lipa",
    album: "Future Nostalgia",
    durationMs: 203000,
  };

  const candidates = [
    {
      id: "remix12345678901234567",
      title: "Levitating (The Blessed Madonna Remix)",
      artists: ["Dua Lipa", "The Blessed Madonna"],
      album: "Club Future Nostalgia",
      durationMs: 203000,
    },
    {
      id: "orig123456789012345678",
      title: "Levitating",
      artists: ["Dua Lipa"],
      album: "Future Nostalgia",
      durationMs: 203064,
    },
  ];

  const result = resolve(source, candidates);
  assert.equal(result.kind, "matched");
  assert.equal(result.track.candidate.id, "orig123456789012345678");
});

test("resolve breaks close ties using the album name when available", () => {
  const source = {
    title: "Guess featuring billie eilish",
    artist: "Charli xcx",
    album: "Brat and it's completely different but also still brat",
    durationMs: 145000,
  };

  const candidates = [
    {
      id: "single1234567890123456",
      title: "Guess featuring billie eilish",
      artists: ["Charli xcx", "Billie Eilish"],
      album: "Guess featuring billie eilish",
      durationMs: 145219,
    },
    {
      id: "album12345678901234567",
      title: "Guess featuring billie eilish",
      artists: ["Charli xcx", "Billie Eilish"],
      album: "Brat and it's completely different but also still brat",
      durationMs: 145219,
    },
  ];

  const result = resolve(source, candidates);
  assert.equal(result.kind, "matched");
  assert.equal(result.track.candidate.id, "album12345678901234567");
  assert.equal(normalize("Charli & Billie"), "charli and billie");
  assert.ok(score(source, candidates[1]).score >= 82);
});
