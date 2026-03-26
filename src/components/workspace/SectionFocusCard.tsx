import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export function SectionFocusCard({
  progress,
  title,
  hint,
  actionLabel,
  onAction,
  badge,
}: {
  progress: number;
  title: string;
  hint: string;
  actionLabel: string;
  onAction: () => void;
  badge?: string;
}) {
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold text-primary">
            <Zap className="h-3.5 w-3.5" />
            {badge ?? "خطوة الآن"}
          </p>
          <p className="mt-1 text-sm font-bold">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <Button size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
      <div className="mt-3">
        <p className="mb-1 text-xs text-muted-foreground">تقدم القسم: {progress}%</p>
        <Progress value={progress} className="h-2" />
      </div>
    </div>
  );
}
