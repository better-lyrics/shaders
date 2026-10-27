import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const { outputText } = ts.transpileModule(
  readFileSync(new URL("../contents/lib/bassOnset.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }
);
const { createBassOnsetDetector } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

const FRAME_MS = 16;
const THRESHOLD = 0.75;

const settle = (detector, energy, frames = 120) => {
  let time = 0;
  for (let frame = 0; frame < frames; frame++) {
    detector.update(energy, time, THRESHOLD);
    time += FRAME_MS;
  }
  return time;
};

test("steady bass never pulses", () => {
  const detector = createBassOnsetDetector();
  let time = 0;
  for (let frame = 0; frame < 200; frame++) {
    assert.equal(detector.update(1, time, THRESHOLD), 0);
    time += FRAME_MS;
  }
});

test("a kick above the rolling average pulses, then decays to zero", () => {
  const detector = createBassOnsetDetector();
  const time = settle(detector, 1);
  const kick = detector.update(4, time, THRESHOLD);
  assert.ok(kick > 0.9);
  let pulse = kick;
  for (let frame = 1; frame <= 60; frame++) pulse = detector.update(1, time + frame * FRAME_MS, THRESHOLD);
  assert.equal(pulse, 0);
});

test("pulse strength follows kick strength", () => {
  const soft = createBassOnsetDetector();
  const hard = createBassOnsetDetector();
  const time = settle(soft, 1);
  settle(hard, 1);
  assert.ok(soft.update(2, time, THRESHOLD) < hard.update(3, time, THRESHOLD));
});

test("small bumps below the threshold ratio do not pulse", () => {
  const detector = createBassOnsetDetector();
  const time = settle(detector, 1);
  assert.equal(detector.update(1.5, time, THRESHOLD), 0);
});

test("volume does not change the pulse", () => {
  const quiet = createBassOnsetDetector();
  const loud = createBassOnsetDetector();
  const time = settle(quiet, 0.01);
  settle(loud, 1);
  assert.equal(quiet.update(0.03, time, THRESHOLD), loud.update(3, time, THRESHOLD));
});

test("refractory window stops one kick from firing twice", () => {
  const detector = createBassOnsetDetector();
  const time = settle(detector, 1);
  const first = detector.update(2.5, time, THRESHOLD);
  const second = detector.update(5, time + FRAME_MS, THRESHOLD);
  assert.ok(second < first);
});

test("silence after reset does not pulse", () => {
  const detector = createBassOnsetDetector();
  settle(detector, 1);
  detector.reset();
  assert.equal(detector.update(0, 0, THRESHOLD), 0);
  assert.equal(detector.update(5, FRAME_MS, THRESHOLD), 0);
});
