import type { MovementType, Product, Sale, StockIntake, StockMovement, StockTake } from "../types";

type Raw = Omit<StockMovement, "id" | "balance">;

/**
 * Builds the stock ledger from intakes, sales and approved counts, and
 * reconciles each variant's opening stock so every running balance is
 * consistent: it never dips below zero and ends at the variant's current stock
 * (or just above it, when a variant received more than it sold). The
 * variants' `stock` is adjusted in place to match.
 *
 * Fixture stock levels were generated independently of the sales and intakes,
 * so without this the Balance column of the movement report could not add up.
 */
export function buildLedger(db: {
  products: Product[];
  sales: Sale[];
  stockIntakes: StockIntake[];
  stockTakes: StockTake[];
}): StockMovement[] {
  const raw: Raw[] = [];

  for (const intake of db.stockIntakes) {
    for (const line of intake.lines) {
      raw.push({
        at: intake.receivedAt,
        type: "incoming",
        reference: intake.reference,
        variantId: line.variantId,
        quantity: line.quantity,
        actorId: intake.receivedBy,
      });
    }
  }

  for (const sale of db.sales) {
    for (const line of sale.lines) {
      raw.push({
        at: sale.createdAt,
        type: "outgoing",
        reference: sale.receiptNumber,
        variantId: line.variantId,
        quantity: -line.quantity,
        actorId: sale.cashierId,
      });
    }
  }

  for (const take of db.stockTakes) {
    if (take.status !== "approved" || !take.approvedAt || !take.approvedBy) continue;
    for (const line of take.lines) {
      if (line.counted === null || line.counted === line.expected) continue;
      raw.push({
        at: take.approvedAt,
        type: "adjustment",
        reference: take.reference,
        variantId: line.variantId,
        quantity: line.counted - line.expected,
        actorId: take.approvedBy,
      });
    }
  }

  raw.sort((a, b) => a.at.localeCompare(b.at));

  const byVariant = new Map<string, Raw[]>();
  for (const move of raw) {
    const list = byVariant.get(move.variantId) ?? [];
    list.push(move);
    byVariant.set(move.variantId, list);
  }

  const variants = new Map(db.products.flatMap((p) => p.variants).map((v) => [v.id, v]));
  const movements: StockMovement[] = [];

  for (const [variantId, moves] of byVariant) {
    const variant = variants.get(variantId);
    if (!variant) continue;

    let running = 0;
    let lowest = 0;
    for (const m of moves) {
      running += m.quantity;
      lowest = Math.min(lowest, running);
    }
    const net = running;
    // Start high enough never to go negative, and aim to end where the fixture said stock is.
    const opening = Math.max(variant.stock - net, -lowest);
    variant.stock = opening + net;

    let balance = opening;
    for (const m of moves) {
      balance += m.quantity;
      movements.push({ ...m, id: "", balance });
    }
  }

  movements.sort((a, b) => a.at.localeCompare(b.at) || a.variantId.localeCompare(b.variantId));
  movements.forEach((m, i) => {
    m.id = `mv-${String(i + 1).padStart(5, "0")}`;
  });
  return movements;
}

/** Applies a stock change to a variant and appends the matching ledger entry. Returns the new balance. */
export function applyMovement(
  ledger: StockMovement[],
  variant: { id: string; stock: number },
  entry: { at: string; type: MovementType; reference: string; quantity: number; actorId: string },
): StockMovement {
  variant.stock += entry.quantity;
  const movement: StockMovement = {
    id: `mv-${Date.now().toString(36)}-${ledger.length}`,
    at: entry.at,
    type: entry.type,
    reference: entry.reference,
    variantId: variant.id,
    quantity: entry.quantity,
    balance: variant.stock,
    actorId: entry.actorId,
  };
  ledger.push(movement);
  return movement;
}
