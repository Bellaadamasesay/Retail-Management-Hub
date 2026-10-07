"use client";

import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Product } from "@/lib/api/types";
import { usePermission } from "@/lib/rbac/use-permission";
import { DeleteProductDialog } from "./delete-product-dialog";

/**
 * Row "…" menu. Everyone can open a product; Keepers and Admins edit it; only
 * Admins delete, behind a confirmation and with a short undo.
 */
export function ProductActions({ product }: { product: Product }) {
  const canEdit = usePermission("products.edit");
  const canDelete = usePermission("products.delete");
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Actions for ${product.name}`}
          className="grid size-8 place-items-center rounded-md border border-border bg-card text-foreground outline-none hover:bg-surface-hover focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem render={<Link href={`/products/${product.id}`} />}>
            {canEdit ? <Pencil aria-hidden="true" /> : <Eye aria-hidden="true" />}
            {canEdit ? "View / edit" : "View details"}
          </DropdownMenuItem>
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
                <Trash2 aria-hidden="true" /> Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteProductDialog product={product} open={confirming} onOpenChange={setConfirming} />
    </>
  );
}
