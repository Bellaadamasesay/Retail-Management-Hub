import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Category, MovementType, StockIntake, StockMovement, StockTake, StockTakeLine, VarianceReason } from "@/lib/api/types";
import { audit } from "./audit";
import { getDb, schema, type Tx } from "./db";
import { publish } from "./events";
import { fail, isUuid } from "./http";

const { variants, products, stockMovements, stockIntakes, intakeLines, stockTakes, stockTakeLines } = schema;

/**
 * Changes a variation's stock and records it in the ledger, in one step of the
 * caller's transaction. The database refuses to go below zero.
 */
export async function applyMovement(
  tx: Tx,
  entry: { variantId: string; quantity: number; type: MovementType; reference: string; actorId: string; at?: Date },
) {
  const [row] = await tx
    .update(variants)
    .set({ stock: sql`${variants.stock} + ${entry.quantity}` })
    .where(eq(variants.id, entry.variantId))
    .returning({ stock: variants.stock });
  if (!row) throw fail(422, "One of those items isn’t in the catalog any more.");
  await tx.insert(stockMovements).values({
    at: entry.at ?? new Date(),
    type: entry.type,
    reference: entry.reference,
    variantId: entry.variantId,
    quantity: entry.quantity,
    balance: row.stock,
    actorId: entry.actorId,
  });
  return row.stock;
}

const toMovement = (m: typeof stockMovements.$inferSelect): StockMovement => ({
  id: String(m.id),
  at: m.at.toISOString(),
  type: m.type,
  reference: m.reference,
  variantId: m.variantId,
  quantity: m.quantity,
  balance: m.balance,
  actorId: m.actorId,
});

/** The ledger, oldest first (optionally for one variation). */
export async function listMovements(variantId: string | null): Promise<StockMovement[]> {
  const rows = await getDb()
    .select()
    .from(stockMovements)
    .where(variantId ? eq(stockMovements.variantId, variantId) : undefined)
    .orderBy(stockMovements.at, stockMovements.id);
  return rows.map(toMovement);
}

/** Units on the shelf right now, for the given variations. */
export async function availability(ids: string[]): Promise<Record<string, number>> {
  const valid = ids.filter(isUuid);
  const rows = valid.length
    ? await getDb().select({ id: variants.id, stock: variants.stock }).from(variants).where(inArray(variants.id, valid))
    : [];
  const stock = new Map(rows.map((r) => [r.id, r.stock]));
  return Object.fromEntries(ids.map((id) => [id, stock.get(id) ?? 0]));
}

/* --------------------------------- Intakes --------------------------------- */

export interface IntakeBody {
  supplier: string;
  batchNote: string;
  lines: { variantId: string; quantity: number; unitCost: number }[];
}

export async function listIntakes(): Promise<StockIntake[]> {
  const db = getDb();
  const rows = await db.select().from(stockIntakes).orderBy(desc(stockIntakes.receivedAt));
  const lines = rows.length ? await db.select().from(intakeLines).where(inArray(intakeLines.intakeId, rows.map((r) => r.id))).orderBy(intakeLines.id) : [];
  return rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    receivedAt: r.receivedAt.toISOString(),
    supplier: r.supplier,
    batchNote: r.batchNote,
    receivedBy: r.receivedBy,
    lines: lines.filter((l) => l.intakeId === r.id).map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitCost: l.unitCost })),
  }));
}

export async function receiveIntake(body: IntakeBody, actorId: string): Promise<StockIntake> {
  if (!body.supplier?.trim()) throw fail(422, "Say which supplier this delivery came from.");
  if (!body.lines?.length) throw fail(422, "Add at least one item to the delivery.");
  for (const line of body.lines) {
    if (!isUuid(line.variantId)) throw fail(422, "One of those items isn’t in the catalog any more.");
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) throw fail(422, "Quantities must be whole numbers above zero.");
    if (!Number.isInteger(line.unitCost) || line.unitCost < 0) throw fail(422, "Enter the cost price for every item.");
  }
  const at = new Date();
  const intake = await getDb().transaction(async (tx) => {
    const [row] = await tx
      .insert(stockIntakes)
      .values({ supplier: body.supplier.trim(), batchNote: body.batchNote?.trim() ?? "", receivedBy: actorId, receivedAt: at })
      .returning();
    await tx.insert(intakeLines).values(body.lines.map((l) => ({ intakeId: row.id, variantId: l.variantId, quantity: l.quantity, unitCost: l.unitCost })));
    for (const line of body.lines) {
      await applyMovement(tx, { variantId: line.variantId, quantity: line.quantity, type: "incoming", reference: row.reference, actorId, at });
    }
    const units = body.lines.reduce((n, l) => n + l.quantity, 0);
    await audit(tx, actorId, {
      action: "stock.intake",
      entity: row.reference,
      detail: `Received ${units} ${units === 1 ? "unit" : "units"} from ${row.supplier}`,
    });
    return row;
  });
  publish({ type: "stock.changed", at: at.toISOString() });
  return {
    id: intake.id,
    reference: intake.reference,
    receivedAt: intake.receivedAt.toISOString(),
    supplier: intake.supplier,
    batchNote: intake.batchNote,
    receivedBy: intake.receivedBy,
    lines: body.lines.map((l) => ({ ...l })),
  };
}

