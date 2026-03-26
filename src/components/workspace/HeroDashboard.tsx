import { Target, TrendingUp, TriangleAlert, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TopStatCard } from "@/components/workspace/TopStatCard";
import type { DailyChallenge, SectionKey } from "@/lib/workspace/schema";

export function HeroDashboard({
  now,
  statusText,
  strongestLabel,
  strongestValue,
  weakestLabel,
  weakestValue,
  completedDone,
  completedTotal,
  overallProgress,
  dailyChallenge,
  onOpenWeakest,
  onOpenChallenge,
}: {
  now: Date;
  statusText: string;
  strongestLabel: string;
  strongestValue: number;
  weakestLabel: string;
  weakestValue: number;
  completedDone: number;
  completedTotal: number;
  overallProgress: number;
  dailyChallenge: DailyChallenge;
  onOpenWeakest: () => void;
  onOpenChallenge: (section: SectionKey) => void;
}) {
  return (
    <Card
      className="relative overflow-hidden border-[#3d5ab6] !text-white shadow-hard"
      style={{
        backgroundImage:
          "radial-gradient(circle at 20% 0%, rgba(56,189,248,.16), transparent 40%), linear-gradient(125deg, #132e5a 0%, #1f1f66 52%, #4d245c 100%)",
      }}
    >
      <CardHeader className="relative text-center">
        <div className="mx-auto mb-3 inline-flex items-center rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-1.5 text-sm font-bold text-amber-200">
          <Zap className="ml-2 h-4 w-4" />
          لوحة إدارة حياتك اليومية
        </div>
        <CardTitle className="text-4xl font-black leading-tight md:text-6xl">نظام حياتي</CardTitle>
        <CardDescription className="mt-2 text-base text-white/85 md:text-lg">
          {statusText} - {now.toLocaleDateString("ar-EG")} - {now.toLocaleTimeString("ar-EG")}
        </CardDescription>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Button className="bg-[#f6c037] px-6 text-base font-black text-slate-950 hover:bg-[#f2b41d]" onClick={onOpenWeakest}>
            ابدأ بالقسم الأضعف
          </Button>
          <Button
            variant="outline"
            className="border-white/35 bg-white/10 px-6 text-base font-black text-white hover:bg-white/20"
            onClick={() => onOpenChallenge(dailyChallenge.targetSection)}
          >
            {dailyChallenge.actionText}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <TopStatCard label="المنجز اليوم" value={`${completedDone} / ${completedTotal}`} icon={Target} />
          <TopStatCard label="القسم الأقوى" value={`${strongestLabel} (${strongestValue}%)`} icon={TrendingUp} />
          <TopStatCard label="يحتاج تدخل" value={`${weakestLabel} (${weakestValue}%)`} icon={TriangleAlert} />
          <TopStatCard label="التقدم الكلي" value={`${overallProgress}%`} icon={Zap} />
        </div>

        <div className="rounded-2xl border border-white/25 bg-slate-950/30 p-4 backdrop-blur-sm">
          <p className="text-sm font-bold text-amber-200">{dailyChallenge.title}</p>
          <p className="mt-1 text-sm text-white/85">{dailyChallenge.tip}</p>
          <Progress value={overallProgress} className="mt-3 h-2 bg-white/20" />
        </div>
      </CardContent>
    </Card>
  );
}

