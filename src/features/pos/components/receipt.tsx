import type { Sale, StoreSettings } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { cn } from "@/lib/utils";

interface ReceiptProps {
  sale: Sale;
  settings: StoreSettings | undefined;
  cashierName: string;
  className?: string;
}

/**
 * The receipt paper: store, receipt number, cashier, time, line items, total,
 * cash received and change. Receipts always print on white, so this uses fixed
 * black-on-white rather than theme tokens.
 */
export function Receipt({ sale, settings, cashierName, className }: ReceiptProps) {
  return (
    <article
      aria-label={`Receipt ${sale.receiptNumber}`}
      className={cn("w-full max-w-[80mm] bg-white p-5 font-mono text-[11px] leading-snug text-black", className)}
    >
      <header className="text-center">
        <p className="font-display text-base font-bold tracking-tight">{settings?.storeName ?? "DaniCess Store"}</p>
        {settings?.address ? <p>{settings.address}</p> : null}
        {settings?.phone ? <p>{settings.phone}</p> : null}
      </header>

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 border-y border-dashed border-black/60 py-2">
        <dt>Receipt</dt>
        <dd className="text-right font-bold">{sale.receiptNumber}</dd>
        <dt>Date</dt>
        <dd className="text-right">{formatDateTime(sale.createdAt)}</dd>
        <dt>Cashier</dt>
        <dd className="text-right">{cashierName}</dd>
      </dl>

      <ul className="mt-2 flex flex-col gap-1.5">
        {sale.lines.map((line) => (
          <li key={line.variantId}>
            <p>{line.name}</p>
            <p className="flex justify-between">
              <span>
                {line.quantity} × {formatMoney(line.unitPrice)}
              </span>
              <span>{formatMoney(line.quantity * line.unitPrice)}</span>
            </p>
          </li>
        ))}
      </ul>

      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 border-t border-dashed border-black/60 pt-2">
        <dt className="font-bold">Total</dt>
        <dd className="text-right text-sm font-bold">{formatMoney(sale.total)}</dd>
        <dt>Cash received</dt>
        <dd className="text-right">{formatMoney(sale.payment.tendered)}</dd>
        <dt>Change</dt>
        <dd className="text-right">{formatMoney(sale.payment.change)}</dd>
      </dl>

      <p className="mt-4 text-center">Thank you for shopping with us!</p>
    </article>
  );
}
