import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { CampusPostWithMeta, StoryReactionType } from "@/backend/campusFeedApi";
import { STORY_REACTION_OPTIONS } from "../campusFeed.constants";

type StoryViewerProps = {
  activeStory: CampusPostWithMeta | null;
  topStories: CampusPostWithMeta[];
  activeStoryIndex: number | null;
  storyProgress: number;
  isActiveStoryExpired: boolean;
  canDeleteActiveStory: boolean;
  canReactToActiveStory: boolean;
  isReactPending: boolean;
  formatTimeAgo: (isoDate: string) => string;
  onClose: () => void;
  onDeleteActiveStory: () => void;
  onPause: () => void;
  onResume: () => void;
  onNextStory: () => void;
  onPreviousStory: () => void;
  onReact: (reactionType: StoryReactionType) => void;
};

export function StoryViewer({
  activeStory,
  topStories,
  activeStoryIndex,
  storyProgress,
  isActiveStoryExpired,
  canDeleteActiveStory,
  canReactToActiveStory,
  isReactPending,
  formatTimeAgo,
  onClose,
  onDeleteActiveStory,
  onPause,
  onResume,
  onNextStory,
  onPreviousStory,
  onReact,
}: StoryViewerProps) {
  if (!activeStory) return null;

  const authorName = activeStory.author_profile?.full_name?.trim() || "طالب";
  const authorUniversity = activeStory.author_profile?.university?.trim() || "جامعة غير محددة";
  const authorAvatar = activeStory.author_profile?.avatar_url;

  return (
    <div className="fixed inset-0 z-[80] bg-black/90 p-3 md:p-6" dir="rtl">
      <div className="mx-auto flex h-full w-full max-w-md flex-col">
        <div className="mb-3 flex items-center gap-1">
          {topStories.map((story, index) => (
            <div key={story.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full bg-white transition-all duration-100"
                style={{
                  width:
                    index < (activeStoryIndex ?? 0)
                      ? "100%"
                      : index === activeStoryIndex
                        ? `${storyProgress}%`
                        : "0%",
                }}
              />
            </div>
          ))}
        </div>

        <div className="mb-3 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            {authorAvatar ? (
              <img src={authorAvatar} alt={authorName} className="h-9 w-9 rounded-full border border-white/30 object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10 text-sm font-black text-white">
                {authorName.charAt(0)}
              </div>
            )}
            <div>
              <p className="text-sm font-bold">{authorName}</p>
              <p className="text-[11px] text-white/70">{authorUniversity}</p>
              <p className="text-[11px] text-white/70">{formatTimeAgo(activeStory.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isActiveStoryExpired ? (
              <span className="rounded-full border border-amber-300/40 px-2 py-1 text-[10px] font-bold text-amber-200">
                منتهية
              </span>
            ) : null}

            {canDeleteActiveStory ? (
              <button
                type="button"
                onClick={onDeleteActiveStory}
                className="rounded-full border border-red-400/40 px-3 py-1 text-xs font-bold text-red-200 hover:bg-red-500/20"
              >
                حذف
              </button>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/30 p-2 text-white/80 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          className="relative flex flex-1 items-center justify-center overflow-hidden rounded-3xl bg-white/10"
          onPointerDown={onPause}
          onPointerUp={onResume}
          onPointerLeave={onResume}
          onPointerCancel={onResume}
        >
          {activeStory.media_url ? (
            <img src={activeStory.media_url} alt="story" className="h-full w-full object-contain" />
          ) : (
            <div className="px-5 text-center">
              <p className="text-xl font-black leading-9 text-white">{activeStory.content ?? "Story"}</p>
            </div>
          )}

          <div className="absolute inset-0 grid grid-cols-2">
            <button
              type="button"
              aria-label="التالي"
              onClick={onNextStory}
              onPointerDown={onPause}
              onPointerUp={onResume}
              className="h-full w-full"
            />
            <button
              type="button"
              aria-label="السابق"
              onClick={onPreviousStory}
              onPointerDown={onPause}
              onPointerUp={onResume}
              className="h-full w-full"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-1.5">
            {STORY_REACTION_OPTIONS.map((reaction) => {
              const count = activeStory.story_reactions?.counts?.[reaction.type] ?? 0;
              const isActive = activeStory.story_reactions?.user_reaction_type === reaction.type;

              return (
                <button
                  key={reaction.type}
                  type="button"
                  title={reaction.label}
                  onClick={() => onReact(reaction.type)}
                  disabled={isReactPending || !canReactToActiveStory}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold transition ${
                    isActive
                      ? "border-primary bg-primary/20 text-white"
                      : "border-white/30 text-white/90 hover:bg-white/10"
                  }`}
                >
                  <span>{reaction.emoji}</span>
                  <span>{count}</span>
                </button>
              );
            })}
          </div>

          {!canReactToActiveStory ? (
            <p className="text-[11px] text-amber-200">التفاعل متاح للستوري النشطة فقط</p>
          ) : null}

          <button
            type="button"
            onClick={onPreviousStory}
            disabled={(activeStoryIndex ?? 0) <= 0}
            className="inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
            السابق
          </button>
          <button
            type="button"
            onClick={onNextStory}
            className="inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-sm font-bold text-white"
          >
            التالي
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
