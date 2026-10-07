import type { StockTake, StockTakeLine, VarianceReason } from "@/lib/api/types";

export const reasonLabels: Record<VarianceReason, string> = {
  damage: "Damaged",
  loss: "Lost or stolen",
  count_error: "Counting error",
};

export const REASONS: VarianceReason[] = ["damage", "loss", "count_error"];

/** Counted minus expected; null while the line hasn't been counted. */
export function lineVariance(line: Pick<StockTakeLine, "expected" | "counted">): number | null {
  return line.counted === null ? null : line.counted - line.expected;
}

/** A counted line that differs from the system must carry a reason before it can be submitted. */
export function needsReason(line: StockTakeLine): boolean {
  const v = lineVariance(line);
  return v !== null && v !== 0 && !line.reason;
}

export interface CountSummary {
  total: number;
  counted: number;
  uncounted: number;
  /** Lines whose count differs from the system. */
  differences: number;
  /** Differences still missing a reason. */
  missingReasons: number;
  /** Net units: counted minus expected across counted lines. */
  netVariance: number;
  expectedUnits: number;
  countedUnits: number;
  /** True when every line is counted and every difference has a reason. */
  canSubmit: boolean;
}

export function summarize(lines: readonly StockTakeLine[]): CountSummary {
  let counted = 0;
  let differences = 0;
  let missingReasons = 0;
  let netVariance = 0;
  let expectedUnits = 0;
  let countedUnits = 0;
  for (const line of lines) {
    expectedUnits += line.expected;
    if (line.counted === null) continue;
    counted += 1;
    countedUnits += line.counted;
    const diff = line.counted - line.expected;
    netVariance += diff;
    if (diff !== 0) {
      differences += 1;
      if (!line.reason) missingReasons += 1;
    }
  }
  const total = lines.length;
  return {
    total,
    counted,
    uncounted: total - counted,
    differences,
    missingReasons,
    netVariance,
    expectedUnits,
    countedUnits,
    canSubmit: total > 0 && counted === total && missingReasons === 0,
  };
}

export const statusLabels: Record<StockTake["status"], string> = {
  in_progress: "In Progress",
  pending_approval: "Pending",
  approved: "Completed",
  cancelled: "Cancelled",
};

/** "+2", "-3" or "0", as shown in the Variance column. */
export function formatVariance(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}
