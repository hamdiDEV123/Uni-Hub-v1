import type { StoryFont } from "./campusFeed.constants";

export function getStoryFontFamily(font: StoryFont): string {
  if (font === "tajawal") return '"Tajawal", "Cairo", sans-serif';
  if (font === "system") return 'system-ui, -apple-system, "Segoe UI", sans-serif';
  return '"Cairo", "Tajawal", sans-serif';
}

export function clampPercent(value: number): number {
  return Math.min(92, Math.max(8, value));
}

export function formatTimeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
  if (minutes < 60) return `منذ ${minutes} د`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} س`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

export function isStoryExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}
