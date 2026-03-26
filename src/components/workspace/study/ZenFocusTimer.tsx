import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { CloudRain, Coffee, Flame, Pause, Play, Radio, SkipForward, Volume2, Waves, Wind, X } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { formatDuration, useResilientTimer } from "@/components/workspace/study/useResilientTimer";
import type { AmbientTrackId, StudySession } from "@/components/workspace/study/types";

type TimerPhase = "focus" | "shortBreak" | "longBreak";

type TrackConfig = {
  id: AmbientTrackId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  src: string;
};

const TRACKS: TrackConfig[] = [
  { id: "rain", label: "مطر", icon: CloudRain, src: "/sounds/rain.mp3" },
  { id: "campfire", label: "نار هادئة", icon: Flame, src: "/sounds/campfire.mp3" },
  { id: "wind", label: "رياح", icon: Wind, src: "/sounds/wind.mp3" },
  { id: "ocean", label: "أمواج", icon: Waves, src: "/sounds/ocean.mp3" },
  { id: "quran", label: "إذاعة القرآن", icon: Radio, src: "/sounds/quran-radio.mp3" },
];

const SHORT_BREAK_MS = 5 * 60_000;
const LONG_BREAK_MS = 15 * 60_000;

export function ZenFocusTimer({
  session,
  onEndSession,
  onSessionComplete,
}: {
  session: StudySession;
  onEndSession: () => void;
  onSessionComplete: () => void;
}) {
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<AmbientTrackId | null>(null);
  const [volume, setVolume] = useState(0.15);
  const [showVolume, setShowVolume] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [phase, setPhase] = useState<TimerPhase>("focus");
  const [focusRounds, setFocusRounds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [pausedRemainingMs, setPausedRemainingMs] = useState<number | null>(null);
  const [timerState, setTimerState] = useState(() => ({
    startTime: session.startTimeMs,
    targetDuration: session.targetDurationMs,
  }));
  const audioRefs = useRef<Record<AmbientTrackId, HTMLAudioElement | null>>({
    rain: null,
    campfire: null,
    wind: null,
    ocean: null,
    quran: null,
  });

  const startPhase = (nextPhase: TimerPhase, durationMs: number) => {
    setPhase(nextPhase);
    setIsPaused(false);
    setPausedRemainingMs(null);
    setTimerState({ startTime: Date.now(), targetDuration: durationMs });
  };

  const { remainingMs, progress } = useResilientTimer({
    startTime: timerState.startTime,
    targetDuration: timerState.targetDuration,
    enabled: !isPaused,
    onComplete: () => {
      if (phase === "focus") {
        setShowSuccess(true);
        setFocusRounds((prev) => {
          const next = prev + 1;
          const isLongBreakRound = next % 4 === 0;
          startPhase(isLongBreakRound ? "longBreak" : "shortBreak", isLongBreakRound ? LONG_BREAK_MS : SHORT_BREAK_MS);
          return next;
        });
        onSessionComplete();
        return;
      }
      startPhase("focus", session.targetDurationMs);
    },
  });

  useEffect(() => {
    if (!showSuccess) return;
    const t = window.setTimeout(() => setShowSuccess(false), 2600);
    return () => window.clearTimeout(t);
  }, [showSuccess]);

  useEffect(() => {
    Object.values(audioRefs.current).forEach((audio) => {
      if (audio) audio.volume = volume;
    });
  }, [volume]);

  useEffect(() => {
    return () => {
      Object.values(audioRefs.current).forEach((audio) => {
        if (!audio) return;
        audio.pause();
        audio.currentTime = 0;
      });
    };
  }, []);

  const activateTrack = async (trackId: AmbientTrackId | null) => {
    setAudioError("");
    Object.entries(audioRefs.current).forEach(([key, audio]) => {
      if (!audio || key === trackId) return;
      audio.pause();
      audio.currentTime = 0;
    });

    if (!trackId) {
      setSelectedTrack(null);
      return;
    }

    const target = audioRefs.current[trackId];
    if (!target) {
      setSelectedTrack(trackId);
      setAudioError("ملف الصوت غير متاح حالياً.");
      return;
    }

    try {
      target.volume = volume;
      await target.play();
      setSelectedTrack(trackId);
    } catch {
      setSelectedTrack(trackId);
      setAudioError("المتصفح منع التشغيل التلقائي أو ملف الصوت غير موجود.");
    }
  };

  const phaseLabel = phase === "focus" ? "تركيز" : phase === "shortBreak" ? "استراحة قصيرة" : "استراحة طويلة";
  const phaseHint = phase === "focus" ? session.taskTitle : "خد نفس وارجع أقوى";
  const uiProgress = isPaused && pausedRemainingMs !== null
    ? Math.min(100, Math.round(((timerState.targetDuration - pausedRemainingMs) / timerState.targetDuration) * 100))
    : progress;
  const uiRemaining = isPaused && pausedRemainingMs !== null ? pausedRemainingMs : remainingMs;

  const togglePause = () => {
    if (!isPaused) {
      setPausedRemainingMs(uiRemaining);
      setIsPaused(true);
      return;
    }
    const restartRemaining = pausedRemainingMs ?? uiRemaining;
    setTimerState({ startTime: Date.now(), targetDuration: restartRemaining });
    setPausedRemainingMs(null);
    setIsPaused(false);
  };

  const skipPhase = () => {
    if (phase === "focus") {
      startPhase("shortBreak", SHORT_BREAK_MS);
      return;
    }
    startPhase("focus", session.targetDurationMs);
  };

  return (
    <section
      dir="rtl"
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8 text-white shadow-hard"
    >
      <div className="pointer-events-none absolute inset-0 animate-[pulse_10s_ease-in-out_infinite] bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,.18),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(129,140,248,.2),transparent_38%)]" />

      <div className="relative flex items-center justify-between">
        <span className="rounded-full bg-white/10 px-4 py-2 text-sm">{phaseLabel}</span>
        <button
          type="button"
          onClick={onEndSession}
          className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm transition hover:bg-white/20"
        >
          <X className="h-4 w-4" />
          إنهاء الجلسة
        </button>
      </div>

      <div className="relative mt-6 flex items-center justify-center gap-3">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-full ${
              i < (focusRounds % 4) ? "bg-emerald-300" : "bg-white/20"
            }`}
          />
        ))}
      </div>

      <div className="relative my-10 flex flex-col items-center justify-center text-center">
        <p className="mb-2 text-sm text-slate-300">{phase === "focus" ? "المهمة النشطة" : "الوضع الحالي"}</p>
        <h2 className="mb-6 text-2xl font-bold">{phaseHint}</h2>
        <p className="mb-4 text-7xl font-extrabold tracking-widest sm:text-8xl">{formatDuration(uiRemaining)}</p>
        <p className="text-sm text-slate-300">التقدم: {uiProgress}%</p>
      </div>

      {showSuccess ? (
        <div className="relative mb-4 rounded-2xl border border-emerald-200/35 bg-emerald-300/10 p-3 text-center">
          <p className="font-semibold">عاش! ضفت {session.plannedMinutes} دقيقة لرصيد تركيزك النهاردة</p>
        </div>
      ) : null}

      <div className="relative mb-4 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={togglePause}
          className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm transition hover:bg-white/20"
        >
          {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          {isPaused ? "استكمال" : "إيقاف مؤقت"}
        </button>
        <button
          type="button"
          onClick={skipPhase}
          className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm transition hover:bg-white/20"
        >
          <SkipForward className="h-4 w-4" />
          تخطي المرحلة
        </button>
        {phase !== "focus" ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm">
            <Coffee className="h-4 w-4" />
            استراحة
          </span>
        ) : null}
      </div>

      <footer className="relative rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {TRACKS.map((track) => {
            const Icon = track.icon;
            const active = selectedTrack === track.id;
            return (
              <button
                key={track.id}
                type="button"
                onClick={() => activateTrack(selectedTrack === track.id ? null : track.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                  active
                    ? "border-amber-300 text-amber-300"
                    : "border-white/20 text-slate-200 hover:border-white/40 hover:bg-white/10"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {track.label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowVolume((prev) => !prev)}
            className="rounded-full border border-white/20 bg-white/5 p-2 text-slate-200 transition hover:bg-white/10"
            aria-label="التحكم في الصوت"
          >
            <Volume2 className="h-4 w-4" />
          </button>
          <div
            className={`flex items-center gap-2 overflow-hidden transition-all ${
              showVolume ? "max-w-56 opacity-100" : "max-w-0 opacity-0"
            }`}
          >
            <Slider
              value={[Math.round(volume * 100)]}
              max={100}
              step={1}
              className="w-28"
              onValueChange={(value) => setVolume((value[0] ?? 15) / 100)}
            />
            <span className="text-xs text-slate-300">{Math.round(volume * 100)}%</span>
          </div>
        </div>
        {audioError ? <p className="mt-2 text-right text-xs text-amber-200">{audioError}</p> : null}
      </footer>

      {TRACKS.map((track) => (
        <audio
          key={track.id}
          ref={(node) => {
            audioRefs.current[track.id] = node;
          }}
          src={track.src}
          loop
          preload="none"
          onError={() => setAudioError("ملف الصوت غير موجود في public/sounds.")}
        />
      ))}
    </section>
  );
}
