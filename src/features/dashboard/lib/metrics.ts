import { addDays, dayKey, salesBetween, totalsOf, type SalesTotals } from "@/features/sales/lib/sales";
import type { AuditEntry, Category, Product, Sale } from "@/lib/api/types";
import { storeHour } from "@/lib/format/date";
import { variantColour, variantLabel, variantStatus, type StockStatus } from "@/lib/inventory/stock";

export type DashboardRange = "today" | "week" | "month";

export const rangeLabels: Record<DashboardRange, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
};

/**
 * "This Week" and "This Month" are rolling windows (the last 7 and 30 days
 * ending on the chosen day), so a quiet start to the week or month still has
 * something to show.
 */
export function rangeFor(range: DashboardRange, day: string): [string, string] {
  if (range === "today") return [day, day];
  return [addDays(day, range === "week" ? -6 : -29), day];
}

const daysIn = ([from, to]: [string, string]) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

/** The window of the same length directly before, to compare against. */
export function previousWindow(window: [string, string]): [string, string] {
  return [addDays(window[0], -daysIn(window)), addDays(window[0], -1)];
}

export const comparisonLabel: Record<DashboardRange, string> = {
  today: "from yesterday",
  week: "from the previous 7 days",
  month: "from the previous 30 days",
};

export interface Kpi {
  current: SalesTotals;
  previous: SalesTotals;
}

export function kpisFor(sales: readonly Sale[], range: DashboardRange, day: string): Kpi {
  const window = rangeFor(range, day);
  return {
    current: totalsOf(salesBetween(sales, ...window)),
    previous: totalsOf(salesBetween(sales, ...previousWindow(window))),
  };
}

export const CATEGORIES: Category[] = ["Shoes", "Bags", "Accessories"];

export interface Bucket {
  key: string;
  label: string;
  Shoes: number;
  Bags: number;
  Accessories: number;
}

const emptyBucket = (key: string, label: string): Bucket => ({ key, label, Shoes: 0, Bags: 0, Accessories: 0 });

/** Trading hours shown on the Today chart. */
export const TRADING_HOURS = Array.from({ length: 10 }, (_, i) => 10 + i);

const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;

/** Revenue by category per hour (Today) or per day (Week, Month). Money in minor units. */
export function salesBuckets(
  sales: readonly Sale[],
  products: readonly Product[],
  window: [string, string],
  dayLabel: (day: string) => string,
): Bucket[] {
  const categoryOf = new Map(products.flatMap((p) => p.variants.map((v) => [v.id, p.category] as const)));
  const [from, to] = window;
  const singleDay = from === to;

  const buckets = singleDay
    ? TRADING_HOURS.map((h) => emptyBucket(String(h), hourLabel(h)))
    : Array.from({ length: daysIn(window) }, (_, i) => {
        const d = addDays(from, i);
        return emptyBucket(d, dayLabel(d));
      });
  const keyOf = singleDay ? (s: Sale) => String(storeHour(s.createdAt)) : (s: Sale) => dayKey(s.createdAt);

  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const sale of salesBetween(sales, from, to)) {
    const bucket = byKey.get(keyOf(sale));
    if (!bucket) continue;
    for (const line of sale.lines) {
      const category = categoryOf.get(line.variantId);
      if (category) bucket[category] += line.quantity * line.unitPrice;
    }
  }
  return buckets;
}

export interface TopProduct {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
}

