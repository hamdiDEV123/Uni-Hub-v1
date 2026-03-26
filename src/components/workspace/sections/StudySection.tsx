import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckRow } from "@/components/workspace/CheckRow";
import { StepperRow } from "@/components/workspace/StepperRow";
import { StudyWorkspace } from "@/components/workspace/study/StudyWorkspace";
import { useNavigate } from "react-router-dom";
import { clamp, sectionProgress, type DailyChallenge, type LifeData, type SectionKey } from "@/lib/workspace/schema";

export function StudySection({
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
  const study = lifeData.study;
  const progress = sectionProgress("study", lifeData);
  const navigate = useNavigate();

  return (
    <Card className="shadow-hard-sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-xl">
          <button type="button" className="inline-flex items-center gap-2 text-sm text-muted-foreground" onClick={onBack}>
            <ArrowRight className="h-4 w-4" />
            رجوع
          </button>
          حياتي الدراسية
        </CardTitle>
        <CardDescription>جلسات تركيز، مراجعة، وتقدّم تكليفاتك.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold">لوحة الدراسة</p>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs">
              التقدم: {progress}%
            </span>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <div className="rounded-xl border bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">المهام المكتملة</p>
              <p className="text-lg font-bold">
                {study.focusSessions} / {study.focusTarget}
              </p>
            </div>
            <div className="rounded-xl border bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">تقدم التكليف</p>
              <p className="text-lg font-bold">{study.assignmentProgress}%</p>
            </div>
            <div className="rounded-xl border bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">مراجعة المحاضرات</p>
              <p className="text-lg font-bold">{study.lecturesReviewed ? "تمت" : "لم تتم"}</p>
            </div>
          </div>
          {challenge ? <p className="mt-3 text-xs text-muted-foreground">{challenge.tip}</p> : null}
        </div>

        <StudyWorkspace
          onSessionCompleted={(minutes) => {
            setLifeData((prev) => ({
              ...prev,
              study: {
                ...prev.study,
                focusSessions: clamp(prev.study.focusSessions + 1, 0, 20),
                assignmentProgress: clamp(prev.study.assignmentProgress + (minutes >= 30 ? 10 : 5), 0, 100),
              },
            }));
            if (challenge) onChallengeComplete("study");
          }}
        />

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20"
              onClick={() => navigate("/workspace/pomodoro?section=study")}
            >
              فتح بومودورو قسم الدراسة
            </button>
          </div>

        <StepperRow
          label="المهام المكتمله "
          value={study.focusSessions}
          target={study.focusTarget}
          onMinus={() =>
            setLifeData((prev) => ({
              ...prev,
              study: { ...prev.study, focusSessions: clamp(prev.study.focusSessions - 1, 0, 20) },
            }))
          }
          onPlus={() =>
            setLifeData((prev) => ({
              ...prev,
              study: { ...prev.study, focusSessions: clamp(prev.study.focusSessions + 1, 0, 20) },
            }))
          }
        />

        <CheckRow
          label="مراجعة محاضرات اليوم"
          checked={study.lecturesReviewed}
          onChange={(value) => setLifeData((prev) => ({ ...prev, study: { ...prev.study, lecturesReviewed: value } }))}
        />

        <StepperRow
          label="تقدم التكليف (%)"
          value={study.assignmentProgress}
          target={100}
          onMinus={() =>
            setLifeData((prev) => ({
              ...prev,
              study: { ...prev.study, assignmentProgress: clamp(prev.study.assignmentProgress - 10, 0, 100) },
            }))
          }
          onPlus={() =>
            setLifeData((prev) => ({
              ...prev,
              study: { ...prev.study, assignmentProgress: clamp(prev.study.assignmentProgress + 10, 0, 100) },
            }))
          }
        />
      </CardContent>
    </Card>
  );
}
