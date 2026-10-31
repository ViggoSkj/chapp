"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { learningApi } from "../lib/learning-api";

/** Plays authenticated database-cached audio and discards responses after navigation or stop. */
export function useCachedAudio(contextKey: string) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const current = useRef<HTMLAudioElement | null>(null);
  const source = useRef<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const dispose = useCallback(() => {
    sequence.current++;
    request.current?.abort(); request.current = null;
    if (current.current) { current.current.pause(); current.current.src = ""; current.current = null; }
    if (source.current) { URL.revokeObjectURL(source.current); source.current = null; }
  }, []);
  const stop = useCallback(() => { dispose(); setPlaying(false); setLoading(false); }, [dispose]);
  useEffect(() => () => dispose(), [contextKey, dispose]);

  async function play(path: string, body: unknown, rate = 1, onEnded?: () => void) {
    stop(); setLoading(true); setError("");
    const ticket = sequence.current;
    const controller = new AbortController(); request.current = controller;
    try {
      const sound = await learningApi<{ content_type: string; audio_data: string }>(path, body, controller.signal);
      if (ticket !== sequence.current) return false;
      if (!sound.content_type.startsWith("audio/")) throw new Error("The sound response was invalid.");
      const bytes = Uint8Array.from(atob(sound.audio_data), value => value.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: sound.content_type })); source.current = url;
      const audio = new Audio(url); current.current = audio; audio.playbackRate = rate;
      audio.onended = () => { if (ticket === sequence.current) { stop(); onEnded?.(); } };
      audio.onerror = () => { if (ticket === sequence.current) { stop(); setError("Audio could not play. You can still read the explanation."); } };
      await audio.play();
      if (ticket === sequence.current) { setPlaying(true); setLoading(false); }
      return true;
    } catch (failure) {
      if (ticket === sequence.current && !controller.signal.aborted) {
        stop(); setError(failure instanceof Error ? failure.message : "Audio is unavailable.");
      }
      return false;
    }
  }
  return { play, stop, playing, loading, error };
}