/** Best sellers by revenue in the window. */
export function topProducts(
  sales: readonly Sale[],
  products: readonly Product[],
  [from, to]: [string, string],
  limit = 5,
): TopProduct[] {
  const owner = new Map(products.flatMap((p) => p.variants.map((v) => [v.id, p] as const)));
  const totals = new Map<string, TopProduct>();
  for (const sale of salesBetween(sales, from, to)) {
    for (const line of sale.lines) {
      const product = owner.get(line.variantId);
      if (!product) continue;
      const entry = totals.get(product.id) ?? { productId: product.id, name: product.name, quantity: 0, revenue: 0 };
      entry.quantity += line.quantity;
      entry.revenue += line.quantity * line.unitPrice;
      totals.set(product.id, entry);
    }
  }
  return [...totals.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

/** Revenue per category in the window. */
export function categoryRevenue(
  sales: readonly Sale[],
  products: readonly Product[],
  [from, to]: [string, string],
): Record<Category, number> {
  const owner = new Map(products.flatMap((p) => p.variants.map((v) => [v.id, p.category] as const)));
  const totals: Record<Category, number> = { Shoes: 0, Bags: 0, Accessories: 0 };
  for (const sale of salesBetween(sales, from, to)) {
    for (const line of sale.lines) {
      const category = owner.get(line.variantId);
      if (category) totals[category] += line.quantity * line.unitPrice;
    }
  }
  return totals;
}

/** Sales counts by weekday (Monday first) and trading hour over the last `weeks` weeks ending on `day`. */
export function peakHours(sales: readonly Sale[], day: string, weeks = 4): number[][] {
  const grid = Array.from({ length: 7 }, () => Array<number>(TRADING_HOURS.length).fill(0));
  for (const sale of salesBetween(sales, addDays(day, -(weeks * 7 - 1)), day)) {
    const weekday = (new Date(`${dayKey(sale.createdAt)}T12:00:00Z`).getUTCDay() + 6) % 7;
    const hour = storeHour(sale.createdAt) - TRADING_HOURS[0];
    if (hour >= 0 && hour < TRADING_HOURS.length) grid[weekday][hour] += 1;
  }
  return grid;
}

export interface StatusCounts {
  in: number;
  low: number;
  out: number;
  total: number;
}

/** Variants by stock health, for the inventory donut. */
export function inventoryStatus(products: readonly Product[]): StatusCounts {
  const counts: Record<StockStatus, number> = { in: 0, low: 0, out: 0 };
  for (const product of products) for (const v of product.variants) counts[variantStatus(v)] += 1;
  return { ...counts, total: counts.in + counts.low + counts.out };
}

export interface LowStockItem {
  variantId: string;
  productId: string;
  name: string;
  /** "Black · 42", or "" for a product sold in one version. */
  label: string;
  stock: number;
  threshold: number;
  colour?: string;
}

/** Variants at or under their reorder point, sold-out first, then the lowest stock. */
export function lowStock(products: readonly Product[], limit = 6): LowStockItem[] {
  const items: LowStockItem[] = [];
  for (const p of products) {
    if (!p.active) continue;
    for (const v of p.variants) {
      if (v.stock > v.reorderThreshold) continue;
      items.push({
        variantId: v.id,
        productId: p.id,
        name: p.name,
        label: variantLabel(v),
        stock: v.stock,
        threshold: v.reorderThreshold,
        colour: variantColour(v),
      });
    }
  }
  return items
    .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name) || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export type ActivityTone = "forest" | "sage" | "info" | "clay";

export const activityTone: Record<AuditEntry["action"], ActivityTone> = {
  "sale.create": "forest",
  "stock.intake": "sage",
  "stock.adjust": "info",
  "stock.take.submit": "clay",
  "stock.take.approve": "sage",
  "stock.take.cancel": "clay",
  "product.create": "info",
  "product.price_change": "info",
  "product.delete": "clay",
  "user.create": "info",
  "user.update": "info",
  "user.revoke": "clay",
  "user.restore": "sage",
  "user.reset_credentials": "info",
  "settings.update": "info",
};

export const activityTitle: Record<AuditEntry["action"], string> = {
  "sale.create": "Sale completed",
  "stock.intake": "Stock received",
  "stock.adjust": "Stock changed",
  "stock.take.submit": "Stock take submitted",
  "stock.take.approve": "Stock take approved",
  "stock.take.cancel": "Stock take cancelled",
  "product.create": "Product added",
  "product.price_change": "Price changed",
  "product.delete": "Product deleted",
  "user.create": "User added",
  "user.update": "User updated",
  "user.revoke": "Access revoked",
  "user.restore": "Access restored",
  "user.reset_credentials": "Credentials reset",
  "settings.update": "Settings changed",
};
