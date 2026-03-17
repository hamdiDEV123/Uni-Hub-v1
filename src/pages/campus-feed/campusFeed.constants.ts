import type { CampusPostCategory, StoryReactionType } from "@/backend/campusFeedApi";

export type StoryBackgroundId = "uni_wave" | "delta_grid" | "campus_night" | "lecture_lines";

export type StoryFont = "cairo" | "tajawal" | "system";

export const PLATFORM_STORY_BACKGROUNDS: Array<{ id: StoryBackgroundId; label: string; assetUrl: string }> = [
  { id: "uni_wave", label: "Uni Wave", assetUrl: "/story-backgrounds/uni-wave.svg" },
  { id: "delta_grid", label: "Delta Grid", assetUrl: "/story-backgrounds/delta-grid.svg" },
  { id: "campus_night", label: "Campus Night", assetUrl: "/story-backgrounds/campus-night.svg" },
  { id: "lecture_lines", label: "Lecture Lines", assetUrl: "/story-backgrounds/lecture-lines.svg" },
];

export const STORY_REACTION_OPTIONS: Array<{ type: StoryReactionType; emoji: string; label: string }> = [
  { type: "like", emoji: "❤️", label: "إعجاب" },
  { type: "fire", emoji: "🔥", label: "نار" },
  { type: "laugh", emoji: "😂", label: "ضحك" },
  { type: "clap", emoji: "👏", label: "تصفيق" },
  { type: "wow", emoji: "😮", label: "واو" },
];

export const CAMPUS_CATEGORY_LABELS: Record<CampusPostCategory, string> = {
  general: "عام",
  academic: "أكاديمي",
  memes: "ميمز",
  lost_found: "فاقد وموجود",
};

export const STORY_FONT_LABELS: Record<StoryFont, string> = {
  cairo: "Cairo",
  tajawal: "Tajawal",
  system: "System",
};
