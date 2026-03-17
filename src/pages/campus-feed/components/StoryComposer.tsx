import type { RefObject } from "react";
import { Camera, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StoryBackgroundId, StoryFont } from "../campusFeed.constants";
import { PLATFORM_STORY_BACKGROUNDS, STORY_FONT_LABELS } from "../campusFeed.constants";
import { getStoryFontFamily } from "../campusFeed.utils";

type StoryComposerProps = {
  isOpen: boolean;
  storyPreviewUrl: string | null;
  storyOverlayText: string;
  storyTextColor: string;
  storyTextPosition: { x: number; y: number };
  storyFont: StoryFont;
  storyFontSize: number;
  storyTextRotation: number;
  storyBackground: StoryBackgroundId;
  storyCaption: string;
  storyAnonymous: boolean;
  isCreatePending: boolean;
  storyImageFile: File | null;
  selectedStoryBackground: { id: StoryBackgroundId; label: string; assetUrl: string };
  isDraggingStoryText: boolean;
  storyPreviewFrameRef: RefObject<HTMLDivElement | null>;
  onToggle: () => void;
  onClose: () => void;
  onApplyImageFile: (file: File) => void;
  onClearImageSelection: () => void;
  onStoryOverlayTextChange: (value: string) => void;
  onStoryBackgroundChange: (value: StoryBackgroundId) => void;
  onStoryFontChange: (value: StoryFont) => void;
  onStoryTextColorChange: (value: string) => void;
  onStoryTextPositionReset: () => void;
  onStoryTextPositionPointerMove: (clientX: number, clientY: number) => void;
  onStoryTextDragStart: (clientX: number, clientY: number) => void;
  onStoryTextDragEnd: () => void;
  onStoryFontSizeChange: (value: number) => void;
  onStoryTextRotationChange: (value: number) => void;
  onStoryCaptionChange: (value: string) => void;
  onStoryAnonymousChange: (value: boolean) => void;
  onCreateStory: () => void;
};

