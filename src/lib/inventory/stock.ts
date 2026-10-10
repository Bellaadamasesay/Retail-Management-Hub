import type { Product, Variant } from "@/lib/api/types";

export type StockStatus = "in" | "low" | "out";

/** Out at zero; low at or under the reorder point; otherwise in stock. */
export function variantStatus(variant: Pick<Variant, "stock" | "reorderThreshold">): StockStatus {
  if (variant.stock <= 0) return "out";
  return variant.stock <= variant.reorderThreshold ? "low" : "in";
}

export const statusLabel: Record<StockStatus, string> = {
  in: "In Stock",
  low: "Low Stock",
  out: "Out of Stock",
};

/** Units across every variant of a product. */
export function totalStock(product: Pick<Product, "variants">): number {
  return product.variants.reduce((n, v) => n + v.stock, 0);
}

/**
 * Product-level health: out when nothing is left anywhere; low when at least
 * one variant needs reordering (including sold-out sizes); otherwise in stock.
 */
export function productStatus(product: Pick<Product, "variants">): StockStatus {
  if (totalStock(product) === 0) return "out";
  return product.variants.some((v) => variantStatus(v) !== "in") ? "low" : "in";
}

/** "Black · 42", or "" for a product sold in one version. */
export function variantLabel(variant: Pick<Variant, "options">): string {
  return Object.values(variant.options).join(" · ");
}

/** "Oxford Brogue · Black · 42", or just the product name when there are no variations. */
export function itemName(product: Pick<Product, "name">, variant: Pick<Variant, "options">): string {
  const label = variantLabel(variant);
  return label ? `${product.name} · ${label}` : product.name;
}

/** The variation's colour, if it has one: tints the drawn picture of products without a photo. */
export function variantColour(variant: Pick<Variant, "options"> | undefined): string | undefined {
  if (!variant) return undefined;
  const key = Object.keys(variant.options).find((k) => /^colou?r$/i.test(k));
  return key ? variant.options[key] : undefined;
}

/** "2 colours · 6 sizes"; "One version" for a product without variations. */
export function variationSummary(product: Pick<Product, "optionTypes" | "variants">): string {
  if (product.optionTypes.length === 0) return "One version";
  return product.optionTypes
    .map((type) => {
      const count = new Set(product.variants.map((v) => v.options[type])).size;
      const noun = type.toLowerCase();
      return `${count} ${count === 1 ? noun : noun.endsWith("s") ? noun : `${noun}s`}`;
    })
    .join(" · ");
}
