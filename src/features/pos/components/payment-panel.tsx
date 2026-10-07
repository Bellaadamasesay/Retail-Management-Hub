"use client";

import { Banknote, Check, Loader2 } from "lucide-react";
import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney, MINOR_FACTOR, parseLeones } from "@/lib/format/money";
import { useCountUp } from "@/lib/motion/use-count-up";
import { canComplete, changeDue, quickAmounts } from "@/lib/pos/cash";
import { cartTotal } from "@/lib/pos/cart";
import { cn } from "@/lib/utils";
import { useCart } from "../store/cart-store";

interface PaymentPanelProps {
  onConfirm: () => void;
  pending: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
}

/**
 * Cash is the only way to pay, permanently: no method selector and no split
 * payments. Type (or tap) the cash received; change due follows, and Confirm
 * stays disabled until the cash covers the total.
 */
export function PaymentPanel({ onConfirm, pending, inputRef, className }: PaymentPanelProps) {
  const lines = useCart((s) => s.lines);
  const tenderedText = useCart((s) => s.tendered);
  const setTendered = useCart((s) => s.setTendered);

  const total = cartTotal(lines);
  const tendered = tenderedText.trim() === "" ? Number.NaN : parseLeones(tenderedText);
  const ready = canComplete(total, tendered);
  const change = changeDue(total, tendered);
  const animatedChange = useCountUp(change);
  // Count in whole Leones so cents never flicker mid-tween; the settled value is exact.
  const shownChange = animatedChange === change ? change : Math.round(animatedChange / MINOR_FACTOR) * MINOR_FACTOR;
  const short = Number.isFinite(tendered) && tendered < total ? total - tendered : 0;
  const chips = quickAmounts(total);

  return (
    <section aria-label="Payment" className={cn("flex min-w-0 flex-col gap-5 rounded-xl border bg-card p-5 shadow-soft", className)}>
      <h2 className="font-display text-lg font-semibold">Payment</h2>

      <div className="flex items-center gap-3 rounded-lg bg-kpi-sage-bg px-3 py-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-card text-kpi-sage-fg">
          <Banknote className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold">Cash Only</p>
          <p className="text-xs text-text-secondary">This store accepts cash payments only.</p>
        </div>
      </div>

      <p className="flex items-baseline justify-between text-sm">
        <span className="font-medium">Subtotal</span>
        <span className="font-display text-lg font-bold tabular">{formatMoney(total)}</span>
      </p>

      <div className="flex flex-col gap-2">
        <label htmlFor="amount-received" className="text-sm font-medium">
          Amount Received
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-text-secondary">Le</span>
          <Input
            id="amount-received"
            ref={inputRef}
            inputMode="decimal"
            autoComplete="off"
            value={tenderedText}
            onChange={(e) => setTendered(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && ready && !pending) {
                e.preventDefault();
                onConfirm();
              }
            }}
            placeholder="0"
            disabled={total === 0}
            aria-describedby="payment-hint"
            className="h-12 pl-9 text-lg tabular"
          />
        </div>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Quick amounts">
          {chips.map((amount) => (
            <button
              key={amount}
              type="button"
              aria-pressed={tendered === amount}
              onClick={() => setTendered(String(amount / MINOR_FACTOR))}
              className={cn(
                "h-10 rounded-lg border text-sm tabular outline-none transition-[transform,background-color] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95",
                tendered === amount ? "border-primary bg-primary-subtle font-semibold" : "border-border bg-card hover:bg-surface-hover",
              )}
            >
              {formatMoney(amount)}
            </button>
          ))}
        </div>
        <p id="payment-hint" className="min-h-4 text-xs text-kpi-clay-fg" role="status">
          {short > 0 ? `${formatMoney(short)} still to pay` : ""}
        </p>
      </div>

      <p className="flex items-baseline justify-between">
        <span className="text-sm font-medium">Change Due</span>
        <span className={cn("font-display text-xl font-bold tabular", ready ? "text-success" : "text-text-muted")} aria-live="polite">
          {formatMoney(shownChange)}
        </span>
      </p>

      <Button type="button" size="lg" disabled={!ready || pending} onClick={onConfirm} className="h-12 text-base">
        {pending ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" /> Completing…
          </>
        ) : (
          <>
            <Check aria-hidden="true" /> Confirm Payment
          </>
        )}
      </Button>
    </section>
  );
}
