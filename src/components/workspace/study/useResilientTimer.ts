import { useEffect, useMemo, useRef, useState } from "react";

type UseResilientTimerArgs = {
  startTime: number;
  targetDuration: number;
  enabled?: boolean;
  onComplete?: () => void;
};

export function useResilientTimer({
  startTime,
  targetDuration,
  enabled = true,
  onComplete,
}: UseResilientTimerArgs) {
  const [now, setNow] = useState(() => Date.now());
  const completedRef = useRef(false);

  useEffect(() => {
    completedRef.current = false;
    if (!enabled) {
      setNow(Date.now());
      return;
    }
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [startTime, targetDuration, enabled]);

  const elapsedMs = Math.max(0, now - startTime);
  const remainingMs = Math.max(0, targetDuration - elapsedMs);
  const isCompleted = remainingMs <= 0;

  useEffect(() => {
    if (!enabled) return;
    if (!isCompleted || completedRef.current) return;
    completedRef.current = true;
    onComplete?.();
  }, [isCompleted, enabled, onComplete]);

  const progress = useMemo(() => {
    if (targetDuration <= 0) return 100;
    return Math.min(100, Math.round((elapsedMs / targetDuration) * 100));
  }, [elapsedMs, targetDuration]);

  return { elapsedMs, remainingMs, isCompleted, progress };
}

export function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
