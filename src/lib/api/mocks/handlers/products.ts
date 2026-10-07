import { HttpResponse } from "msw";
import { formatMoney } from "@/lib/format/money";
import type { Product, ProductInput, Variant } from "../../types";
import { getDb, saveDb } from "../db";
import { audit, fail, NOW, route } from "./common";


/** Stable variant id: the product id plus the SKU's colour/size parts. */
function variantId(productId: string, sku: string, code: string) {
  return `${productId}-${sku.slice(code.length + 1)}`.toLowerCase();
}

/** Returns a problem description, or null when the input is acceptable. */
function validate(input: ProductInput, existing: Product[], selfId?: string): string | null {
  if (!input.name.trim()) return "Give the product a name.";
  if (!/^[A-Z0-9]{2,6}$/.test(input.code)) return "The product code must be 2 to 6 capital letters or digits.";
  if (!Number.isInteger(input.price) || input.price <= 0) return "Enter a selling price above zero.";
  if (!Number.isInteger(input.cost) || input.cost < 0) return "Enter the cost price.";
  if (input.variants.length === 0) return "Add at least one colour and size.";

  const others = existing.filter((p) => p.id !== selfId);
  if (others.some((p) => p.code === input.code)) return `The code ${input.code} is already used by another product.`;

  const skus = new Set(others.flatMap((p) => p.variants.map((v) => v.sku)));
  const seenSku = new Set<string>();
  for (const v of input.variants) {
    if (skus.has(v.sku) || seenSku.has(v.sku)) return `The SKU ${v.sku} is already in use.`;
    seenSku.add(v.sku);
  }
  return null;
}

/** Catalog endpoints. */
export const productHandlers = [
  route.get("/api/products", () => HttpResponse.json(getDb().products)),

  route.get("/api/products/:id", ({ params }) => {
    const product = getDb().products.find((p) => p.id === params.id);
    return product ? HttpResponse.json(product) : fail(404, "Product not found");
  }),

  route.post("/api/products", async ({ request }) => {
    const input = (await request.json()) as ProductInput;
    const db = getDb();
    const problem = validate(input, db.products);
    if (problem) return fail(422, problem);

    const id = `p-${input.code.toLowerCase()}`;
    const now = NOW();
    const product: Product = {
      id,
      code: input.code,
      name: input.name.trim(),
      category: input.category,
      description: input.description.trim(),
      price: input.price,
      cost: input.cost,
      active: input.active,
      createdAt: now,
      updatedAt: now,
      variants: input.variants.map<Variant>((v) => ({
        id: variantId(id, v.sku, input.code),
        productId: id,
        sku: v.sku,
        colour: v.colour,
        size: v.size,
        stock: 0,
        reorderThreshold: v.reorderThreshold,
      })),
    };
    db.products.unshift(product);
    audit(request, {
      action: "product.create",
      entity: id,
      detail: `Added ${product.name} with ${product.variants.length} ${product.variants.length === 1 ? "variant" : "variants"}`,
    });
    saveDb();
    return HttpResponse.json(product, { status: 201 });
  }),

  /** Undo for a delete: put the exact product back. */
  route.post("/api/products/restore", async ({ request }) => {
    const product = (await request.json()) as Product;
    const db = getDb();
    if (db.products.some((p) => p.id === product.id)) return fail(409, "That product is already back.");
    db.products.unshift(product);
    audit(request, { action: "product.create", entity: product.id, detail: `Restored ${product.name}` });
    saveDb();
    return HttpResponse.json(product, { status: 201 });
  }),

  route.put("/api/products/:id", async ({ params, request }) => {
    const input = (await request.json()) as ProductInput;
    const db = getDb();
    const index = db.products.findIndex((p) => p.id === params.id);
    if (index < 0) return fail(404, "Product not found");
    const current = db.products[index];
    const problem = validate(input, db.products, current.id);
    if (problem) return fail(422, problem);

    const variants = input.variants.map<Variant>((v) => {
      const kept = current.variants.find((c) => c.id === v.id);
      return {
        id: kept?.id ?? variantId(current.id, v.sku, input.code),
        productId: current.id,
        sku: v.sku,
        colour: v.colour,
        size: v.size,
        // Stock only moves through intake, stock take and sales.
        stock: kept?.stock ?? 0,
        reorderThreshold: v.reorderThreshold,
      };
    });

    const updated: Product = {
      ...current,
      code: input.code,
      name: input.name.trim(),
      category: input.category,
      description: input.description.trim(),
      price: input.price,
      cost: input.cost,
      active: input.active,
      variants,
      updatedAt: NOW(),
    };
    db.products[index] = updated;

    if (current.price !== input.price) {
      audit(request, {
        action: "product.price_change",
        entity: current.id,
        detail: `${updated.name} price ${formatMoney(current.price)} → ${formatMoney(input.price)}`,
        changes: [{ field: "Price", from: formatMoney(current.price), to: formatMoney(input.price) }],
      });
    }
    saveDb();
    return HttpResponse.json(updated);
  }),

  route.delete("/api/products/:id", ({ params, request }) => {
    const db = getDb();
    const index = db.products.findIndex((p) => p.id === params.id);
    if (index < 0) return fail(404, "Product not found");
    const [removed] = db.products.splice(index, 1);
    audit(request, {
      action: "product.delete",
      entity: removed.id,
      detail: `Deleted “${removed.name}”`,
    });
    saveDb();
    return HttpResponse.json(removed);
  }),
];