/* ------------------------------- Stock takes ------------------------------- */

export interface CountLine {
  variantId: string;
  counted: number | null;
  reason?: VarianceReason;
}

const REASONS: VarianceReason[] = ["damage", "loss", "count_error"];

type TakeRow = typeof stockTakes.$inferSelect;
type TakeLineRow = typeof stockTakeLines.$inferSelect;

function toTake(t: TakeRow, lines: TakeLineRow[]): StockTake {
  return {
    id: t.id,
    reference: t.reference,
    name: t.name,
    scope: t.scope as Category | "All",
    date: t.date,
    createdBy: t.createdBy,
    createdAt: t.createdAt.toISOString(),
    status: t.status,
    ...(t.submittedAt ? { submittedAt: t.submittedAt.toISOString() } : {}),
    ...(t.approvedBy ? { approvedBy: t.approvedBy } : {}),
    ...(t.approvedAt ? { approvedAt: t.approvedAt.toISOString() } : {}),
    lines: lines
      .filter((l) => l.takeId === t.id)
      .sort((a, b) => a.id - b.id)
      .map<StockTakeLine>((l) => ({
        variantId: l.variantId,
        expected: l.expected,
        counted: l.counted,
        ...(l.reason ? { reason: l.reason } : {}),
      })),
  };
}

export async function listTakes(): Promise<StockTake[]> {
  const db = getDb();
  const rows = await db.select().from(stockTakes).orderBy(desc(stockTakes.createdAt));
  const lines = rows.length ? await db.select().from(stockTakeLines).where(inArray(stockTakeLines.takeId, rows.map((r) => r.id))) : [];
  return rows.map((r) => toTake(r, lines));
}

async function loadTake(tx: Tx, id: string, lock = false): Promise<StockTake> {
  const query = tx.select().from(stockTakes).where(eq(stockTakes.id, id));
  const [row] = lock ? await query.for("update") : await query;
  if (!row) throw fail(404, "Stock take not found");
  const lines = await tx.select().from(stockTakeLines).where(eq(stockTakeLines.takeId, id));
  return toTake(row, lines);
}

export async function getTake(id: string): Promise<StockTake> {
  return getDb().transaction((tx) => loadTake(tx, id));
}

export async function startTake(body: { name: string; scope: Category | "All" }, actorId: string): Promise<StockTake> {
  if (!body.name?.trim()) throw fail(422, "Give the stock take a name, e.g. “Bags section”.");
  const scope = body.scope ?? "All";
  return getDb().transaction(async (tx) => {
    const open = await tx.select().from(stockTakes).where(eq(stockTakes.status, "in_progress"));
    const clash = open.find((t) => t.scope === scope || t.scope === "All" || scope === "All");
    if (clash) {
      throw fail(409, `${clash.reference} (${clash.name}) is already being counted and overlaps this one. Finish or cancel it first.`);
    }
    const counted = await tx
      .select({ id: variants.id, stock: variants.stock })
      .from(variants)
      .innerJoin(products, eq(products.id, variants.productId))
      .where(and(sql`${products.deletedAt} is null`, scope === "All" ? undefined : eq(products.category, scope)))
      .orderBy(products.name, variants.position);
    if (counted.length === 0) throw fail(422, "There is nothing in that part of the catalog to count.");
    const now = new Date();
    const [row] = await tx
      .insert(stockTakes)
      .values({ name: body.name.trim(), scope, date: now.toISOString().slice(0, 10), createdBy: actorId, createdAt: now })
      .returning();
    const lines = await tx
      .insert(stockTakeLines)
      .values(counted.map((v) => ({ takeId: row.id, variantId: v.id, expected: v.stock, counted: null })))
      .returning();
    return toTake(row, lines);
  });
}

