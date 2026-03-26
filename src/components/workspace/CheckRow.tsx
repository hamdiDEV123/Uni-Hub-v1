import { CheckCircle2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border p-3">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-2">
        {checked ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : null}
        <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      </div>
    </div>
  );
}

