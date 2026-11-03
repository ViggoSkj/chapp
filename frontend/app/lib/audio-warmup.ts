/** One continuous media stream gives the output device time to wake before the first syllable. */
export const AUDIO_LEAD_IN_SECONDS = 0.6;

type DecodedAudio = Pick<AudioBuffer, "sampleRate" | "length" | "numberOfChannels" | "getChannelData">;

/** Encode decoded speech after a silent PCM prefix. Original samples and stored provider timestamps are not edited. */
export function audioWithLeadIn(audio: DecodedAudio): { data: ArrayBuffer; leadInSeconds: number } {
  const { sampleRate, length, numberOfChannels: channels } = audio;
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000 ||
    !Number.isInteger(length) || length <= 0 || length > sampleRate * 120 ||
    !Number.isInteger(channels) || channels < 1 || channels > 2) throw new Error("Unsupported decoded audio.");
  const leadFrames = Math.ceil(sampleRate * AUDIO_LEAD_IN_SECONDS);
  const dataSize = (leadFrames + length) * channels * 2;
  const data = new ArrayBuffer(44 + dataSize);
  const view = new DataView(data);
  const label = (offset: number, text: string) => Array.from(text).forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  label(0, "RIFF"); view.setUint32(4, 36 + dataSize, true); label(8, "WAVE");
  label(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true); label(36, "data"); view.setUint32(40, dataSize, true);
  // ArrayBuffer starts zero-filled: do not fade, trim or overwrite the opening speech samples.
  for (let channel = 0; channel < channels; channel++) {
    const samples = audio.getChannelData(channel);
    for (let frame = 0; frame < length; frame++) {
      const sample = Math.max(-1, Math.min(1, samples[frame]));
      view.setInt16(44 + ((leadFrames + frame) * channels + channel) * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
    }
  }
  return { data, leadInSeconds: leadFrames / sampleRate };
}

/** Prepare local playback only; cached MP3 bytes/timings remain reusable. Unsupported decoders retain original playback and its original clock. */
export async function prepareAudioPlayback(bytes: Uint8Array, contentType: string): Promise<{ blob: Blob; leadInSeconds: number }> {
  try {
    if (typeof OfflineAudioContext !== "function") throw new Error("Audio decoding unavailable.");
    const context = new OfflineAudioContext(1, 1, 44100);
    const decoded = await context.decodeAudioData(bytes.slice().buffer);
    const padded = audioWithLeadIn(decoded);
    return { blob: new Blob([padded.data], { type: "audio/wav" }), leadInSeconds: padded.leadInSeconds };
  } catch {
    // Keep the original path usable on browsers without this decoding capability.
    return { blob: new Blob([bytes.slice().buffer], { type: contentType }), leadInSeconds: 0 };
  }
}
