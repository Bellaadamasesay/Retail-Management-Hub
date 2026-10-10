import { addDays, dayKey, salesBetween } from "@/features/sales/lib/sales";
import type { Category, Product, Sale, StockMovement, StockTake, VarianceReason } from "@/lib/api/types";
import { variantLabel } from "@/lib/inventory/stock";

/** Every day from `from` to `to`, inclusive. */
export function eachDay([from, to]: [string, string]): string[] {
  const days: string[] = [];
  for (let d = from; d <= to && days.length < 400; d = addDays(d, 1)) days.push(d);
  return days;
}

type Owner = { product: Product; label: string };

function ownersOf(products: readonly Product[]) {
  return new Map<string, Owner>(
    products.flatMap((p) =>
      p.variants.map((v) => [v.id, { product: p, label: variantLabel(v) }] as const),
    ),
  );
}

/* ----------------------------- Revenue & profit ----------------------------- */

export interface RevenueDay {
  day: string;
  sales: number;
  units: number;
  revenue: number;
  /** Cost of goods sold, at current cost prices. */
  cost: number;
  profit: number;
}

/**
 * Revenue, cost of goods and profit per day. Sale lines don't store the cost
 * price, so cost uses each product's current cost: if a cost changes, past
 * profit is restated. The report says so on screen.
 */
export function revenueByDay(sales: readonly Sale[], products: readonly Product[], range: [string, string]): RevenueDay[] {
  const owners = ownersOf(products);
  const byDay = new Map(eachDay(range).map((day) => [day, { day, sales: 0, units: 0, revenue: 0, cost: 0, profit: 0 } as RevenueDay]));
  for (const sale of salesBetween(sales, ...range)) {
    const row = byDay.get(dayKey(sale.createdAt));
    if (!row) continue;
    row.sales += 1;
    for (const line of sale.lines) {
      row.units += line.quantity;
      row.revenue += line.quantity * line.unitPrice;
      row.cost += line.quantity * (owners.get(line.variantId)?.product.cost ?? 0);
    }
  }
  for (const row of byDay.values()) row.profit = row.revenue - row.cost;
  return [...byDay.values()];
}

export interface RevenueTotals {
  sales: number;
  units: number;
  revenue: number;
  cost: number;
  profit: number;
  /** Profit as a whole percent of revenue. */
  margin: number;
}

export function revenueTotals(rows: readonly RevenueDay[]): RevenueTotals {
  const t = rows.reduce(
    (a, r) => ({ sales: a.sales + r.sales, units: a.units + r.units, revenue: a.revenue + r.revenue, cost: a.cost + r.cost }),
    { sales: 0, units: 0, revenue: 0, cost: 0 },
  );
  const profit = t.revenue - t.cost;
  return { ...t, profit, margin: t.revenue > 0 ? Math.round((profit / t.revenue) * 100) : 0 };
}

export interface ItemRow {
  variantId: string;
  name: string;
  label: string;
  units: number;
  revenue: number;
  profit: number;
}

