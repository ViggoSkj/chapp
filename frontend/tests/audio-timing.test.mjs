import test from "node:test";
import assert from "node:assert/strict";
import { activeAudioCharacter, readAudioTimings } from "../app/lib/audio-timing.ts";

const timings = [
  { character: "你", start_seconds: 0, end_seconds: 0.2 },
  { character: "你", start_seconds: 0.3, end_seconds: 0.6 },
  { character: "𠀀", start_seconds: 0.6, end_seconds: 0.9 },
  { character: "。", start_seconds: 1, end_seconds: 1 },
];
test("media-time lookup handles repeated Unicode scalars, gaps and exclusive interval ends", () => {
  const value = readAudioTimings(timings);
  assert.equal(activeAudioCharacter(value, 0), 0);
  assert.equal(activeAudioCharacter(value, 0.2), null);
  assert.equal(activeAudioCharacter(value, 0.35), 1);
  assert.equal(activeAudioCharacter(value, 0.6), 2);
  assert.equal(activeAudioCharacter(value, 0.9), null);
  assert.equal(activeAudioCharacter(value, 1), null);
  assert.equal(activeAudioCharacter(value, -1), null);
  assert.equal(activeAudioCharacter(value, NaN), null);
  assert.equal(value.map(item => item.character).join(""), "你你𠀀。");
});
test("missing timing capability never invents evenly spaced highlighting", () => {
  assert.deepEqual(readAudioTimings(undefined), []);
  assert.equal(activeAudioCharacter([], 0.4), null);
});
test("malformed or unordered timing payloads fail before audio starts", () => {
  for (const value of [null, {}, [{ character: "你好", start_seconds: 0, end_seconds: 1 }],
    [{ character: "\uD840", start_seconds: 0, end_seconds: 1 }],
    [{ character: "你", start_seconds: -1, end_seconds: 1 }],
    [{ character: "你", start_seconds: 1, end_seconds: 0 }],
    [{ character: "你", start_seconds: 0, end_seconds: Infinity }],
    [{ character: "你", start_seconds: 1, end_seconds: 2 }, { character: "好", start_seconds: 0, end_seconds: 1 }]]) {
    assert.throws(() => readAudioTimings(value), /timing response was invalid/);
  }
});
test("overlapping intervals choose the latest active start while zero-duration punctuation stays unlit", () => {
  const value = readAudioTimings([
    { character: "你", start_seconds: 0, end_seconds: 0.5 },
    { character: "好", start_seconds: 0.3, end_seconds: 0.7 },
    { character: "。", start_seconds: 0.3, end_seconds: 0.3 },
  ]);
  assert.equal(activeAudioCharacter(value, 0.4), 1);
});
