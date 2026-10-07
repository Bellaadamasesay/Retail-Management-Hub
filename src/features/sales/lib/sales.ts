import type { Sale } from "@/lib/api/types";

/** yyyy-mm-dd of a timestamp in the store's day. Freetown is UTC+0, so this is the ISO date. */
export const dayKey = (iso: string) => iso.slice(0, 10);

export function addDays(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export interface SalesTotals {
  /** Sales (transactions). */
  count: number;
  /** Units sold across all lines. */
  units: number;
  /** Money taken, minor units. */
  total: number;
  /** Average sale value, minor units. */
  average: number;
}

export function totalsOf(sales: readonly Sale[]): SalesTotals {
  const total = sales.reduce((n, s) => n + s.total, 0);
  const units = sales.reduce((n, s) => n + s.lines.reduce((m, l) => m + l.quantity, 0), 0);
  return { count: sales.length, units, total, average: sales.length ? Math.round(total / sales.length) : 0 };
}

export const salesOnDay = (sales: readonly Sale[], day: string) => sales.filter((s) => dayKey(s.createdAt) === day);

export const salesBetween = (sales: readonly Sale[], from: string, to: string) =>
  sales.filter((s) => {
    const day = dayKey(s.createdAt);
    return day >= from && day <= to;
  });

/** Percent change from `previous` to `current`, or undefined when there is nothing to compare with. */
export function percentChange(current: number, previous: number): number | undefined {
  if (previous <= 0) return undefined;
  return Math.round(((current - previous) / previous) * 100);
}

/** One value per day for the `days` days ending on `end`, oldest first (for sparklines). */
export function dailySeries(sales: readonly Sale[], end: string, days: number, pick: (totals: SalesTotals) => number): number[] {
  return Array.from({ length: days }, (_, i) => pick(totalsOf(salesOnDay(sales, addDays(end, i - (days - 1))))));
}

export type Period = "day" | "7d" | "30d" | "all";

/** The [from, to] day range for a period ending on `end`, or null for all time. */
export function periodRange(period: Period, end: string): [string, string] | null {
  if (period === "all") return null;
  if (period === "day") return [end, end];
  return [addDays(end, period === "7d" ? -6 : -29), end];
}

/** The same-length range immediately before `range`, to compare against. */
export function previousRange(range: [string, string]): [string, string] {
  const length = Math.round((Date.parse(`${range[1]}T00:00:00Z`) - Date.parse(`${range[0]}T00:00:00Z`)) / 86_400_000) + 1;
  return [addDays(range[0], -length), addDays(range[0], -1)];
}
