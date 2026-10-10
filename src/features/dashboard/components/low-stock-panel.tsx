"use client";

import { PackagePlus, PartyPopper } from "lucide-react";
import Link from "next/link";
import { StockStatusBadge } from "@/components/data/stock-status-badge";
import { ProductImage } from "@/components/brand/product-image";
import { buttonVariants } from "@/components/ui/button";
import type { Product } from "@/lib/api/types";
import { lowStock } from "../lib/metrics";

/** Variants at or under their reorder point, worst first, each with a one-tap way to receive stock. */
export function LowStockPanel({ products, limit = 6 }: { products: Product[]; limit?: number }) {
  const items = lowStock(products, limit);
  const byId = new Map(products.map((p) => [p.id, p]));

  if (items.length === 0) {
    return (
      <p className="flex items-center gap-3 rounded-lg bg-kpi-sage-bg px-4 py-5 text-sm text-kpi-sage-fg">
        <PartyPopper className="size-5" aria-hidden="true" /> Everything is above its reorder point. Nicely stocked.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border-subtle">
      {items.map((item) => {
        const product = byId.get(item.productId)!;
        return (
          <li key={item.variantId} className="flex items-center gap-3 py-2.5">
            <ProductImage src={product.image} name={product.name} category={product.category} colour={item.colour} className="size-10" sizes="40px" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{item.name}</span>
              {item.label ? <span className="block truncate text-xs text-text-secondary">{item.label}</span> : null}
            </span>
            <span className="hidden text-right text-xs text-text-secondary sm:block">
              <span className="tabular block font-semibold text-foreground">{item.stock} left</span>
              reorder at {item.threshold}
            </span>
            <StockStatusBadge status={item.stock === 0 ? "out" : "low"} />
            <Link
              href={`/inventory/intake?variant=${item.variantId}`}
              aria-label={`Receive stock for ${item.name} ${item.label}`}
              className={buttonVariants({ variant: "outline", size: "icon-sm" })}
            >
              <PackagePlus />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