export function StoryComposer({
  isOpen,
  storyPreviewUrl,
  storyOverlayText,
  storyTextColor,
  storyTextPosition,
  storyFont,
  storyFontSize,
  storyTextRotation,
  storyBackground,
  storyCaption,
  storyAnonymous,
  isCreatePending,
  storyImageFile,
  selectedStoryBackground,
  isDraggingStoryText,
  storyPreviewFrameRef,
  onToggle,
  onClose,
  onApplyImageFile,
  onClearImageSelection,
  onStoryOverlayTextChange,
  onStoryBackgroundChange,
  onStoryFontChange,
  onStoryTextColorChange,
  onStoryTextPositionReset,
  onStoryTextPositionPointerMove,
  onStoryTextDragStart,
  onStoryTextDragEnd,
  onStoryFontSizeChange,
  onStoryTextRotationChange,
  onStoryCaptionChange,
  onStoryAnonymousChange,
  onCreateStory,
}: StoryComposerProps) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className="min-w-[108px] max-w-[108px] text-center"
      >
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-primary/50 bg-primary/5">
          <Plus className="h-5 w-5 text-primary" />
        </div>
        <p className="mt-1 text-[11px] font-bold text-primary">{isOpen ? "إغلاق" : "أضف لقطة"}</p>
        <p className="text-[10px] text-muted-foreground">تزول بعد 24 ساعة</p>
      </button>

      {isOpen ? (
        <div className="mt-4 rounded-2xl border border-border bg-background/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="inline-flex items-center gap-2 text-sm font-black">
              <Camera className="h-4 w-4 text-primary" />
              لقطة اليوم (24 ساعة)
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              إغلاق
            </button>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <label className="cursor-pointer rounded-xl border border-border bg-background px-3 py-2 text-center text-xs font-bold hover:border-primary/40">
              اختر صورة من جهازك
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onApplyImageFile(file);
                }}
              />
            </label>

            <label className="cursor-pointer rounded-xl border border-border bg-background px-3 py-2 text-center text-xs font-bold hover:border-primary/40">
              صور دلوقتي بالكاميرا
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onApplyImageFile(file);
                }}
              />
            </label>
          </div>

          <div className="mb-3 overflow-hidden rounded-2xl border border-border bg-card">
            <div
              ref={storyPreviewFrameRef}
              className="relative aspect-[9/16] w-full overflow-hidden bg-slate-900"
              onPointerMove={(event) => {
                if (!isDraggingStoryText) return;
                onStoryTextPositionPointerMove(event.clientX, event.clientY);
              }}
              onPointerUp={onStoryTextDragEnd}
              onPointerLeave={onStoryTextDragEnd}
              onPointerCancel={onStoryTextDragEnd}
            >
              {storyPreviewUrl ? (
                <img src={storyPreviewUrl} alt="story preview" className="h-full w-full object-cover" />
              ) : selectedStoryBackground?.assetUrl ? (
                <img
                  src={selectedStoryBackground.assetUrl}
                  alt={selectedStoryBackground.label}
                  className="h-full w-full object-cover"
                />
              ) : null}
              <div className="absolute inset-0 bg-black/20" />
              <div
                className="absolute z-10 w-[82%] px-2 text-center"
                style={{
                  left: `${storyTextPosition.x}%`,
                  top: `${storyTextPosition.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <p
                  className={`whitespace-pre-wrap break-words text-2xl font-black leading-9 ${
                    isDraggingStoryText ? "cursor-grabbing" : "cursor-grab"
                  } select-none`}
                  style={{
                    color: storyTextColor,
                    fontFamily: getStoryFontFamily(storyFont),
                    fontSize: `${storyFontSize}px`,
                    transform: `rotate(${storyTextRotation}deg)`,
                    textShadow: "0 2px 10px rgba(0,0,0,0.55)",
                  }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    onStoryTextDragStart(event.clientX, event.clientY);
                  }}
                  onPointerMove={(event) => {
                    if (!isDraggingStoryText) return;
                    onStoryTextPositionPointerMove(event.clientX, event.clientY);
                  }}
                  onPointerUp={onStoryTextDragEnd}
                >
                  {storyOverlayText.trim() || "اكتب على الصورة..."}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border p-2">
              <span className="text-[11px] text-muted-foreground">
                {storyImageFile ? `الصورة: ${storyImageFile.name}` : "لا توجد صورة — سيتم استخدام الخلفية المختارة"}
              </span>
              {storyPreviewUrl ? (
                <button
                  type="button"
                  onClick={onClearImageSelection}
                  className="rounded-lg border border-border px-2 py-1 text-[11px] font-bold hover:border-primary/40"
                >
                  إزالة الصورة
                </button>
              ) : null}
            </div>
          </div>

          <textarea
            value={storyOverlayText}
            onChange={(event) => onStoryOverlayTextChange(event.target.value)}
            rows={2}
            maxLength={240}
            placeholder="اكتب نصًا على الصورة..."
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
          />

          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-background p-2">
              <p className="mb-1 text-[11px] font-bold text-muted-foreground">الخلفية</p>
              <div className="flex flex-wrap gap-2">
                {PLATFORM_STORY_BACKGROUNDS.map((background) => (
                  <button
                    key={background.id}
                    type="button"
                    onClick={() => onStoryBackgroundChange(background.id)}
                    className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${
                      storyBackground === background.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    {background.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background p-2">
              <p className="mb-1 text-[11px] font-bold text-muted-foreground">الخط</p>
              <div className="flex flex-wrap gap-2">
                {(["cairo", "tajawal", "system"] as const).map((font) => (
                  <button
                    key={font}
                    type="button"
                    onClick={() => onStoryFontChange(font)}
                    className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${
                      storyFont === font
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    {STORY_FONT_LABELS[font]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
            <label htmlFor="story-text-color" className="text-[11px] font-bold text-muted-foreground">
              لون النص
            </label>
            <input
              id="story-text-color"
              type="color"
              value={storyTextColor}
              onChange={(event) => onStoryTextColorChange(event.target.value)}
              className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
            />
            <button
              type="button"
              onClick={onStoryTextPositionReset}
              className="mr-auto rounded-lg border border-border px-2 py-1 text-[11px] font-bold hover:border-primary/40"
            >
              توسيط النص
            </button>
          </div>

          <div className="mt-2 rounded-xl border border-border bg-background px-3 py-2">
            <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-muted-foreground">
              <span>حجم النص</span>
              <span>{storyFontSize}px</span>
            </div>
            <input
              type="range"
              min={28}
              max={92}
              step={1}
              value={storyFontSize}
              onChange={(event) => onStoryFontSizeChange(Number(event.target.value))}
              className="w-full"
            />

            <div className="mb-2 mt-3 flex items-center justify-between text-[11px] font-bold text-muted-foreground">
              <span>دوران النص</span>
              <span>{storyTextRotation}°</span>
            </div>
            <input
              type="range"
              min={-35}
              max={35}
              step={1}
              value={storyTextRotation}
              onChange={(event) => onStoryTextRotationChange(Number(event.target.value))}
              className="w-full"
            />
          </div>

          <textarea
            value={storyCaption}
            onChange={(event) => onStoryCaptionChange(event.target.value)}
            rows={2}
            maxLength={180}
            placeholder="وصف قصير (اختياري)"
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
          />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={storyAnonymous}
                onChange={(event) => onStoryAnonymousChange(event.target.checked)}
                disabled
              />
              نشر بالهوية (مفعل)
            </label>
            <Button
              className="mr-auto"
              onClick={onCreateStory}
              disabled={isCreatePending}
            >
              {isCreatePending ? "جاري نشر اللقطة..." : "نشر لقطة"}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
