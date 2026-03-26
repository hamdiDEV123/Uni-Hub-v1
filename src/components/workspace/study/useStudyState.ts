import { useEffect, useMemo, useState } from "react";
import type { StudySession, StudyTask, StudyTaskDifficulty } from "@/components/workspace/study/types";

const STUDY_TASKS_KEY = "nizam-hayati/study/tasks";
const STUDY_MINUTES_KEY = "nizam-hayati/study/focus-minutes";
const STUDY_ACTIVE_SESSION_KEY = "nizam-hayati/study/active-session";

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useStudyState() {
  const [tasks, setTasks] = useState<StudyTask[]>(() => readStorage(STUDY_TASKS_KEY, []));
  const [focusMinutesToday, setFocusMinutesToday] = useState<number>(() => readStorage(STUDY_MINUTES_KEY, 0));
  const [activeSession, setActiveSession] = useState<StudySession | null>(() => readStorage(STUDY_ACTIVE_SESSION_KEY, null));

  useEffect(() => {
    window.localStorage.setItem(STUDY_TASKS_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    window.localStorage.setItem(STUDY_MINUTES_KEY, JSON.stringify(focusMinutesToday));
  }, [focusMinutesToday]);

  useEffect(() => {
    if (activeSession) {
      window.localStorage.setItem(STUDY_ACTIVE_SESSION_KEY, JSON.stringify(activeSession));
      return;
    }
    window.localStorage.removeItem(STUDY_ACTIVE_SESSION_KEY);
  }, [activeSession]);

  const easyTasks = useMemo(() => tasks.filter((task) => task.difficulty === "easy"), [tasks]);

  const addTask = (title: string, difficulty: StudyTaskDifficulty) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setTasks((prev) => [
      { id: makeId("study-task"), title: trimmed, difficulty, createdAt: new Date().toISOString() },
      ...prev,
    ]);
  };

  const removeTask = (taskId: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
  };

  const startSession = (task: StudyTask, plannedMinutes: number) => {
    const normalizedMinutes = Math.max(1, Math.min(180, Math.floor(plannedMinutes)));
    setActiveSession({
      id: makeId("study-session"),
      taskId: task.id,
      taskTitle: task.title,
      plannedMinutes: normalizedMinutes,
      startTimeMs: Date.now(),
      targetDurationMs: normalizedMinutes * 60_000,
    });
  };

  const startWarmup = () => {
    if (!easyTasks.length) return false;
    const random = easyTasks[Math.floor(Math.random() * easyTasks.length)];
    startSession(random, 5);
    return true;
  };

  const endSession = () => setActiveSession(null);

  const completeSession = (minutes: number) => {
    setFocusMinutesToday((prev) => prev + minutes);
  };

  return {
    tasks,
    focusMinutesToday,
    activeSession,
    addTask,
    removeTask,
    startSession,
    startWarmup,
    endSession,
    completeSession,
  };
}
