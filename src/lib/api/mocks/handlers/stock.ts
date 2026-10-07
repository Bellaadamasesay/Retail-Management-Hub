import { HttpResponse } from "msw";
import type { Category, StockIntake, StockTake, StockTakeLine, VarianceReason } from "../../types";
import { getDb, saveDb } from "../db";
import { applyMovement } from "../ledger";
import { publish } from "@/lib/realtime";
import { actorOf, audit, fail, NOW, route } from "./common";

export interface IntakeBody {
  supplier: string;
  batchNote: string;
  lines: { variantId: string; quantity: number; unitCost: number }[];
}

export interface CountLine {
  variantId: string;
  counted: number | null;
  reason?: VarianceReason;
}

const REASONS: VarianceReason[] = ["damage", "loss", "count_error"];

function findVariant(variantId: string) {
  return getDb()
    .products.flatMap((p) => p.variants)
    .find((v) => v.id === variantId);
}

/** Merge posted counts into a take's lines (ignoring variants that aren't part of the count). */
function mergeCounts(take: StockTake, counts: CountLine[]) {
  const byId = new Map(counts.map((c) => [c.variantId, c]));
  take.lines = take.lines.map<StockTakeLine>((line) => {
    const posted = byId.get(line.variantId);
    if (!posted) return line;
    const counted = posted.counted === null ? null : Math.max(0, Math.floor(posted.counted));
    const different = counted !== null && counted !== line.expected;
    return {
      variantId: line.variantId,
      expected: line.expected,
      counted,
      ...(different && posted.reason ? { reason: posted.reason } : {}),
    };
  });
}

