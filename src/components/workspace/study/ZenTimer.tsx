import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Radio, Waves, Wind, CloudRain, Flame, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatDuration, useResilientTimer } from "@/components/workspace/study/useResilientTimer";
import type { StudySession } from "@/components/workspace/study/types";

type AmbientTrack = "rain" | "campfire" | "wind" | "ocean" | "quran";

const TRACKS: Array<{
  id: AmbientTrack;
  label: string;
  icon: ComponentType<{ className?: string }>;
  src: string;
}> = [
  { id: "rain", label: "Rain", icon: CloudRain, src: "/sounds/rain.mp3" },
  { id: "campfire", label: "Campfire", icon: Flame, src: "/sounds/campfire.mp3" },
  { id: "wind", label: "Wind", icon: Wind, src: "/sounds/wind.mp3" },
  { id: "ocean", label: "Ocean", icon: Waves, src: "/sounds/ocean.mp3" },
  { id: "quran", label: "إذاعة القرآن", icon: Radio, src: "/sounds/quran-radio.mp3" },
];

export function ZenTimer({
  session,
  onEndSession,
  onSessionComplete,
}: {
  session: StudySession;
  onEndSession: () => void;
  onSessionComplete: () => void;
}) {
  const [completedVisible, setCompletedVisible] = useState(false);
  const [volume, setVolume] = useState(0.15);
  const [selectedTrack, setSelectedTrack] = useState<AmbientTrack | null>(null);
  const audioRefs = useRef<Record<AmbientTrack, HTMLAudioElement | null>>({
    rain: null,
    campfire: null,
    wind: null,
    ocean: null,
    quran: null,
  });

  const { remainingMs, progress } = useResilientTimer({
    startTime: session.startTimeMs,
    targetDuration: session.targetDurationMs,
    onComplete: () => {
      setCompletedVisible(true);
      onSessionComplete();
    },
  });

  useEffect(() => {
    Object.values(audioRefs.current).forEach((audio) => {
      if (audio) audio.volume = volume;
    });
  }, [volume]);

  useEffect(() => {
    Object.entries(audioRefs.current).forEach(([key, audio]) => {
      if (!audio) return;
      if (selectedTrack === key) {
        void audio.play().catch(() => null);
      } else {
        audio.pause();
        audio.currentTime = 0;
      }
    });
  }, [selectedTrack]);

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 28 }).map((_, index) => ({
        id: index,
        left: `${(index * 13) % 100}%`,
        delay: `${(index * 90) % 1000}ms`,
      })),
    []
  );

  return (
    <section dir="rtl" className="relative min-h-[540px] overflow-hidden rounded-3xl border border-[#354c96] bg-[linear-gradient(135deg,#0f1f45_0%,#1b2b63_50%,#36205c_100%)] p-6 text-white shadow-hard">
      <div className="pointer-events-none absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,.14),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(192,132,252,.12),transparent_35%)]" />

      {completedVisible ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {confettiPieces.map((piece) => (
            <span
              key={piece.id}
              className="absolute top-4 h-2 w-2 rounded-sm bg-amber-300 opacity-80 animate-ping"
              style={{ left: piece.left, animationDelay: piece.delay }}
            />
          ))}
        </div>
      ) : null}

      <div className="relative flex items-start justify-between">
        <p className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-bold">
          وضع التركيز
        </p>
        <Button variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/20" onClick={onEndSession}>
          <X className="ml-1 h-4 w-4" />
          إنهاء الجلسة
        </Button>
      </div>

      <div className="relative mt-12 text-center">
        <p className="text-sm text-white/80">المهمة النشطة</p>
        <h3 className="mt-1 text-2xl font-black">{session.taskTitle}</h3>
        <p className="mt-5 text-7xl font-black tracking-tight">{formatDuration(remainingMs)}</p>
        <p className="mt-3 text-sm text-white/80">التقدم: {progress}%</p>
      </div>

      {completedVisible ? (
        <div className="relative mx-auto mt-8 max-w-xl rounded-2xl border border-emerald-300/40 bg-emerald-400/10 p-4 text-center">
          <p className="text-lg font-black">عاش! ضفت {session.plannedMinutes} دقيقة لرصيد تركيزك النهاردة</p>
        </div>
      ) : null}

      <footer className="relative mt-10 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          {TRACKS.map((track) => {
            const Icon = track.icon;
            const active = selectedTrack === track.id;
            return (
              <button
                key={track.id}
                type="button"
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? "border-amber-300 bg-amber-300/20 text-amber-100"
                    : "border-white/20 bg-white/5 text-white/85 hover:bg-white/15"
                }`}
                onClick={() => setSelectedTrack((prev) => (prev === track.id ? null : track.id))}
              >
                <Icon className="h-3.5 w-3.5" />
                {track.label}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Volume2 className="h-4 w-4 text-white/80" />
          <Slider
            value={[Math.round(volume * 100)]}
            max={100}
            step={1}
            className="max-w-40"
            onValueChange={(value) => setVolume((value[0] ?? 15) / 100)}
          />
          <span className="text-xs text-white/70">{Math.round(volume * 100)}%</span>
        </div>
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
        />
      ))}
    </section>
  );
}
