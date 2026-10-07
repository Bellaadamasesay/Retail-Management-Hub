import { MINOR_FACTOR } from "@/lib/format/money";

/**
 * Round amounts (in whole Leones) a customer is likely to hand over, used to
 * build the quick-amount chips. The product docs don't fix a note ladder, so
 * these are simple round steps that work for prices in the hundreds to
 * thousands of Leones.
 */
const ROUND_STEPS = [100, 500, 1000, 5000, 10_000];

/**
 * Chips for the cash field: the exact total, then the next three round
 * amounts above it. All values are minor units.
 */
export function quickAmounts(total: number): number[] {
  if (total <= 0) return [];
  const amounts = [total];
  const candidates = new Set<number>();
  for (const step of ROUND_STEPS) {
    const rounded = Math.ceil(total / MINOR_FACTOR / step) * step * MINOR_FACTOR;
    if (rounded > total) candidates.add(rounded);
  }
  return [...amounts, ...[...candidates].sort((a, b) => a - b).slice(0, 3)];
}

/** Change to give back: cash received minus the total, never negative. */
export function changeDue(total: number, tendered: number): number {
  return Number.isFinite(tendered) ? Math.max(0, tendered - total) : 0;
}

/** The sale can only be completed once the cash received covers the whole total. */
export function canComplete(total: number, tendered: number): boolean {
  return total > 0 && Number.isFinite(tendered) && tendered >= total;
}
