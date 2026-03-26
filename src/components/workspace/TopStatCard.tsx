import type { ComponentType } from "react";

export function TopStatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-white/30 bg-white/[0.07] p-4 backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-white/80">{label}</p>
        <Icon className="h-4 w-4 text-amber-200" />
      </div>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

