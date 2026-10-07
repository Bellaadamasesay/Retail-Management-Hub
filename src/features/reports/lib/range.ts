import { useMemo, useState } from "react";
import { addDays, dayKey } from "@/features/sales/lib/sales";
import type { DayRange } from "@/components/shell/date-range-picker";
import { useShellStore } from "@/lib/stores/shell-store";
import { appNow } from "@/lib/time";

/**
 * The day range a report covers. Starts as the last 7 days ending on the date
 * chosen in the top bar (or today), like the approved screens.
 */
export function useReportRange() {
  const asOf = useShellStore((s) => s.asOf);
  const today = dayKey(appNow().toISOString());
  const end = asOf ?? today;
  const [range, setRange] = useState<DayRange>({ from: addDays(end, -6), to: end });
  const tuple = useMemo<[string, string]>(() => [range.from, range.to], [range.from, range.to]);
  return { range, setRange, tuple, today };
}
