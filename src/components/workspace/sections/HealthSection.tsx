import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckRow } from "@/components/workspace/CheckRow";
import { SectionFocusCard } from "@/components/workspace/SectionFocusCard";
import { StepperRow } from "@/components/workspace/StepperRow";
import { clamp, sectionProgress, type DailyChallenge, type LifeData, type SectionKey } from "@/lib/workspace/schema";

export function HealthSection({
  lifeData,
  onBack,
  setLifeData,
  challenge,
  onChallengeComplete,
}: {
  lifeData: LifeData;
  onBack: () => void;
  setLifeData: (updater: (current: LifeData) => LifeData) => void;
  challenge?: DailyChallenge;
  onChallengeComplete: (section: SectionKey) => void;
}) {
  const health = lifeData.health;
  const progress = sectionProgress("health", lifeData);
  return (
    <Card className="shadow-hard-sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-xl">
          <button type="button" className="inline-flex items-center gap-2 text-sm text-muted-foreground" onClick={onBack}>
            <ArrowRight className="h-4 w-4" />
            رجوع
          </button>
          حياتي الصحية
        </CardTitle>
        <CardDescription>مؤشرات يومية واضحة للصحة بدون تعقيد.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SectionFocusCard
          progress={progress}
          title={challenge ? challenge.title : "ابدأ بصحتك بكوب ماء الآن"}
          hint={challenge ? challenge.tip : "الخطوات السهلة أولًا تزيد احتمالية إكمال يومك."}
          badge={challenge ? "تحدي اليوم" : undefined}
          actionLabel={challenge ? "نفّذ تحدي اليوم" : "+1 كوب ماء"}
          onAction={() =>
            {
              setLifeData((prev) => ({
                ...prev,
                health: { ...prev.health, waterCups: clamp(prev.health.waterCups + 1, 0, 30) },
              }));
              if (challenge) onChallengeComplete("health");
            }
          }
        />
        <StepperRow
          label="أكواب ماء"
          value={health.waterCups}
          target={health.waterTarget}
          onMinus={() =>
            setLifeData((prev) => ({
              ...prev,
              health: { ...prev.health, waterCups: clamp(prev.health.waterCups - 1, 0, 30) },
            }))
          }
          onPlus={() =>
            setLifeData((prev) => ({
              ...prev,
              health: { ...prev.health, waterCups: clamp(prev.health.waterCups + 1, 0, 30) },
            }))
          }
        />
        <CheckRow
          label="تمرين اليوم"
          checked={health.workoutDone}
          onChange={(value) =>
            setLifeData((prev) => ({ ...prev, health: { ...prev.health, workoutDone: value } }))
          }
        />
        <StepperRow
          label="ساعات النوم"
          value={health.sleepHours}
          target={health.sleepTarget}
          onMinus={() =>
            setLifeData((prev) => ({
              ...prev,
              health: { ...prev.health, sleepHours: clamp(prev.health.sleepHours - 1, 0, 24) },
            }))
          }
          onPlus={() =>
            setLifeData((prev) => ({
              ...prev,
              health: { ...prev.health, sleepHours: clamp(prev.health.sleepHours + 1, 0, 24) },
            }))
          }
        />
      </CardContent>
    </Card>
  );
}
