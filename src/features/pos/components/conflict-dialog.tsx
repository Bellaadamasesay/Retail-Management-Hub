"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StockConflict } from "@/lib/api/types";
import type { CartLine } from "@/lib/pos/cart";

interface ConflictDialogProps {
  conflict: StockConflict | null;
  lines: CartLine[];
  /** Cut the cart down to what is actually left. */
  onAdjust: () => void;
  onClose: () => void;
}

/**
 * 409: someone else sold some of these between adding them and paying.
 * Nothing was charged or taken from stock; this says which items are short and
 * offers to fix the cart in one tap.
 */
export function ConflictDialog({ conflict, lines, onAdjust, onClose }: ConflictDialogProps) {
  return (
    <Dialog open={conflict !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <TriangleAlert className="size-5 text-warning" aria-hidden="true" /> Stock changed
          </DialogTitle>
          <DialogDescription>{conflict?.message} Nothing has been charged.</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col divide-y rounded-lg border text-sm">
          {conflict?.shortages.map((s) => {
            const line = lines.find((l) => l.variantId === s.variantId);
            return (
              <li key={s.variantId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span>
                  <span className="block font-medium">{line?.name ?? s.variantId}</span>
                  <span className="block text-xs text-text-secondary">{line?.label}</span>
                </span>
                <span className="text-right text-xs">
                  <span className="block">You have {s.requested}</span>
                  <span className="block font-semibold text-destructive">
                    {s.available === 0 ? "Sold out" : `${s.available} left`}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Review the cart
          </Button>
          <Button onClick={onAdjust}>Update cart to what&apos;s left</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