/** Best sellers (one row per variation) with their profit. */
export function topItems(sales: readonly Sale[], products: readonly Product[], range: [string, string], limit = 10): ItemRow[] {
  const owners = ownersOf(products);
  const rows = new Map<string, ItemRow>();
  for (const sale of salesBetween(sales, ...range)) {
    for (const line of sale.lines) {
      const owner = owners.get(line.variantId);
      if (!owner) continue;
      const row = rows.get(line.variantId) ?? { variantId: line.variantId, name: owner.product.name, label: owner.label, units: 0, revenue: 0, profit: 0 };
      row.units += line.quantity;
      row.revenue += line.quantity * line.unitPrice;
      row.profit += line.quantity * (line.unitPrice - owner.product.cost);
      rows.set(line.variantId, row);
    }
  }
  return [...rows.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

export function profitByCategory(sales: readonly Sale[], products: readonly Product[], range: [string, string]) {
  const owners = ownersOf(products);
  const result: Record<Category, { revenue: number; profit: number }> = {
    Shoes: { revenue: 0, profit: 0 },
    Bags: { revenue: 0, profit: 0 },
    Accessories: { revenue: 0, profit: 0 },
  };
  for (const sale of salesBetween(sales, ...range)) {
    for (const line of sale.lines) {
      const owner = owners.get(line.variantId);
      if (!owner) continue;
      result[owner.product.category].revenue += line.quantity * line.unitPrice;
      result[owner.product.category].profit += line.quantity * (line.unitPrice - owner.product.cost);
    }
  }
  return result;
}

/* --------------------------------- Variance --------------------------------- */

export interface VarianceRow {
  takeId: string;
  reference: string;
  date: string;
  status: StockTake["status"];
  product: string;
  label: string;
  variantId: string;
  expected: number;
  counted: number;
  /** Counted minus expected. */
  variance: number;
  reason: VarianceReason | undefined;
  /** variance x cost price: what the difference is worth, minor units (negative is a loss). */
  value: number;
}

/** Every counted difference from submitted or approved stock takes dated inside the range. */
export function varianceRows(takes: readonly StockTake[], products: readonly Product[], [from, to]: [string, string]): VarianceRow[] {
  const owners = ownersOf(products);
  const rows: VarianceRow[] = [];
  for (const take of takes) {
    if (take.status !== "approved" && take.status !== "pending_approval") continue;
    if (take.date < from || take.date > to) continue;
    for (const line of take.lines) {
      if (line.counted === null || line.counted === line.expected) continue;
      const owner = owners.get(line.variantId);
      const variance = line.counted - line.expected;
      rows.push({
        takeId: take.id,
        reference: take.reference,
        date: take.date,
        status: take.status,
        product: owner?.product.name ?? "Unknown item",
        label: owner?.label ?? "",
        variantId: line.variantId,
        expected: line.expected,
        counted: line.counted,
        variance,
        reason: line.reason,
        value: variance * (owner?.product.cost ?? 0),
      });
    }
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.product.localeCompare(b.product) || a.label.localeCompare(b.label));
}

export interface VarianceTotals {
  differences: number;
  netUnits: number;
  value: number;
  shortUnits: number;
  overUnits: number;
  byReason: Record<VarianceReason, number>;
}

export function varianceTotals(rows: readonly VarianceRow[]): VarianceTotals {
  const byReason: Record<VarianceReason, number> = { damage: 0, loss: 0, count_error: 0 };
  let netUnits = 0;
  let value = 0;
  let shortUnits = 0;
  let overUnits = 0;
  for (const r of rows) {
    netUnits += r.variance;
    value += r.value;
    if (r.variance < 0) shortUnits += -r.variance;
    else overUnits += r.variance;
    if (r.reason) byReason[r.reason] += 1;
  }
  return { differences: rows.length, netUnits, value, shortUnits, overUnits, byReason };
}

/* ------------------------------ Stock movement ------------------------------ */

export interface MovementRow {
  movement: StockMovement;
  product: string;
  label: string;
  productId: string;
}

export function movementRows(
  movements: readonly StockMovement[],
  products: readonly Product[],
  [from, to]: [string, string],
  filters: { productId?: string; type?: StockMovement["type"] } = {},
): MovementRow[] {
  const owners = new Map(products.flatMap((p) => p.variants.map((v) => [v.id, { p, v }] as const)));
  return movements
    .filter((m) => {
      const day = dayKey(m.at);
      if (day < from || day > to) return false;
      if (filters.type && m.type !== filters.type) return false;
      const owner = owners.get(m.variantId);
      return !filters.productId || owner?.p.id === filters.productId;
    })
    .map((movement) => {
      const owner = owners.get(movement.variantId);
      return {
        movement,
        product: owner?.p.name ?? "Unknown item",
        label: owner ? variantLabel(owner.v) : "",
        productId: owner?.p.id ?? "",
      };
    })
    .sort((a, b) => b.movement.at.localeCompare(a.movement.at));
}

export interface MovementTotals {
  incoming: number;
  outgoing: number;
  adjustments: number;
  /** All movements added up: incoming minus outgoing plus adjustments. */
  net: number;
}

export function movementTotals(rows: readonly MovementRow[]): MovementTotals {
  let incoming = 0;
  let outgoing = 0;
  let adjustments = 0;
  for (const { movement: m } of rows) {
    if (m.type === "incoming") incoming += m.quantity;
    else if (m.type === "outgoing") outgoing += -m.quantity;
    else adjustments += m.quantity;
  }
  return { incoming, outgoing, adjustments, net: incoming - outgoing + adjustments };
}

export interface MovementDay {
  day: string;
  label: string;
  incoming: number;
  outgoing: number;
}

export function movementByDay(rows: readonly MovementRow[], range: [string, string], dayLabel: (day: string) => string): MovementDay[] {
  const days = new Map(eachDay(range).map((day) => [day, { day, label: dayLabel(day), incoming: 0, outgoing: 0 } as MovementDay]));
  for (const { movement: m } of rows) {
    const row = days.get(dayKey(m.at));
    if (!row) continue;
    if (m.type === "incoming") row.incoming += m.quantity;
    else if (m.type === "outgoing") row.outgoing += -m.quantity;
  }
  return [...days.values()];
}

/** What the stock on the shelf cost: units x cost price, minor units. */
export function stockValue(products: readonly Product[]): number {
  return products.reduce((n, p) => n + p.cost * p.variants.reduce((u, v) => u + v.stock, 0), 0);
}

/* -------------------------------- Shift totals ------------------------------- */

export interface ShiftDay {
  day: string;
  sales: number;
  units: number;
  total: number;
  cashReceived: number;
  changeGiven: number;
  firstSale: string | null;
  lastSale: string | null;
}

/** A cashier's totals per day (their shifts): sales, units, money, cash taken and change given. */
export function shiftDays(sales: readonly Sale[], cashierId: string, range: [string, string]): ShiftDay[] {
  const rows = new Map(
    eachDay(range).map((day) => [day, { day, sales: 0, units: 0, total: 0, cashReceived: 0, changeGiven: 0, firstSale: null, lastSale: null } as ShiftDay]),
  );
  for (const sale of salesBetween(sales, ...range)) {
    if (sale.cashierId !== cashierId) continue;
    const row = rows.get(dayKey(sale.createdAt));
    if (!row) continue;
    row.sales += 1;
    row.units += sale.lines.reduce((n, l) => n + l.quantity, 0);
    row.total += sale.total;
    row.cashReceived += sale.payment.tendered;
    row.changeGiven += sale.payment.change;
    if (!row.firstSale || sale.createdAt < row.firstSale) row.firstSale = sale.createdAt;
    if (!row.lastSale || sale.createdAt > row.lastSale) row.lastSale = sale.createdAt;
  }
  return [...rows.values()].reverse();
}
