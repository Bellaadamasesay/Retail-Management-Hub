"use client";

import { PackageSearch } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/brand/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { useProduct } from "../api/use-product";
import { ProductForm } from "./product-form";

/** Loads one product and hands it to the form, with loading, not-found and error states. */
export function ProductEditor({ id }: { id: string }) {
  const query = useProduct(id);

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading product">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 xl:grid-cols-[1fr_21rem]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return (
      <EmptyState
        className="mx-auto max-w-xl bg-card"
        icon={<PackageSearch className="size-6" />}
        title={missing ? "We can’t find that product" : "We couldn’t load that product"}
        description={
          missing
            ? "It may have been deleted. Head back to the catalog to pick another."
            : "Check your connection and try again. Nothing has been lost."
        }
        action={
          missing ? (
            <Link href="/products" className={buttonVariants({ size: "sm" })}>
              Back to products
            </Link>
          ) : (
            <Button size="sm" onClick={() => query.refetch()}>
              Try again
            </Button>
          )
        }
      />
    );
  }

  // Re-key on save so the form resets to the stored values.
  return <ProductForm key={`${query.data.id}-${query.data.updatedAt}`} product={query.data} />;
}
