"use client";

import { useEffect, useRef } from "react";

/** Measures visible time for the current exercise presentation using a monotonic browser clock. */
export function useExerciseTimer(presentation: object | null, active: boolean) {
  const clock = useRef<{ presentation: object | null; elapsed: number; started: number | null }>({
    presentation: null, elapsed: 0, started: null,
  });

  useEffect(() => {
    if (clock.current.presentation !== presentation) {
      clock.current = { presentation, elapsed: 0, started: null };
    }
    const session = clock.current;
    function pause() {
      if (session.started === null) return;
      session.elapsed += performance.now() - session.started;
      session.started = null;
    }
    function synchronize() {
      if (presentation && active && !document.hidden) {
        session.started ??= performance.now();
      } else {
        pause();
      }
    }
    synchronize();
    document.addEventListener("visibilitychange", synchronize);
    return () => {
      document.removeEventListener("visibilitychange", synchronize);
      pause();
    };
  }, [presentation, active]);

  return function elapsedMilliseconds() {
    const session = clock.current;
    if (!presentation || session.presentation !== presentation) return undefined;
    const running = session.started === null ? 0 : performance.now() - session.started;
    return Math.min(3_600_000, Math.round(session.elapsed + running));
  };
}
