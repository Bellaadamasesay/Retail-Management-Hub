import type { Category, Product } from "@/lib/api/types";

export interface ProductFilters {
  /** Free text: matches the name, the product code, or any variant SKU. */
  query: string;
  category: Category | "all";
  status: "all" | "active" | "inactive";
}

export const NO_FILTERS: ProductFilters = { query: "", category: "all", status: "all" };

export function hasFilters(filters: ProductFilters): boolean {
  return filters.query.trim() !== "" || filters.category !== "all" || filters.status !== "all";
}

export function filterProducts(products: readonly Product[], filters: ProductFilters): Product[] {
  const q = filters.query.trim().toLowerCase();
  return products.filter((p) => {
    if (filters.category !== "all" && p.category !== filters.category) return false;
    if (filters.status === "active" && !p.active) return false;
    if (filters.status === "inactive" && p.active) return false;
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.variants.some((v) => v.sku.toLowerCase().includes(q))
    );
  });
}
