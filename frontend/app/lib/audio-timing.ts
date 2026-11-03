export type SoundCharacterTiming = { character: string; start_seconds: number; end_seconds: number };

/** Validate media-time intervals before using them as display offsets. Never estimate missing timing data. */
export function readAudioTimings(value: unknown): SoundCharacterTiming[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 2000) throw new Error("The audio timing response was invalid.");
  let previous = 0;
  return value.map(item => {
    if (!item || typeof item.character !== "string" || Array.from(item.character).length !== 1 ||
      /^[\uD800-\uDFFF]$/.test(item.character) ||
      typeof item.start_seconds !== "number" || !Number.isFinite(item.start_seconds) || item.start_seconds < previous ||
      typeof item.end_seconds !== "number" || !Number.isFinite(item.end_seconds) || item.end_seconds < item.start_seconds) {
      throw new Error("The audio timing response was invalid.");
    }
    previous = item.start_seconds;
    return { character: item.character, start_seconds: item.start_seconds, end_seconds: item.end_seconds };
  });
}

/** Return an original Unicode-scalar index. Audio.currentTime already accounts for playback speed and seeking. */
export function activeAudioCharacter(timings: SoundCharacterTiming[], mediaTime: number): number | null {
  if (!Number.isFinite(mediaTime) || mediaTime < 0) return null;
  let low = 0, high = timings.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (timings[middle].start_seconds <= mediaTime) low = middle + 1;
    else high = middle;
  }
  // Latest active start wins if provider intervals overlap. Zero-duration punctuation
  // and silent gaps must not keep an unrelated character lit.
  for (let index = low - 1; index >= 0; index--) {
    if (mediaTime < timings[index].end_seconds) return index;
  }
  return null;
}
