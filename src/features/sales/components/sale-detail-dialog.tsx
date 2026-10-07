"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useStoreSettings } from "@/features/pos/api/use-checkout";
import { Receipt } from "@/features/pos/components/receipt";
import { ReceiptActions } from "@/features/pos/components/receipt-actions";
import { useStaffName } from "@/features/users/api/use-users";
import type { Sale } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format/date";

/** One sale's receipt, ready to reprint on the 80 mm printer or save as a PDF. */
export function SaleDetailDialog({ sale, onClose }: { sale: Sale | null; onClose: () => void }) {
  const settings = useStoreSettings();
  const staffName = useStaffName();

  return (
    <Dialog open={sale !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94dvh] gap-4 overflow-y-auto sm:max-w-md">
        {sale ? (
          <>
            <div>
              <DialogTitle className="font-display text-xl font-bold">Receipt {sale.receiptNumber}</DialogTitle>
              <DialogDescription>
                Rung up by {staffName(sale.cashierId)} on {formatDateTime(sale.createdAt)}.
              </DialogDescription>
            </div>
            <Receipt
              sale={sale}
              settings={settings.data}
              cashierName={staffName(sale.cashierId)}
              className="mx-auto rounded-sm shadow-soft ring-1 ring-black/10"
            />
            <div className="grid grid-cols-2 gap-2">
              <ReceiptActions sale={sale} settings={settings.data} cashierName={staffName(sale.cashierId)} />
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
