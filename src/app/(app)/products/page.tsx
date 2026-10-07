import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductsView } from "@/features/catalog/components/products-view";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage() {
  // useSearchParams (the ?q= handed over by the command palette) needs a Suspense boundary.
  return (
    <Suspense>
      <ProductsView />
    </Suspense>
  );
}