export const stockHandlers = [
  route.get("/api/stock/movements", ({ request }) => {
    const url = new URL(request.url);
    const variantId = url.searchParams.get("variantId");
    const { movements } = getDb();
    return HttpResponse.json(variantId ? movements.filter((m) => m.variantId === variantId) : movements);
  }),

  route.get("/api/stock/intakes", () => HttpResponse.json(getDb().stockIntakes)),

  route.post("/api/stock/intakes", async ({ request }) => {
    const body = (await request.json()) as IntakeBody;
    const db = getDb();
    if (!body.supplier?.trim()) return fail(422, "Say which supplier this delivery came from.");
    if (!body.lines?.length) return fail(422, "Add at least one item to the delivery.");
    for (const line of body.lines) {
      if (!findVariant(line.variantId)) return fail(422, "One of those items isn’t in the catalog any more.");
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) return fail(422, "Quantities must be whole numbers above zero.");
      if (!Number.isInteger(line.unitCost) || line.unitCost < 0) return fail(422, "Enter the cost price for every item.");
    }

    const at = NOW();
    const actorId = actorOf(request);
    const number = String(db.stockIntakes.length + 1).padStart(3, "0");
    const intake: StockIntake = {
      id: `in-${number}`,
      reference: `INT-${number}`,
      receivedAt: at,
      supplier: body.supplier.trim(),
      batchNote: body.batchNote?.trim() ?? "",
      receivedBy: actorId,
      lines: body.lines.map((l) => ({ ...l })),
    };
    db.stockIntakes.unshift(intake);
    for (const line of intake.lines) {
      applyMovement(db.movements, findVariant(line.variantId)!, {
        at,
        type: "incoming",
        reference: intake.reference,
        quantity: line.quantity,
        actorId,
      });
    }
    const units = intake.lines.reduce((n, l) => n + l.quantity, 0);
    audit(request, {
      action: "stock.intake",
      entity: intake.reference,
      detail: `Received ${units} ${units === 1 ? "unit" : "units"} from ${intake.supplier}`,
    });
    saveDb();
    publish({ type: "stock.changed", at });
    return HttpResponse.json(intake, { status: 201 });
  }),

  route.get("/api/stock/takes", () => HttpResponse.json(getDb().stockTakes)),

  route.get("/api/stock/takes/:id", ({ params }) => {
    const take = getDb().stockTakes.find((t) => t.id === params.id);
    return take ? HttpResponse.json(take) : fail(404, "Stock take not found");
  }),

  route.post("/api/stock/takes", async ({ request }) => {
    const body = (await request.json()) as { name: string; scope: Category | "All" };
    const db = getDb();
    if (!body.name?.trim()) return fail(422, "Give the stock take a name, e.g. “Bags section”.");
    const open = db.stockTakes.find(
      (t) => t.status === "in_progress" && (t.scope === body.scope || t.scope === "All" || body.scope === "All"),
    );
    if (open) {
      return fail(409, `${open.reference} (${open.name}) is already being counted and overlaps this one. Finish or cancel it first.`);
    }

    const productsInScope = db.products.filter((p) => body.scope === "All" || p.category === body.scope);
    const lines: StockTakeLine[] = productsInScope.flatMap((p) =>
      p.variants.map((v) => ({ variantId: v.id, expected: v.stock, counted: null })),
    );
    if (lines.length === 0) return fail(422, "There is nothing in that part of the catalog to count.");

    const at = NOW();
    const number = db.stockTakes.length + 1;
    const take: StockTake = {
      id: `st-${String(number).padStart(3, "0")}`,
      reference: `STK-${String(number).padStart(4, "0")}`,
      name: body.name.trim(),
      scope: body.scope,
      date: at.slice(0, 10),
      createdBy: actorOf(request),
      createdAt: at,
      status: "in_progress",
      lines,
    };
    db.stockTakes.unshift(take);
    saveDb();
    return HttpResponse.json(take, { status: 201 });
  }),

  /** Save progress on a count (also what draft autosave calls when the network is back). */
  route.put("/api/stock/takes/:id", async ({ params, request }) => {
    const take = getDb().stockTakes.find((t) => t.id === params.id);
    if (!take) return fail(404, "Stock take not found");
    if (take.status !== "in_progress") return fail(409, `${take.reference} is no longer being counted.`);
    mergeCounts(take, ((await request.json()) as { lines: CountLine[] }).lines ?? []);
    saveDb();
    return HttpResponse.json(take);
  }),

  route.post("/api/stock/takes/:id/submit", async ({ params, request }) => {
    const db = getDb();
    const take = db.stockTakes.find((t) => t.id === params.id);
    if (!take) return fail(404, "Stock take not found");
    if (take.status !== "in_progress") return fail(409, `${take.reference} has already been submitted or closed.`);
    mergeCounts(take, ((await request.json()) as { lines: CountLine[] }).lines ?? []);

    const uncounted = take.lines.filter((l) => l.counted === null).length;
    if (uncounted > 0) return fail(422, `${uncounted} ${uncounted === 1 ? "item hasn’t" : "items haven’t"} been counted yet.`);
    const missingReason = take.lines.filter(
      (l) => l.counted !== l.expected && !(l.reason && REASONS.includes(l.reason)),
    ).length;
    if (missingReason > 0) {
      return fail(422, `${missingReason} ${missingReason === 1 ? "difference needs" : "differences need"} a reason (damage, loss or counting error).`);
    }

    take.status = "pending_approval";
    take.submittedAt = NOW();
    const variances = take.lines.filter((l) => l.counted !== l.expected).length;
    audit(request, {
      action: "stock.take.submit",
      entity: take.reference,
      detail: `Submitted ${take.name.toLowerCase()} count with ${variances} ${variances === 1 ? "variance" : "variances"}`,
    });
    saveDb();
    return HttpResponse.json(take);
  }),

  /** Super Admin only: applies the differences to stock and closes the count. */
  route.post("/api/stock/takes/:id/approve", ({ params, request }) => {
    const db = getDb();
    const actor = db.users.find((u) => u.id === actorOf(request));
    if (actor?.role !== "SUPER_ADMIN") return fail(403, "Only a Super Admin can approve a stock take.");
    const take = db.stockTakes.find((t) => t.id === params.id);
    if (!take) return fail(404, "Stock take not found");
    if (take.status !== "pending_approval") return fail(409, `${take.reference} isn’t waiting for approval.`);

    const at = NOW();
    for (const line of take.lines) {
      if (line.counted === null || line.counted === line.expected) continue;
      const variant = findVariant(line.variantId);
      if (!variant) continue;
      // Correct to the counted figure, whatever has been sold or received since the count began.
      applyMovement(db.movements, variant, {
        at,
        type: "adjustment",
        reference: take.reference,
        quantity: line.counted - variant.stock,
        actorId: actor.id,
      });
    }
    take.status = "approved";
    take.approvedBy = actor.id;
    take.approvedAt = at;
    audit(request, {
      action: "stock.take.approve",
      entity: take.reference,
      detail: `Approved ${take.name.toLowerCase()} count`,
    });
    saveDb();
    publish({ type: "stock.changed", at });
    return HttpResponse.json(take);
  }),

  /** Abandon a count in progress, or (Super Admin) turn down one waiting for approval. */
  route.post("/api/stock/takes/:id/cancel", ({ params, request }) => {
    const db = getDb();
    const actor = db.users.find((u) => u.id === actorOf(request));
    const take = db.stockTakes.find((t) => t.id === params.id);
    if (!take) return fail(404, "Stock take not found");
    if (take.status === "approved" || take.status === "cancelled") {
      return fail(409, `${take.reference} is already closed.`);
    }
    if (take.status === "pending_approval" && actor?.role !== "SUPER_ADMIN") {
      return fail(403, "Only a Super Admin can turn down a count that is waiting for approval.");
    }
    take.status = "cancelled";
    audit(request, {
      action: "stock.take.cancel",
      entity: take.reference,
      detail: `Cancelled ${take.name.toLowerCase()} count`,
    });
    saveDb();
    return HttpResponse.json(take);
  }),
];
