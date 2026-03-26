import type { ReligiousState } from "@/lib/workspace/schema";
import { CheckRow } from "@/components/workspace/CheckRow";

export function PrayerChecks({
  state,
  onToggle,
}: {
  state: ReligiousState;
  onToggle: (
    key: keyof Pick<
      ReligiousState,
      "fajr" | "dhuhr" | "asr" | "maghrib" | "isha" | "adhkarMorning" | "adhkarEvening"
    >,
    value: boolean
  ) => void;
}) {
  return (
    <div className="space-y-3">
      <CheckRow label="صلاة الفجر" checked={state.fajr} onChange={(value) => onToggle("fajr", value)} />
      <CheckRow label="صلاة الظهر" checked={state.dhuhr} onChange={(value) => onToggle("dhuhr", value)} />
      <CheckRow label="صلاة العصر" checked={state.asr} onChange={(value) => onToggle("asr", value)} />
      <CheckRow label="صلاة المغرب" checked={state.maghrib} onChange={(value) => onToggle("maghrib", value)} />
      <CheckRow label="صلاة العشاء" checked={state.isha} onChange={(value) => onToggle("isha", value)} />
      <CheckRow label="أذكار الصباح" checked={state.adhkarMorning} onChange={(value) => onToggle("adhkarMorning", value)} />
      <CheckRow label="أذكار المساء" checked={state.adhkarEvening} onChange={(value) => onToggle("adhkarEvening", value)} />
    </div>
  );
}

