import { useMemo, useState } from "react";
import { Clock3, Flame, ListChecks, Mic, MicOff, Plus, Timer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ZenFocusTimer } from "@/components/workspace/study/ZenFocusTimer";
import { useSpeechToText } from "@/components/workspace/study/useSpeechToText";
import { useStudyState } from "@/components/workspace/study/useStudyState";
import type { StudyTaskDifficulty } from "@/components/workspace/study/types";

type StudyView = "tasks" | "pomodoro";

const DIFFICULTIES: Array<{
  id: StudyTaskDifficulty;
  label: string;
  subtitle: string;
  dotClass: string;
}> = [
  { id: "easy", label: "سهل", subtitle: "تهيئة 5-10 دقائق", dotClass: "bg-emerald-400" },
  { id: "medium", label: "متوسط", subtitle: "مهمة قياسية", dotClass: "bg-amber-400" },
  { id: "hard", label: "صعب", subtitle: "جلسة ثقيلة", dotClass: "bg-red-500" },
];

export function StudyWorkspace({
  onSessionCompleted,
  initialView,
  onSessionStarted,
}: {
  onSessionCompleted?: (minutes: number) => void;
  initialView?: StudyView;
  onSessionStarted?: () => void;
}) {
  const {
    tasks,
    focusMinutesToday,
    activeSession,
    addTask,
    removeTask,
    startSession,
    startWarmup,
    endSession,
    completeSession,
  } = useStudyState();

  const [view, setView] = useState<StudyView>(initialView ?? "tasks");
  const [newTitle, setNewTitle] = useState("");
  const [difficulty, setDifficulty] = useState<StudyTaskDifficulty>("easy");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [customMinutes, setCustomMinutes] = useState<number>(25);
  const [feedback, setFeedback] = useState<string>("");

  const speech = useSpeechToText({ lang: "ar-EG" });

  const selectedTask = useMemo(() => tasks.find((task) => task.id === selectedTaskId) ?? null, [tasks, selectedTaskId]);

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setView("tasks")}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition ${
            view === "tasks" ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/30"
          }`}
        >
          <ListChecks className="h-4 w-4" />
          المهام
        </button>
        <button
          type="button"
          onClick={() => setView("pomodoro")}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition ${
            view === "pomodoro" ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/30"
          }`}
        >
          <Timer className="h-4 w-4" />
          بومودورو
        </button>
      </div>

      {view === "tasks" ? (
        <>
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm font-bold">رصيد تركيزك اليوم: {focusMinutesToday} دقيقة</p>
            <p className="mt-1 text-xs text-muted-foreground">اكتب المهمة يدويًا أو أضفها بالصوت ثم ابدأ جلسة بومودورو.</p>
          </div>

          <div className="rounded-2xl border p-4">
            <p className="mb-3 text-sm font-bold">إضافة مهمة دراسية</p>
            <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
              <Input
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  addTask(newTitle, difficulty);
                  setNewTitle("");
                }}
                placeholder="مثال: مذاكرة Chapter 3"
              />
              <Button
                onClick={() => {
                  addTask(newTitle, difficulty);
                  setNewTitle("");
                }}
              >
                <Plus className="ml-1 h-4 w-4" />
                إضافة
              </Button>
              <Button
                variant={speech.isListening ? "destructive" : "outline"}
                onClick={() => {
                  if (!speech.supported) {
                    setFeedback("المتصفح الحالي لا يدعم الإدخال الصوتي.");
                    return;
                  }
                  if (speech.isListening) {
                    const spokenText = speech.stopAndGetTranscript();
                    if (spokenText) {
                      addTask(spokenText, difficulty);
                      setFeedback(`تمت إضافة المهمة صوتيًا: ${spokenText}`);
                    } else {
                      setFeedback("لم يتم التقاط نص واضح من التسجيل.");
                    }
                    speech.clear();
                    return;
                  }
                  speech.start();
                }}
              >
                {speech.isListening ? <MicOff className="ml-1 h-4 w-4" /> : <Mic className="ml-1 h-4 w-4" />}
                {speech.isListening ? "إيقاف التسجيل" : "تسجيل صوتي"}
              </Button>
            </div>
            <div className={`mt-3 rounded-xl border p-3 ${speech.isListening ? "border-primary/40 bg-primary/5" : "border-muted"}`}>
              <p className="text-xs text-muted-foreground">
                {speech.isListening ? "النص المباشر من الميكروفون" : "المعاينة الصوتية"}
              </p>
              <p className="mt-2 min-h-12 text-sm font-medium leading-7">
                {speech.transcript || (speech.isListening ? "اتكلم دلوقتي... النص هيظهر هنا مباشرة." : "لا يوجد نص صوتي بعد.")}
              </p>
            </div>
            {speech.error ? <p className="mt-2 text-xs text-destructive">{speech.error}</p> : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {DIFFICULTIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDifficulty(item.id)}
                  className={`rounded-xl border px-3 py-2 text-right transition ${
                    difficulty === item.id ? "border-primary bg-primary/10" : "hover:border-primary/30"
                  }`}
                >
                  <span className="inline-flex items-center gap-2 text-sm font-bold">
                    <span className={`h-2.5 w-2.5 rounded-full ${item.dotClass}`} />
                    {item.label}
                  </span>
                  <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold">قائمة مهام الدراسة</p>
              <Button
                className="bg-amber-400 text-slate-950 hover:bg-amber-300"
                onClick={() => {
                  const ok = startWarmup();
                  if (ok) setView("pomodoro");
                  if (ok) onSessionStarted?.();
                  setFeedback(ok ? "بدأت جلسة Warm-up لمدة 5 دقائق." : "أضف مهمة سهلة أولًا.");
                }}
              >
                <Flame className="ml-1 h-4 w-4" />
                Warm-up ⚡
              </Button>
            </div>

            {feedback ? <p className="mt-2 text-xs text-muted-foreground">{feedback}</p> : null}

            <div className="mt-3 space-y-2">
              {tasks.length === 0 ? (
                <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">لا توجد مهام بعد.</p>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} className="rounded-xl border p-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="flex-1 text-right"
                        onClick={() => {
                          setSelectedTaskId(task.id);
                          setCustomMinutes(task.difficulty === "easy" ? 10 : task.difficulty === "medium" ? 25 : 45);
                        }}
                      >
                        <p className="font-semibold">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          الصعوبة: {task.difficulty === "easy" ? "🟢 سهل" : task.difficulty === "medium" ? "🟡 متوسط" : "🔴 صعب"}
                        </p>
                      </button>
                      <Button variant="ghost" size="icon" onClick={() => removeTask(task.id)} aria-label="حذف المهمة">
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {selectedTask ? (
            <div className="rounded-2xl border border-[#3d5ab6]/35 bg-[#3d5ab6]/10 p-4">
              <p className="text-sm font-bold">تخصيص الوقت: {selectedTask.title}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={180}
                  value={customMinutes}
                  onChange={(event) => setCustomMinutes(Math.max(1, Math.min(180, Number(event.target.value) || 1)))}
                  className="w-28"
                />
                <Button variant="outline" size="sm" onClick={() => setCustomMinutes((prev) => Math.min(180, prev + 5))}>
                  +5
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCustomMinutes((prev) => Math.min(180, prev + 10))}>
                  +10
                </Button>
                <Button
                  className="mr-auto"
                  onClick={() => {
                    startSession(selectedTask, customMinutes);
                    setView("pomodoro");
                    onSessionStarted?.();
                  }}
                >
                  <Clock3 className="ml-1 h-4 w-4" />
                  ابدأ الجلسة
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : activeSession ? (
        <ZenFocusTimer
          session={activeSession}
          onEndSession={endSession}
          onSessionComplete={() => {
            completeSession(activeSession.plannedMinutes);
            onSessionCompleted?.(activeSession.plannedMinutes);
          }}
        />
      ) : (
        <div className="rounded-2xl border border-dashed p-6 text-center">
          <p className="text-sm font-semibold">تبويب البومودورو</p>
          <p className="mt-1 text-xs text-muted-foreground">
            اختر مهمة من تبويب "المهام" ثم اضغط "ابدأ الجلسة" وسيتم تشغيل المؤقت هنا.
          </p>
        </div>
      )}
    </div>
  );
}
