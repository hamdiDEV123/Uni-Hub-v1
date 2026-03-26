export type StudyTaskDifficulty = "easy" | "medium" | "hard";

export interface StudyTask {
  id: string;
  title: string;
  difficulty: StudyTaskDifficulty;
  createdAt: string;
}

export interface StudySession {
  id: string;
  taskId: string;
  taskTitle: string;
  plannedMinutes: number;
  startTimeMs: number;
  targetDurationMs: number;
}

export type AmbientTrackId = "rain" | "campfire" | "wind" | "ocean" | "quran";

export interface AmbientTrack {
  id: AmbientTrackId;
  label: string;
  src: string;
}
