import { and, desc, eq, getTableColumns, inArray, isNull, notInArray, sql } from "drizzle-orm";
import type { AuditChange, Product, ProductInput, Variant } from "@/lib/api/types";
import { formatMoney } from "@/lib/format/money";
import { itemName, variantLabel } from "@/lib/inventory/stock";
import { audit } from "./audit";
import { getDb, schema, type Tx } from "./db";
import { publish } from "./events";
import { fail, isUuid } from "./http";
import { applyMovement } from "./stock";

const { products, variants } = schema;
type ProductRow = typeof products.$inferSelect;
type VariantRow = typeof variants.$inferSelect;

const CATEGORIES = ["Shoes", "Bags", "Accessories"] as const;
/** Photos come from the camera as ~60 KB JPEGs; this leaves room without letting huge files in. */
const MAX_IMAGE_BYTES = 1_500_000;

const toVariant = (v: VariantRow): Variant => ({
  id: v.id,
  productId: v.productId,
  code: v.code,
  options: v.options,
  stock: v.stock,
  reorderThreshold: v.reorderThreshold,
});

function toProduct(p: Omit<ProductRow, "image">, rows: VariantRow[]): Product {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    description: p.description,
    price: p.price,
    cost: p.cost,
    // The photo itself is served separately; the version busts browser caches when it changes.
    image: p.imageType ? `/api/products/${p.id}/image?v=${p.imageVersion}` : null,
    optionTypes: p.optionTypes,
    variants: rows
      .filter((v) => v.productId === p.id)
      .sort((a, b) => a.position - b.position)
      .map(toVariant),
    active: p.active,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** Every column except the photo bytes. */
const listColumns = Object.fromEntries(
  Object.entries(getTableColumns(products)).filter(([key]) => key !== "image"),
) as Omit<ReturnType<typeof getTableColumns<typeof products>>, "image">;

/** The catalog, newest first. Deleted products are left out. */
export async function listProducts(): Promise<Product[]> {
  const db = getDb();
  const rows = await db.select(listColumns).from(products).where(isNull(products.deletedAt)).orderBy(desc(products.createdAt));
  const vs = rows.length ? await db.select().from(variants).where(inArray(variants.productId, rows.map((r) => r.id))) : [];
  return rows.map((r) => toProduct(r, vs));
}

async function loadProduct(tx: Tx, id: string, lock = false): Promise<Product> {
  const query = tx.select(listColumns).from(products).where(and(eq(products.id, id), isNull(products.deletedAt)));
  const [row] = lock ? await query.for("update") : await query;
  if (!row) throw fail(404, "Product not found");
  return toProduct(row, await tx.select().from(variants).where(eq(variants.productId, id)));
}

export async function getProduct(id: string): Promise<Product> {
  return getDb().transaction((tx) => loadProduct(tx, id));
}

export async function productImage(id: string) {
  const [row] = await getDb().select({ image: products.image, type: products.imageType }).from(products).where(eq(products.id, id));
  return row?.image && row.type ? { bytes: row.image, type: row.type } : null;
}

const sameOptions = (a: Record<string, string>, b: Record<string, string>) => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
};