/** Merge posted counts into a take's lines (ignoring variations that aren't part of the count). */
async function saveCounts(tx: Tx, take: StockTake, counts: CountLine[]) {
  const byId = new Map(counts.map((c) => [c.variantId, c]));
  for (const line of take.lines) {
    const posted = byId.get(line.variantId);
    if (!posted) continue;
    const counted = posted.counted === null ? null : Math.max(0, Math.floor(Number(posted.counted) || 0));
    const reason = counted !== null && counted !== line.expected && posted.reason && REASONS.includes(posted.reason) ? posted.reason : null;
    await tx
      .update(stockTakeLines)
      .set({ counted, reason })
      .where(and(eq(stockTakeLines.takeId, take.id), eq(stockTakeLines.variantId, line.variantId)));
    line.counted = counted;
    if (reason) line.reason = reason;
    else delete line.reason;
  }
}

export async function saveTake(id: string, counts: CountLine[]): Promise<StockTake> {
  return getDb().transaction(async (tx) => {
    const take = await loadTake(tx, id, true);
    if (take.status !== "in_progress") throw fail(409, `${take.reference} is no longer being counted.`);
    await saveCounts(tx, take, counts);
    return take;
  });
}

export async function submitTake(id: string, counts: CountLine[], actorId: string): Promise<StockTake> {
  return getDb().transaction(async (tx) => {
    const take = await loadTake(tx, id, true);
    if (take.status !== "in_progress") throw fail(409, `${take.reference} has already been submitted or closed.`);
    await saveCounts(tx, take, counts);
    const uncounted = take.lines.filter((l) => l.counted === null).length;
    if (uncounted > 0) throw fail(422, `${uncounted} ${uncounted === 1 ? "item hasn’t" : "items haven’t"} been counted yet.`);
    const missingReason = take.lines.filter((l) => l.counted !== l.expected && !l.reason).length;
    if (missingReason > 0) {
      throw fail(422, `${missingReason} ${missingReason === 1 ? "difference needs" : "differences need"} a reason (damage, loss or counting error).`);
    }
    const submittedAt = new Date();
    await tx.update(stockTakes).set({ status: "pending_approval", submittedAt }).where(eq(stockTakes.id, id));
    const variances = take.lines.filter((l) => l.counted !== l.expected).length;
    await audit(tx, actorId, {
      action: "stock.take.submit",
      entity: take.reference,
      detail: `Submitted ${take.name.toLowerCase()} count with ${variances} ${variances === 1 ? "variance" : "variances"}`,
    });
    return { ...take, status: "pending_approval", submittedAt: submittedAt.toISOString() };
  });
}

/** Applies the counted figures to stock (whatever sold or arrived since the count began) and closes the count. */
export async function approveTake(id: string, actorId: string): Promise<StockTake> {
  const at = new Date();
  const take = await getDb().transaction(async (tx) => {
    const take = await loadTake(tx, id, true);
    if (take.status !== "pending_approval") throw fail(409, `${take.reference} isn’t waiting for approval.`);
    for (const line of take.lines) {
      if (line.counted === null || line.counted === line.expected) continue;
      const [current] = await tx.select({ stock: variants.stock }).from(variants).where(eq(variants.id, line.variantId)).for("update");
      if (!current || current.stock === line.counted) continue;
      await applyMovement(tx, { variantId: line.variantId, quantity: line.counted - current.stock, type: "adjustment", reference: take.reference, actorId, at });
    }
    await tx.update(stockTakes).set({ status: "approved", approvedBy: actorId, approvedAt: at }).where(eq(stockTakes.id, id));
    await audit(tx, actorId, { action: "stock.take.approve", entity: take.reference, detail: `Approved ${take.name.toLowerCase()} count` });
    return { ...take, status: "approved" as const, approvedBy: actorId, approvedAt: at.toISOString() };
  });
  publish({ type: "stock.changed", at: at.toISOString() });
  return take;
}

/** Abandon a count in progress, or (Super Admin) turn down one waiting for approval. */
export async function cancelTake(id: string, actor: { id: string; canApprove: boolean }): Promise<StockTake> {
  return getDb().transaction(async (tx) => {
    const take = await loadTake(tx, id, true);
    if (take.status === "approved" || take.status === "cancelled") throw fail(409, `${take.reference} is already closed.`);
    if (take.status === "pending_approval" && !actor.canApprove) {
      throw fail(403, "Only a Super Admin can turn down a count that is waiting for approval.");
    }
    await tx.update(stockTakes).set({ status: "cancelled" }).where(eq(stockTakes.id, id));
    await audit(tx, actor.id, { action: "stock.take.cancel", entity: take.reference, detail: `Cancelled ${take.name.toLowerCase()} count` });
    return { ...take, status: "cancelled" as const };
  });
}
