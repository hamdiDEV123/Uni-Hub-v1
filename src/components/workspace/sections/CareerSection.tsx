import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckRow } from "@/components/workspace/CheckRow";
import { SectionFocusCard } from "@/components/workspace/SectionFocusCard";
import { StepperRow } from "@/components/workspace/StepperRow";
import { clamp, sectionProgress, type DailyChallenge, type LifeData, type SectionKey } from "@/lib/workspace/schema";

export function CareerSection({
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
  const career = lifeData.career;
  const progress = sectionProgress("career", lifeData);
  return (
    <Card className="shadow-hard-sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-xl">
          <button type="button" className="inline-flex items-center gap-2 text-sm text-muted-foreground" onClick={onBack}>
            <ArrowRight className="h-4 w-4" />
            رجوع
          </button>
          حياتي المهنية
        </CardTitle>
        <CardDescription>خطوات مهارية يومية بسيطة ومباشرة.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SectionFocusCard
          progress={progress}
          title={challenge ? challenge.title : "نفّذ خطوة مهنية صغيرة الآن"}
          hint={challenge ? challenge.tip : "تحديث واحد في البورتفوليو أو 10 دقائق مهارة تصنع فرق تراكمي."}
          badge={challenge ? "تحدي اليوم" : undefined}
          actionLabel={challenge ? "نفّذ تحدي اليوم" : "+10 دقائق مهارة"}
          onAction={() =>
            {
              setLifeData((prev) => ({
                ...prev,
                career: { ...prev.career, skillMinutes: clamp(prev.career.skillMinutes + 10, 0, 600) },
              }));
              if (challenge) onChallengeComplete("career");
            }
          }
        />
        <StepperRow
          label="وقت تطوير المهارة (دقيقة)"
          value={career.skillMinutes}
          target={career.skillTarget}
          onMinus={() =>
            setLifeData((prev) => ({
              ...prev,
              career: { ...prev.career, skillMinutes: clamp(prev.career.skillMinutes - 10, 0, 600) },
            }))
          }
          onPlus={() =>
            setLifeData((prev) => ({
              ...prev,
              career: { ...prev.career, skillMinutes: clamp(prev.career.skillMinutes + 10, 0, 600) },
            }))
          }
        />
        <CheckRow
          label="خطوة في البورتفوليو"
          checked={career.portfolioStep}
          onChange={(value) =>
            setLifeData((prev) => ({ ...prev, career: { ...prev.career, portfolioStep: value } }))
          }
        />
        <CheckRow
          label="تواصل مهني (رسالة/تقديم)"
          checked={career.networkingStep}
          onChange={(value) =>
            setLifeData((prev) => ({ ...prev, career: { ...prev.career, networkingStep: value } }))
          }
        />
      </CardContent>
    </Card>
  );
}
