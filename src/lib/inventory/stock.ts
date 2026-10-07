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

/** "Black · 42" / "Tan" for a one-size variant. */
export function variantLabel(variant: Pick<Variant, "colour" | "size">): string {
  return variant.size === "One size" ? variant.colour : `${variant.colour} · ${variant.size}`;
}
