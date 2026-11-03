import test from "node:test";
import assert from "node:assert/strict";
import { audioWithLeadIn, AUDIO_LEAD_IN_SECONDS, prepareAudioPlayback } from "../app/lib/audio-warmup.ts";

test("silent lead-in preserves the first sample and stereo channel order without accumulating on replay", () => {
  const channels = [new Float32Array([.5, -.5, 1]), new Float32Array([-.25, .25, -1])];
  const audio = { sampleRate: 8000, length: 3, numberOfChannels: 2, getChannelData: channel => channels[channel] };
  const first = audioWithLeadIn(audio);
  const view = new DataView(first.data);
  const speechStart = 44 + 8000 * AUDIO_LEAD_IN_SECONDS * 4;
  assert.equal(new TextDecoder().decode(first.data.slice(0, 4)), "RIFF");
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 8000);
  assert.equal(first.leadInSeconds, .6);
  assert.ok(new Uint8Array(first.data, 44, speechStart - 44).every(value => value === 0));
  assert.equal(view.getInt16(speechStart, true), 16384);
  assert.equal(view.getInt16(speechStart + 2, true), -8192);
  assert.equal(view.getInt16(speechStart + 4, true), -16384);
  assert.equal(view.getInt16(speechStart + 10, true), -32768);
  assert.deepEqual(audioWithLeadIn(audio).data, first.data);
  assert.equal(channels[0][0], .5);
});

test("unsupported decoding preserves the original media and zero timestamp offset", async () => {
  const bytes = new Uint8Array([73, 68, 51, 1]);
  const result = await prepareAudioPlayback(bytes, "audio/mpeg");
  assert.equal(result.leadInSeconds, 0);
  assert.equal(result.blob.type, "audio/mpeg");
  assert.deepEqual(new Uint8Array(await result.blob.arrayBuffer()), bytes);
});

test("unreasonable decoded duration/channel counts are refused before allocation", () => {
  for (const invalid of [{ length: 8000 * 121 }, { numberOfChannels: 20 }, { sampleRate: Infinity }]) {
    assert.throws(() => audioWithLeadIn({ sampleRate: 8000, length: 1, numberOfChannels: 1, getChannelData: () => new Float32Array(1), ...invalid }), /Unsupported/);
  }
});