/** Throws a 422 describing the first problem with the input. */
function validate(input: ProductInput) {
  if (!input || typeof input.name !== "string" || !input.name.trim()) throw fail(422, "Give the product a name.");
  if (!CATEGORIES.includes(input.category)) throw fail(422, "Choose Shoes, Bags or Accessories.");
  if (!Number.isInteger(input.price) || input.price <= 0) throw fail(422, "Enter a selling price above zero.");
  if (!Number.isInteger(input.cost) || input.cost < 0) throw fail(422, "Enter the cost price.");
  if (!Array.isArray(input.variants) || input.variants.length === 0) throw fail(422, "Add at least one variation.");
  if (!Array.isArray(input.optionTypes)) throw fail(422, "The variation types are missing.");

  const types = input.optionTypes.map((t) => String(t).trim());
  if (types.some((t) => !t)) throw fail(422, "Every variation type needs a name.");
  if (new Set(types.map((t) => t.toLowerCase())).size !== types.length) throw fail(422, "Each variation type can only be listed once.");
  if (types.length === 0 && input.variants.length !== 1) throw fail(422, "A product without variations has exactly one version.");
  if (input.variants.length > 500) throw fail(422, "That’s more than 500 variations. Split it into separate products.");

  const seen: Record<string, string>[] = [];
  for (const v of input.variants) {
    const options = v.options ?? {};
    if (Object.keys(options).length !== types.length || !types.every((t) => typeof options[t] === "string" && options[t].trim())) {
      throw fail(422, "Every variation needs a value for each variation type.");
    }
    if (seen.some((s) => sameOptions(s, options))) throw fail(422, `${variantLabel(v)} is listed twice.`);
    seen.push(options);
    if (v.id !== undefined && !isUuid(v.id)) throw fail(422, "One of those variations doesn’t belong to this product.");
    if (!Number.isInteger(v.stock) || v.stock < 0) throw fail(422, `Quantity for ${variantLabel(v) || "the product"} must be a whole number.`);
    if (!Number.isInteger(v.reorderThreshold) || v.reorderThreshold < 0) throw fail(422, "The reorder level must be a whole number.");
  }
}

/** A new photo (data URL), no change (our own image URL), or removal (null). */
function parseImage(image: string | null, productId?: string): { bytes: Buffer; type: string } | "keep" | null {
  if (image === null || image === undefined) return null;
  if (productId && image.startsWith(`/api/products/${productId}/image`)) return "keep";
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if (!match) throw fail(422, "The photo couldn’t be read. Take it again.");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > MAX_IMAGE_BYTES) throw fail(422, "That photo is too large. Take it again with the camera.");
  return { bytes, type: match[1] };
}

export async function createProduct(input: ProductInput, actorId: string): Promise<Product> {
  validate(input);
  const photo = parseImage(input.image);
  const now = new Date();
  const product = await getDb().transaction(async (tx) => {
    const [row] = await tx
      .insert(products)
      .values({
        name: input.name.trim(),
        category: input.category,
        description: (input.description ?? "").trim(),
        price: input.price,
        cost: input.cost,
        active: input.active !== false,
        optionTypes: input.optionTypes.map((t) => t.trim()),
        ...(photo && photo !== "keep" ? { image: photo.bytes, imageType: photo.type, imageVersion: 1 } : {}),
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: products.id, name: products.name });
    const created = await tx
      .insert(variants)
      .values(input.variants.map((v, i) => ({ productId: row.id, options: v.options, stock: 0, reorderThreshold: v.reorderThreshold, position: i })))
      .returning();
    // Opening stock goes in through the ledger.
    for (const [i, v] of created.entries()) {
      const quantity = input.variants[i].stock;
      if (quantity > 0) await applyMovement(tx, { variantId: v.id, quantity, type: "incoming", reference: "New product", actorId, at: now });
    }
    const units = input.variants.reduce((n, v) => n + v.stock, 0);
    await audit(tx, actorId, {
      action: "product.create",
      entity: row.id,
      detail:
        input.optionTypes.length === 0
          ? `Added ${row.name} with ${units} in stock`
          : `Added ${row.name} with ${created.length} ${created.length === 1 ? "variation" : "variations"}, ${units} in stock`,
    });
    return loadProduct(tx, row.id);
  });
  if (product.variants.some((v) => v.stock > 0)) publish({ type: "stock.changed", at: now.toISOString() });
  return product;
}

