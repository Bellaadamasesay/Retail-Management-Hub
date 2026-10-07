import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FIXTURE_NOW, products, sales } from "@/lib/api/fixtures";
import { DesignShowcase, type LowStockRow } from "./design-showcase";

export const metadata: Metadata = { title: "Design system" };

/** Dev-only reference page for tokens, components and motion, fed by the mock fixtures. */
export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const today = FIXTURE_NOW.toISOString().slice(0, 10);
  const todaysSales = sales.filter((s) => s.createdAt.startsWith(today));

  const lowStock: LowStockRow[] = products.flatMap((p) =>
    p.variants
      .filter((v) => v.stock <= v.reorderThreshold)
      .map((v) => ({
        sku: v.sku,
        name: `${p.name} · ${v.colour}${v.size === "One size" ? "" : ` · ${v.size}`}`,
        stock: v.stock,
        threshold: v.reorderThreshold,
      })),
  );

  return (
    <DesignShowcase
      stats={{
        salesToday: todaysSales.reduce((n, s) => n + s.total, 0),
        itemsToday: todaysSales.reduce(
          (n, s) => n + s.lines.reduce((m, l) => m + l.quantity, 0),
          0,
        ),
        lowStockCount: lowStock.length,
      }}
      lowStock={lowStock.slice(0, 8)}
    />
  );
}
