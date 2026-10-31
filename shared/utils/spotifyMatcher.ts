export interface TrackInput {
  title: string;
  artist: string;
  album: string;
  durationMs: number;
}

export interface LookupSpotifyCanvasResponse {
  videoUrl: string | null;
  trackId: string | null;
  error?: boolean;
}

export interface SpotifyCandidate {
  id: string;
  title: string;
  artists: string[];
  album: string;
  durationMs: number;
}

export interface ScoredCandidate {
  candidate: SpotifyCandidate;
  score: number;
  titleSim: number;
  artistSim: number;
  durationDelta: number;
  versionConflict: boolean;
}

export type ResolveResult =
  | { kind: "matched"; track: ScoredCandidate }
  | { kind: "ambiguous"; candidates: ScoredCandidate[] }
  | { kind: "notFound" };

const MATCHER_CONFIG = {
  minScore: 82,
  minTitle: 0.78,
  minArtist: 0.55,
  maxDurationDelta: 8000,
  winnerMargin: 4,
  durationWindow: 15000,
  sameRecordingMs: 2000,
};

const VERSION_TERMS = new Set([
  "acoustic",
  "cover",
  "demo",
  "english",
  "inst",
  "japanese",
  "extended",
  "instrumental",
  "karaoke",
  "live",
  "mix",
  "remaster",
  "remastered",
  "remix",
  "slowed",
  "sped",
]);

const NOISE =
  /\s*[([【](?:[^)\]】]*\b(?:official|audio|video|lyrics?|visuali[sz]er|mv|hd|4k|hq|m\/v)\b[^)\]】]*)[)\]】]/gi;

export const normalize = (value: string | null | undefined): string =>
  (value ?? "")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");

const bigrams = (s: string): string[] => {
  if (s.length <= 1) return s ? [s] : [];
  const result: string[] = [];
  for (let i = 0; i < s.length - 1; i++) {
    result.push(s.slice(i, i + 2));
  }
  return result;
};

export const similarity = (a: string, b: string): number => {
  const l = normalize(a);
  const r = normalize(b);
  if (l === r) return 1;
  if (!l || !r) return 0;
  const lb = bigrams(l);
  const rb = bigrams(r);
  const pool = [...rb];
  let hit = 0;
  for (const g of lb) {
    const idx = pool.indexOf(g);
    if (idx >= 0) {
      hit++;
      pool.splice(idx, 1);
    }
  }
  return (2 * hit) / (lb.length + rb.length);
};

export const cleanTitle = (title: string, artist: string): string => {
  let t = title
    .replace(NOISE, " ")
    .replace(/\s+(?:ft|feat|featuring)\.?\s.*$/i, "")
    .trim();
  const dash = t.split(/\s+[-–—]\s+/);
  if (dash.length === 2 && similarity(dash[0], artist) >= 0.6) {
    t = dash[1];
  }
  return t.replace(/\s+/g, " ").trim();
};

export const buildSearchQueries = (track: TrackInput): string[] => {
  const clean = cleanTitle(track.title, track.artist);
  const rawQueries = [
    `${track.title} ${track.artist}`.trim(),
    track.album ? `${track.title} ${track.album}`.trim() : "",
    clean !== track.title ? `${clean} ${track.artist}`.trim() : "",
  ].filter(Boolean);
  return Array.from(new Set(rawQueries));
};

const titleParts = (t: string): string[] =>
  Array.from(new Set([t, ...t.split(/\s+[-–—|/]\s+|[／｜()[\]（）【】「」]/)].map(s => s.trim()))).filter(
    s => normalize(s) && !/^(feat|featuring|ft|with|prod)\b/.test(normalize(s))
  );

const splitArtists = (v: string): string[] =>
  Array.from(
    new Set([v, ...v.split(/\s+(?:feat(?:uring)?|ft|with|x)\.?\s+|\s+&\s+|[,;/]/i)].map(normalize).filter(Boolean))
  );

const artistSimilarity = (local: string, remote: string[]): number => {
  const lp = splitArtists(local);
  const rp = remote.flatMap(splitArtists);
  if (!lp.length || !rp.length) return 0;
  return Math.max(...lp.map(l => Math.max(...rp.map(r => similarity(l, r)))));
};

const versionTerms = (v: string): string =>
  Array.from(
    new Set(
      normalize(v)
        .split(" ")
        .filter(t => VERSION_TERMS.has(t))
    )
  )
    .sort()
    .join(",");

export const score = (src: TrackInput, candidate: SpotifyCandidate): ScoredCandidate => {
  const lp = titleParts(src.title);
  const rp = titleParts(candidate.title);
  const titleSim = lp.length && rp.length ? Math.max(...lp.map(l => Math.max(...rp.map(r => similarity(l, r))))) : 0;
  const unexplained = rp.slice(1).filter(r => !lp.some(l => similarity(l, r) >= 0.5)).length;
  const artistSim = artistSimilarity(src.artist, candidate.artists);
  const durationDelta = src.durationMs > 0 ? Math.abs(src.durationMs - candidate.durationMs) : 0;
  const durationScore = Math.max(0, 1 - durationDelta / MATCHER_CONFIG.durationWindow);
  const versionConflict = versionTerms(src.title) !== versionTerms(candidate.title);
  const weighted = 100 * (titleSim * 0.55 + artistSim * 0.3 + durationScore * 0.15);
  const finalScore = Math.round(weighted - (versionConflict ? 18 : 0) - 10 * unexplained);
  return {
    candidate,
    score: Math.min(100, Math.max(0, finalScore)),
    titleSim,
    artistSim,
    durationDelta,
    versionConflict,
  };
};

const isPlausible = (t: ScoredCandidate): boolean =>
  t.score >= MATCHER_CONFIG.minScore &&
  t.titleSim >= MATCHER_CONFIG.minTitle &&
  t.artistSim >= MATCHER_CONFIG.minArtist &&
  t.durationDelta <= MATCHER_CONFIG.maxDurationDelta &&
  !t.versionConflict;

const isSameRecording = (a: SpotifyCandidate, b: SpotifyCandidate): boolean => {
  const ta = new Set(titleParts(a.title).map(normalize));
  const aa = new Set(a.artists.map(normalize));
  return (
    titleParts(b.title).some(t => ta.has(normalize(t))) &&
    b.artists.some(x => aa.has(normalize(x))) &&
    Math.abs(a.durationMs - b.durationMs) <= MATCHER_CONFIG.sameRecordingMs
  );
};

export const resolve = (src: TrackInput, candidates: SpotifyCandidate[]): ResolveResult => {
  const seen = new Set<string>();
  const ranked = candidates
    .filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    })
    .map(c => score(src, c))
    .filter(isPlausible)
    .sort(
      (a, b) => b.score - a.score || a.durationDelta - b.durationDelta || (a.candidate.id < b.candidate.id ? -1 : 1)
    );

  let winner = ranked[0];
  if (!winner) return { kind: "notFound" };

  const runner = ranked[1];
  if (runner && winner.score - runner.score < MATCHER_CONFIG.winnerMargin) {
    const tied = ranked.filter(t => winner.score - t.score < MATCHER_CONFIG.winnerMargin);
    const album = normalize(src.album);
    const albumMatches = album ? tied.filter(t => normalize(t.candidate.album) === album) : [];
    if (albumMatches.length === 1) {
      winner = albumMatches[0];
    } else if (!tied.every(t => isSameRecording(winner.candidate, t.candidate))) {
      return { kind: "ambiguous", candidates: ranked.slice(0, 5) };
    }
  }

  return { kind: "matched", track: winner };
};