export async function updateProduct(id: string, input: ProductInput, actorId: string): Promise<Product> {
  validate(input);
  const photo = parseImage(input.image, id);
  const now = new Date();
  let stockChanged = false;
  const product = await getDb().transaction(async (tx) => {
    const current = await loadProduct(tx, id, true);
    const owned = new Set(current.variants.map((v) => v.id));
    if (input.variants.some((v) => v.id && !owned.has(v.id))) throw fail(422, "One of those variations doesn’t belong to this product.");

    // Dropping a variation would make its units vanish without a record.
    const keptIds = input.variants.flatMap((v) => (v.id ? [v.id] : []));
    const stranded = current.variants.find((v) => !keptIds.includes(v.id) && v.stock > 0);
    if (stranded) {
      throw fail(409, `${itemName(current, stranded)} still has ${stranded.stock} on the shelf. Set its quantity to 0 before removing it.`);
    }
    await tx.delete(variants).where(and(eq(variants.productId, id), keptIds.length ? notInArray(variants.id, keptIds) : undefined));

    const stockChanges: AuditChange[] = [];
    for (const [position, v] of input.variants.entries()) {
      const kept = current.variants.find((c) => c.id === v.id);
      let variantId = v.id;
      let before = 0;
      if (kept) {
        before = kept.stock;
        await tx.update(variants).set({ options: v.options, reorderThreshold: v.reorderThreshold, position }).where(eq(variants.id, kept.id));
      } else {
        const [row] = await tx
          .insert(variants)
          .values({ productId: id, options: v.options, stock: 0, reorderThreshold: v.reorderThreshold, position })
          .returning({ id: variants.id });
        variantId = row.id;
      }
      const delta = v.stock - before;
      if (delta !== 0) {
        stockChanges.push({ field: variantLabel(v) || "Stock", from: String(before), to: String(v.stock) });
        await applyMovement(tx, {
          variantId: variantId!,
          quantity: delta,
          type: kept ? "adjustment" : "incoming",
          reference: kept ? "Product edit" : "New variation",
          actorId,
          at: now,
        });
      }
    }

    await tx
      .update(products)
      .set({
        name: input.name.trim(),
        category: input.category,
        description: (input.description ?? "").trim(),
        price: input.price,
        cost: input.cost,
        active: input.active !== false,
        optionTypes: input.optionTypes.map((t) => t.trim()),
        ...(photo === "keep"
          ? {}
          : photo
            ? { image: photo.bytes, imageType: photo.type, imageVersion: sql`${products.imageVersion} + 1` }
            : { image: null, imageType: null }),
        updatedAt: now,
      })
      .where(eq(products.id, id));

    if (current.price !== input.price) {
      await audit(tx, actorId, {
        action: "product.price_change",
        entity: id,
        detail: `${input.name.trim()} price ${formatMoney(current.price)} → ${formatMoney(input.price)}`,
        changes: [{ field: "Price", from: formatMoney(current.price), to: formatMoney(input.price) }],
      });
    }
    if (stockChanges.length > 0) {
      stockChanged = true;
      await audit(tx, actorId, {
        action: "stock.adjust",
        entity: id,
        detail: `Changed stock of ${input.name.trim()} (${stockChanges.length} ${stockChanges.length === 1 ? "variation" : "variations"})`,
        changes: stockChanges,
      });
    }
    return loadProduct(tx, id);
  });
  if (stockChanged) publish({ type: "stock.changed", at: now.toISOString() });
  return product;
}

/** Hides the product. Its variations, sales and stock history stay, so Undo can bring it back. */
export async function deleteProduct(id: string, actorId: string): Promise<Product> {
  return getDb().transaction(async (tx) => {
    const product = await loadProduct(tx, id, true);
    await tx.update(products).set({ deletedAt: new Date() }).where(eq(products.id, id));
    await audit(tx, actorId, { action: "product.delete", entity: id, detail: `Deleted “${product.name}”` });
    return product;
  });
}

export async function restoreProduct(id: string, actorId: string): Promise<Product> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .update(products)
      .set({ deletedAt: null })
      .where(and(eq(products.id, id), sql`${products.deletedAt} is not null`))
      .returning({ id: products.id, name: products.name });
    if (!row) throw fail(409, "That product is already back.");
    await audit(tx, actorId, { action: "product.create", entity: id, detail: `Restored ${row.name}` });
    return loadProduct(tx, id);
  });
}
