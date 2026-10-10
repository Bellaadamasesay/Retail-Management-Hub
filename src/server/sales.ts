import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Product, Sale, SaleInput, StockConflict } from "@/lib/api/types";
import { formatMoney } from "@/lib/format/money";
import { itemName } from "@/lib/inventory/stock";
import { audit } from "./audit";
import { getDb, schema } from "./db";
import { publish } from "./events";
import { fail, isUniqueViolation, isUuid } from "./http";
import { applyMovement } from "./stock";

const { sales, saleLines, variants, products } = schema;
type SaleRow = typeof sales.$inferSelect;
type LineRow = typeof saleLines.$inferSelect;

function toSale(s: SaleRow, lines: LineRow[]): Sale {
  return {
    id: s.id,
    receiptNumber: s.receiptNumber,
    createdAt: s.createdAt.toISOString(),
    cashierId: s.cashierId,
    lines: lines
      .filter((l) => l.saleId === s.id)
      .sort((a, b) => a.id - b.id)
      .map((l) => ({ variantId: l.variantId, name: l.name, quantity: l.quantity, unitPrice: l.unitPrice })),
    total: s.total,
    payment: { tendered: s.tendered, change: s.change },
  };
}

async function withLines(rows: SaleRow[]): Promise<Sale[]> {
  if (rows.length === 0) return [];
  const lines = await getDb().select().from(saleLines).where(inArray(saleLines.saleId, rows.map((r) => r.id)));
  return rows.map((r) => toSale(r, lines));
}

/** Sales history, oldest first; optionally one cashier's. */
export async function listSales(cashierId: string | null): Promise<Sale[]> {
  const rows = await getDb()
    .select()
    .from(sales)
    .where(cashierId ? eq(sales.cashierId, cashierId) : undefined)
    .orderBy(sales.createdAt);
  return withLines(rows);
}

export async function getSale(id: string): Promise<Sale | null> {
  const [row] = await getDb().select().from(sales).where(eq(sales.id, id));
  return row ? (await withLines([row]))[0] : null;
}

async function saleByKey(key: string): Promise<Sale | null> {
  const [row] = await getDb().select().from(sales).where(eq(sales.idempotencyKey, key));
  return row ? (await withLines([row]))[0] : null;
}

/**
 * Checkout, in one transaction: lock the variations, check stock, price from
 * the catalog, record the sale and its lines, take the units off the shelf
 * through the ledger, and audit it. Short stock changes nothing (409). A
 * repeated Idempotency-Key returns the sale it already made.
 */
export async function checkout(body: SaleInput, cashierId: string, key: string | null): Promise<{ sale: Sale; replay: boolean }> {
  if (key) {
    const existing = await saleByKey(key);
    if (existing) return { sale: existing, replay: true };
  }
  if (!Array.isArray(body?.lines) || body.lines.length === 0) throw fail(422, "The cart is empty.");

  const merged = new Map<string, number>();
  for (const line of body.lines) {
    if (!isUuid(line.variantId)) throw fail(422, "One of those items isn’t in the catalog any more.");
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) throw fail(422, "Quantities must be whole numbers above zero.");
    merged.set(line.variantId, (merged.get(line.variantId) ?? 0) + line.quantity);
  }

  try {
    const sale = await getDb().transaction(async (tx) => {
      const rows = await tx
        .select({ variant: variants, product: { name: products.name, price: products.price, active: products.active } })
        .from(variants)
        .innerJoin(products, and(eq(products.id, variants.productId), isNull(products.deletedAt)))
        .where(inArray(variants.id, [...merged.keys()]))
        .for("update", { of: variants });
      const byId = new Map(rows.map((r) => [r.variant.id, r]));

      for (const id of merged.keys()) {
        const entry = byId.get(id);
        if (!entry) throw fail(422, "One of those items isn’t in the catalog any more.");
        if (!entry.product.active) throw fail(422, `${entry.product.name} is no longer for sale.`);
      }
      const shortages = [...merged].flatMap(([variantId, requested]) => {
        const available = byId.get(variantId)!.variant.stock;
        return requested > available ? [{ variantId, requested, available }] : [];
      });
      if (shortages.length > 0) {
        const conflict: StockConflict = { message: "Someone else just sold some of these. Check the quantities and try again.", shortages };
        throw fail(409, conflict.message, conflict);
      }

      const lines = [...merged].map(([variantId, quantity]) => {
        const { variant, product } = byId.get(variantId)!;
        return { variantId, name: itemName(product as Pick<Product, "name">, variant), quantity, unitPrice: product.price };
      });
      const total = lines.reduce((n, l) => n + l.quantity * l.unitPrice, 0);
      if (!Number.isInteger(body.tendered) || body.tendered < total) {
        throw fail(422, `The cash received doesn’t cover the total of ${formatMoney(total)}.`);
      }

      const at = new Date();
      const [row] = await tx
        .insert(sales)
        .values({ cashierId, total, tendered: body.tendered, change: body.tendered - total, idempotencyKey: key, createdAt: at })
        .returning();
      const inserted = await tx.insert(saleLines).values(lines.map((l) => ({ ...l, saleId: row.id }))).returning();
      for (const line of lines) {
        await applyMovement(tx, { variantId: line.variantId, quantity: -line.quantity, type: "outgoing", reference: row.receiptNumber, actorId: cashierId, at });
      }
      const items = lines.reduce((n, l) => n + l.quantity, 0);
      await audit(tx, cashierId, {
        action: "sale.create",
        entity: row.receiptNumber,
        detail: `Sale of ${formatMoney(total)} (${items} ${items === 1 ? "item" : "items"})`,
      });
      return toSale(row, inserted);
    });
    publish({ type: "sale.created", saleId: sale.id, receiptNumber: sale.receiptNumber, total: sale.total, at: sale.createdAt });
    return { sale, replay: false };
  } catch (error) {
    // Two tries with the same key at the same moment: the second one gets the first one's sale.
    if (key && isUniqueViolation(error)) {
      const existing = await saleByKey(key);
      if (existing) return { sale: existing, replay: true };
    }
    throw error;
  }
}
