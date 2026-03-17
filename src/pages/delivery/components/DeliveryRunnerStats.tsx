import { Award, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";

interface DeliveryRunnerStatsProps {
  completedMissions: number;
  totalEarnings: number;
}

export function DeliveryRunnerStats({ completedMissions, totalEarnings }: DeliveryRunnerStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card className="group relative flex items-center gap-3 overflow-hidden border border-navy/20 bg-card/20 p-4">
        <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors"></div>
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary z-10">
          <Award size={20} />
        </div>
        <div className="z-10">
          <p className="text-[9px] text-muted-foreground font-bold">المهام المكتملة</p>
          <p className="text-xl font-black text-foreground">{completedMissions}</p>
        </div>
      </Card>
      <Card className="group relative flex items-center gap-3 overflow-hidden border border-navy/20 bg-card p-4 shadow-hard-sm">
        <div className="absolute inset-0 bg-success/5 group-hover:bg-success/10 transition-colors"></div>
        <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center text-success z-10">
          <TrendingUp size={20} />
        </div>
        <div className="z-10">
          <p className="text-[9px] text-muted-foreground font-bold">إجمالي الأرباح</p>
          <p className="text-xl font-black text-foreground">{totalEarnings} <span className="text-[10px] text-muted-foreground">ج.م</span></p>
        </div>
      </Card>
    </div>
  );
}
