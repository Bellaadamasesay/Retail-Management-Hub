import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DesignShowcase, type LowStockRow } from "./design-showcase";

export const metadata: Metadata = { title: "Design system" };

/** Sample rows for the showcase: illustrative only, not store data. */
const lowStock: LowStockRow[] = [
  { id: "sample-1", name: "Leather Tote Bag · Black", stock: 0, threshold: 3 },
  { id: "sample-2", name: "Oxford Brogue · Tan · 42", stock: 1, threshold: 2 },
  { id: "sample-3", name: "Silk Scarf · Floral", stock: 2, threshold: 3 },
  { id: "sample-4", name: "Card Holder", stock: 3, threshold: 4 },
];

/** Dev-only reference page for tokens, components and motion. */
export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignShowcase stats={{ salesToday: 1_845_000, itemsToday: 37, lowStockCount: lowStock.length }} lowStock={lowStock} />;
}
