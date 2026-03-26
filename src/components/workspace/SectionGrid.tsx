import type { ComponentType } from "react";
import { BookOpen, Briefcase, HeartPulse, MoonStar, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SECTION_META, type LifeData, type SectionKey } from "@/lib/workspace/schema";
import { sectionProgress } from "@/lib/workspace/schema";

const ICONS: Record<SectionKey, ComponentType<{ className?: string }>> = {
  religious: MoonStar,
  study: BookOpen,
  career: Briefcase,
  health: HeartPulse,
  personal: Sparkles,
};

export function SectionGrid({
  lifeData,
  onOpenSection,
}: {
  lifeData: LifeData;
  onOpenSection: (section: SectionKey) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {SECTION_META.map((section) => {
        const Icon = ICONS[section.id];
        const progress = sectionProgress(section.id, lifeData);
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onOpenSection(section.id)}
            className="text-right"
          >
            <Card className="h-full transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-hard-sm">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-lg">
                  <span>{section.label}</span>
                  <Icon className="h-5 w-5 text-primary" />
                </CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">التقدم: {progress}%</p>
                <Progress value={progress} className="mt-2 h-2" />
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
