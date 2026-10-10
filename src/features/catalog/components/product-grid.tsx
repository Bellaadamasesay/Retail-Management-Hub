"use client";

import Link from "next/link";
import { Money } from "@/components/data/money";
import { StockStatusBadge } from "@/components/data/stock-status-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Product } from "@/lib/api/types";
import { productStatus, totalStock, variationSummary } from "@/lib/inventory/stock";
import { ProductPicture } from "./product-picture";

/** Card view of the catalog: a picture, the name, price and stock health. */
export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {products.map((product) => (
        <li key={product.id}>
          <Link
            href={`/products/${product.id}`}
            className="group block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Card className="gap-0 p-3 transition-[transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lifted">
              <ProductPicture
                product={product}
                flipId={product.id}
                className="aspect-square w-full rounded-lg"
              />
              <div className="mt-3 flex items-start justify-between gap-2">
                <p className="font-medium">{product.name}</p>
                {!product.active ? <Badge variant="destructive">Inactive</Badge> : null}
              </div>
              <p className="text-xs text-text-secondary">
                {product.category} · {variationSummary(product)}
              </p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <Money amount={product.price} className="font-semibold" />
                <span className="text-xs text-text-secondary">{totalStock(product)} in stock</span>
              </div>
              <div className="mt-2">
                <StockStatusBadge status={productStatus(product)} />
              </div>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
