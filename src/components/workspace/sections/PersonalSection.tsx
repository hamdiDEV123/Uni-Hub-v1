import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckRow } from "@/components/workspace/CheckRow";
import { SectionFocusCard } from "@/components/workspace/SectionFocusCard";
import { sectionProgress, type DailyChallenge, type LifeData, type SectionKey } from "@/lib/workspace/schema";

export function PersonalSection({
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
  const personal = lifeData.personal;
  const progress = sectionProgress("personal", lifeData);
  return (
    <Card className="shadow-hard-sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-xl">
          <button type="button" className="inline-flex items-center gap-2 text-sm text-muted-foreground" onClick={onBack}>
            <ArrowRight className="h-4 w-4" />
            رجوع
          </button>
          حياتي الشخصية
        </CardTitle>
        <CardDescription>اتزانك الشخصي اليومي في 3 عناصر واضحة.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <SectionFocusCard
          progress={progress}
          title={challenge ? challenge.title : "اختم اليوم بخطة الغد"}
          hint={challenge ? challenge.tip : "خطتان صغيرتان للغد تقللان قرار البداية صباحًا."}
          badge={challenge ? "تحدي اليوم" : undefined}
          actionLabel={challenge ? "نفّذ تحدي اليوم" : "تمت خطة الغد"}
          onAction={() =>
            {
              setLifeData((prev) => ({
                ...prev,
                personal: { ...prev.personal, tomorrowPlan: true },
              }));
              if (challenge) onChallengeComplete("personal");
            }
          }
        />
        <CheckRow
          label="تواصل عائلي"
          checked={personal.familyCheck}
          onChange={(value) =>
            setLifeData((prev) => ({ ...prev, personal: { ...prev.personal, familyCheck: value } }))
          }
        />
        <CheckRow
          label="تنظيم المكان"
          checked={personal.roomReset}
          onChange={(value) =>
            setLifeData((prev) => ({ ...prev, personal: { ...prev.personal, roomReset: value } }))
          }
        />
        <CheckRow
          label="خطة الغد"
          checked={personal.tomorrowPlan}
          onChange={(value) =>
            setLifeData((prev) => ({ ...prev, personal: { ...prev.personal, tomorrowPlan: value } }))
          }
        />
      </CardContent>
    </Card>
  );
}
