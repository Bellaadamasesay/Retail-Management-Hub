import { HttpResponse } from "msw";
import { formatMoney } from "@/lib/format/money";
import type { Sale, SaleInput, StockConflict } from "../../types";
import { getDb, saveDb } from "../db";
import { applyMovement } from "../ledger";
import { publish } from "@/lib/realtime";
import { actorOf, audit, fail, NOW, route } from "./common";

export const salesHandlers = [
  route.get("/api/settings", () => HttpResponse.json(getDb().settings)),

  /**
   * Sales history. Cashiers only ever get their own sales, whatever they ask
   * for; Super Admins get everything (optionally narrowed to one cashier).
   */
  route.get("/api/sales", ({ request }) => {
    const db = getDb();
    const actor = db.users.find((u) => u.id === actorOf(request));
    const asked = new URL(request.url).searchParams.get("cashierId");
    const cashierId = actor?.role === "CASHIER" ? actor.id : asked;
    if (actor?.role === "INVENTORY_KEEPER") return fail(403, "Sales history isn’t available to your role.");
    return HttpResponse.json(cashierId ? db.sales.filter((s) => s.cashierId === cashierId) : db.sales);
  }),

  route.get("/api/sales/:id", ({ params, request }) => {
    const db = getDb();
    const actor = db.users.find((u) => u.id === actorOf(request));
    const sale = db.sales.find((s) => s.id === params.id);
    if (!sale) return fail(404, "Sale not found");
    if (actor?.role === "INVENTORY_KEEPER" || (actor?.role === "CASHIER" && sale.cashierId !== actor.id)) {
      return fail(403, "You can only open your own sales.");
    }
    return HttpResponse.json(sale);
  }),

  /** Live stock for the cart: { [variantId]: unitsOnShelf }. */
  route.get("/api/stock/availability", ({ request }) => {
    const ids = (new URL(request.url).searchParams.get("variantIds") ?? "").split(",").filter(Boolean);
    const variants = new Map(getDb().products.flatMap((p) => p.variants).map((v) => [v.id, v.stock]));
    return HttpResponse.json(Object.fromEntries(ids.map((id) => [id, variants.get(id) ?? 0])));
  }),

  /**
   * Checkout. One atomic step: check stock, price from the catalog, take the
   * cash, decrement stock, write the ledger and audit trail. If anything is
   * short nothing changes (409). A repeated Idempotency-Key returns the sale
   * it already made instead of selling again.
   */
  route.post("/api/sales", async ({ request }) => {
    const db = getDb();
    const key = request.headers.get("idempotency-key");
    if (key && db.idempotency[key]) {
      const existing = db.sales.find((s) => s.id === db.idempotency[key]);
      if (existing) return HttpResponse.json(existing, { status: 200 });
    }

    const body = (await request.json()) as SaleInput;
    if (!body.lines?.length) return fail(422, "The cart is empty.");

    const variants = new Map(
      db.products.flatMap((p) => p.variants.map((v) => [v.id, { variant: v, product: p }] as const)),
    );

    const merged = new Map<string, number>();
    for (const line of body.lines) {
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) return fail(422, "Quantities must be whole numbers above zero.");
      merged.set(line.variantId, (merged.get(line.variantId) ?? 0) + line.quantity);
    }

    for (const id of merged.keys()) {
      const entry = variants.get(id);
      if (!entry) return fail(422, "One of those items isn’t in the catalog any more.");
      if (!entry.product.active) return fail(422, `${entry.product.name} is no longer for sale.`);
    }

    const shortages = [...merged].flatMap(([variantId, requested]) => {
      const available = variants.get(variantId)!.variant.stock;
      return requested > available ? [{ variantId, requested, available }] : [];
    });
    if (shortages.length > 0) {
      const body: StockConflict = {
        message: "Someone else just sold some of these. Check the quantities and try again.",
        shortages,
      };
      return HttpResponse.json(body, { status: 409 });
    }

    const lines = [...merged].map(([variantId, quantity]) => {
      const { variant, product } = variants.get(variantId)!;
      const label = variant.size === "One size" ? variant.colour : `${variant.colour} · ${variant.size}`;
      return { variantId, name: `${product.name} · ${label}`, sku: variant.sku, quantity, unitPrice: product.price };
    });
    const total = lines.reduce((n, l) => n + l.quantity * l.unitPrice, 0);
    if (!Number.isInteger(body.tendered) || body.tendered < total) {
      return fail(422, `The cash received doesn’t cover the total of ${formatMoney(total)}.`);
    }

    const at = NOW();
    const actorId = actorOf(request);
    const number = Math.max(1000, ...db.sales.map((s) => Number(s.receiptNumber.replace("RC-", "")) || 0)) + 1;
    const sale: Sale = {
      id: `s-${number}`,
      receiptNumber: `RC-${number}`,
      createdAt: at,
      cashierId: actorId,
      lines,
      total,
      payment: { tendered: body.tendered, change: body.tendered - total },
    };
    db.sales.push(sale);
    for (const line of lines) {
      applyMovement(db.movements, variants.get(line.variantId)!.variant, {
        at,
        type: "outgoing",
        reference: sale.receiptNumber,
        quantity: -line.quantity,
        actorId,
      });
    }
    const items = lines.reduce((n, l) => n + l.quantity, 0);
    audit(request, {
      action: "sale.create",
      entity: sale.receiptNumber,
      detail: `Sale of ${formatMoney(total)} (${items} ${items === 1 ? "item" : "items"})`,
    });
    if (key) db.idempotency[key] = sale.id;
    saveDb();
    publish({ type: "sale.created", saleId: sale.id, receiptNumber: sale.receiptNumber, total: sale.total, at });
    return HttpResponse.json(sale, { status: 201 });
  }),
];
