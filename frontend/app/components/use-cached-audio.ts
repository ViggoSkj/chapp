"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { prepareAudioPlayback } from "../lib/audio-warmup";
import { learningApi } from "../lib/learning-api";
import { activeAudioCharacter, readAudioTimings } from "../lib/audio-timing";

/** Plays cached audio and follows its actual media clock; navigation/stop invalidate pending audio and highlight work. */
export function useCachedAudio(contextKey: string) {
  const [playbackKey, setPlaybackKey] = useState(contextKey);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [highlight, setHighlight] = useState<{ key: string; text: string; index: number | null } | null>(null);
  const current = useRef<HTMLAudioElement | null>(null);
  const source = useRef<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const frame = useRef<number | null>(null);
  const cancelFrame = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  const dispose = useCallback(() => {
    sequence.current++;
    cancelFrame();
    request.current?.abort(); request.current = null;
    if (current.current) { current.current.pause(); current.current.src = ""; current.current = null; }
    if (source.current) { URL.revokeObjectURL(source.current); source.current = null; }
  }, [cancelFrame]);
  const stop = useCallback(() => {
    dispose(); setPlaying(false); setLoading(false); setHighlight(null);
  }, [dispose]);
  useEffect(() => () => stop(), [contextKey, stop]);

  async function play(path: string, body: unknown, rate = 1, onEnded?: () => void) {
    stop(); setPlaybackKey(contextKey); setLoading(true); setError("");
    const ticket = sequence.current;
    const controller = new AbortController(); request.current = controller;
    try {
      const sound = await learningApi<{ content_type: string; audio_data: string; timings?: unknown }>(path, body, controller.signal);
      if (ticket !== sequence.current) return false;
      if (!sound.content_type.startsWith("audio/")) throw new Error("The sound response was invalid.");
      const timings = readAudioTimings(sound.timings);
      const text = timings.map(timing => timing.character).join("");
      const bytes = Uint8Array.from(atob(sound.audio_data), value => value.charCodeAt(0));
      const prepared = await prepareAudioPlayback(bytes, sound.content_type);
      // Decoding is asynchronous too: stop/navigation/replay must invalidate it before creating media.
      if (ticket !== sequence.current) return false;
      const url = URL.createObjectURL(prepared.blob); source.current = url;
      const audio = new Audio(url); current.current = audio; audio.playbackRate = rate;
      const update = () => {
        if (ticket !== sequence.current) return;
        const index = audio.paused || audio.ended ? null : activeAudioCharacter(timings, audio.currentTime - prepared.leadInSeconds);
        setHighlight(previous => previous?.key === contextKey && previous.text === text && previous.index === index
          ? previous : { key: contextKey, text, index });
      };
      const tick = () => {
        frame.current = null;
        if (ticket !== sequence.current || audio.paused || audio.ended) return;
        update();
        frame.current = requestAnimationFrame(tick);
      };
      const resume = () => {
        if (ticket !== sequence.current) return;
        cancelFrame(); update(); frame.current = requestAnimationFrame(tick);
      };
      const suspend = () => {
        if (ticket !== sequence.current) return;
        cancelFrame();
        setHighlight({ key: contextKey, text, index: null });
      };
      audio.onplaying = resume;
      audio.onpause = suspend;
      audio.onwaiting = suspend;
      audio.onseeking = update;
      audio.onseeked = update;
      audio.ontimeupdate = update;
      audio.onended = () => { if (ticket === sequence.current) { stop(); onEnded?.(); } };
      audio.onerror = () => { if (ticket === sequence.current) { stop(); setError("Audio could not play. You can still read the explanation."); } };
      await audio.play();
      if (ticket === sequence.current) { setPlaying(true); setLoading(false); resume(); }
      return true;
    } catch (failure) {
      if (ticket === sequence.current && !controller.signal.aborted) {
        stop(); setError(failure instanceof Error ? failure.message : "Audio is unavailable.");
      }
      return false;
    }
  }
  // Context changes dispose media in effect cleanup; key guards also prevent
  // a stale highlight or playback label on the render that precedes cleanup.
  const active = highlight?.key === contextKey ? highlight : null;
  return { play, stop, playing: playing && playbackKey === contextKey,
    loading: loading && playbackKey === contextKey,
    error: playbackKey === contextKey ? error : "", activeCharacterIndex: active?.index ?? null, spokenText: active?.text ?? "" };
}
