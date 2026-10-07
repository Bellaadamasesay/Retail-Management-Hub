"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api/client";
import type { Product } from "@/lib/api/types";
import { useDeleteProduct, useRestoreProduct } from "../api/use-product-mutations";

interface DeleteProductDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

/** Confirm, delete, then offer a ten-second undo. Only Super Admins reach this (see usePermission at the callers). */
export function DeleteProductDialog({ product, open, onOpenChange, onDeleted }: DeleteProductDialogProps) {
  const remove = useDeleteProduct();
  const restore = useRestoreProduct();

  async function confirm() {
    try {
      const removed = await remove.mutateAsync(product.id);
      onOpenChange(false);
      onDeleted?.();
      toast(`Deleted ${removed.name}`, {
        description: "It’s gone from the catalog. Changed your mind?",
        duration: 10_000,
        action: {
          label: "Undo",
          // mutateAsync (not mutate's callbacks): this row, and with it this component, is gone by now.
          onClick: () =>
            restore
              .mutateAsync(removed)
              .then(() => toast.success(`${removed.name} is back in the catalog.`))
              .catch(() =>
                toast.error("Couldn’t restore it", {
                  description: "Add the product again from Add Product.",
                }),
              ),
        },
      });
    } catch (error) {
      toast.error("Couldn’t delete the product", {
        description: error instanceof ApiError ? error.message : "Check your connection and try again.",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Delete {product.name}?</DialogTitle>
          <DialogDescription className="leading-relaxed">
            This removes the product and its {product.variants.length}{" "}
            {product.variants.length === 1 ? "variant" : "variants"} from the catalog. Past sales
            keep their receipts. You will have a few seconds to undo it.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Keep it</DialogClose>
          <Button variant="destructive" disabled={remove.isPending} onClick={confirm}>
            {remove.isPending ? "Deleting…" : "Delete product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
