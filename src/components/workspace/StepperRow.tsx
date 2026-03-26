import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { clamp } from "@/lib/workspace/schema";

export function StepperRow({
  label,
  value,
  target,
  onMinus,
  onPlus,
}: {
  label: string;
  value: number;
  target: number;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-sm font-semibold">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onMinus}>
          -
        </Button>
        <p className="min-w-20 text-center font-bold">
          {value} / {target}
        </p>
        <Button variant="outline" size="sm" onClick={onPlus}>
          +
        </Button>
      </div>
      <Progress value={Math.round(clamp(value / target, 0, 1) * 100)} className="mt-3 h-2" />
    </div>
  );
}

