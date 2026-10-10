import type { Category, Product } from "@/lib/api/types";
import { itemName } from "@/lib/inventory/stock";

export interface ProductFilters {
  /** Free text: matches the name or any variation value (e.g. "black", "42"). */
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
    return p.name.toLowerCase().includes(q) || p.variants.some((v) => itemName(p, v).toLowerCase().includes(q));
  });
}
