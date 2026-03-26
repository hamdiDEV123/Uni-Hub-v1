import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PrayerChecks } from "@/components/workspace/PrayerChecks";
import { SectionFocusCard } from "@/components/workspace/SectionFocusCard";
import { clamp, sectionProgress, type DailyChallenge, type LifeData, type SectionKey } from "@/lib/workspace/schema";

export function ReligiousSection({
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
  const religious = lifeData.religious;
  const progress = sectionProgress("religious", lifeData);
  return (
    <Card className="shadow-hard-sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-xl">
          <button type="button" className="inline-flex items-center gap-2 text-sm text-muted-foreground" onClick={onBack}>
            <ArrowRight className="h-4 w-4" />
            رجوع
          </button>
          حياتي الدينية
        </CardTitle>
        <CardDescription>تابع صلاتك ووردك اليومي مباشرة بدون كتابة مهام.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SectionFocusCard
          progress={progress}
          title={challenge ? challenge.title : "ابدأ بذكر أو صلاة قريبة منك الآن"}
          hint={challenge ? challenge.tip : "نقلة صغيرة واحدة تقلل التسويف وتفتح بقية اليوم."}
          badge={challenge ? "تحدي اليوم" : undefined}
          actionLabel={challenge ? "نفّذ تحدي اليوم" : "تمّت أذكار الصباح"}
          onAction={() =>
            {
              setLifeData((prev) => ({
                ...prev,
                religious: {
                  ...prev.religious,
                  adhkarMorning: true,
                  quranPages: clamp(prev.religious.quranPages + 1, 0, 100),
                },
              }));
              if (challenge) onChallengeComplete("religious");
            }
          }
        />
        <PrayerChecks
          state={religious}
          onToggle={(key, value) =>
            setLifeData((prev) => ({ ...prev, religious: { ...prev.religious, [key]: value } }))
          }
        />
        <div className="rounded-xl border p-4">
          <p className="text-sm font-semibold">الورد اليومي (صفحات قرآن)</p>
          <div className="mt-3 flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setLifeData((prev) => ({
                  ...prev,
                  religious: { ...prev.religious, quranPages: clamp(prev.religious.quranPages - 1, 0, 100) },
                }))
              }
            >
              -
            </Button>
            <p className="min-w-20 text-center font-bold">
              {religious.quranPages} / {religious.quranTarget}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setLifeData((prev) => ({
                  ...prev,
                  religious: { ...prev.religious, quranPages: clamp(prev.religious.quranPages + 1, 0, 100) },
                }))
              }
            >
              +
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
