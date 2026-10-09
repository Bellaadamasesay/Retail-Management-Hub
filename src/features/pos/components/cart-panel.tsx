"use client";

import { Banknote, Loader2, Minus, Plus, ShoppingBasket, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Money } from "@/components/data/money";
import { Button } from "@/components/ui/button";
import { ProductPicture } from "@/features/catalog/components/product-picture";
import type { Product } from "@/lib/api/types";
import { formatMoney, MINOR_FACTOR } from "@/lib/format/money";
import { gsap, registerGsap, useGSAP } from "@/lib/motion/register";
import { duration, ease, REDUCED_MOTION_QUERY } from "@/lib/motion/tokens";
import { useCountUp } from "@/lib/motion/use-count-up";
import { cartTotal, itemCount, lineTotal, type CartLine } from "@/lib/pos/cart";
import { cn } from "@/lib/utils";
import { useCart } from "../store/cart-store";

interface CartPanelProps {
  /** Looks up the product behind a line, for its picture. */
  productOf: (productId: string) => Product | undefined;
  /** "Complete Sale (Cash Only)": records the sale, paid in exact cash. */
  onComplete: () => void;
  /** The sale is being recorded: no second tap. */
  pending: boolean;
  /** Shown under "Nothing in the cart yet." */
  emptyHint: string;
}

/** The current sale: lines with steppers, running total and the big Complete button. */
export function CartPanel({ productOf, onComplete, pending, emptyHint }: CartPanelProps) {
  const lines = useCart((s) => s.lines);
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);
  const restore = useCart((s) => s.restore);

  const total = cartTotal(lines);
  const items = itemCount(lines);
  const animatedTotal = useCountUp(total);
  // Step in whole Leones while counting so cents never flicker.
  const shown = animatedTotal === total ? total : Math.round(animatedTotal / MINOR_FACTOR) * MINOR_FACTOR;

  function clearCart() {
    const snapshot = lines;
    clear();
    toast(`Cleared ${items} ${items === 1 ? "item" : "items"}`, {
      duration: 8000,
      action: { label: "Undo", onClick: () => restore(snapshot) },
    });
  }

  return (
    <section aria-label="Current sale" className="flex min-w-0 flex-col rounded-xl border bg-card shadow-soft">
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <h2 data-cart-target className="font-display text-lg font-semibold">
          Current Sale ({items})
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={lines.length === 0}
          onClick={clearCart}
          className="text-kpi-clay-fg hover:bg-kpi-clay-bg hover:text-kpi-clay-fg"
        >
          <Trash2 aria-hidden="true" /> Clear Cart
        </Button>
      </div>

      <div className="mx-4 hidden grid-cols-[minmax(0,1fr)_3.75rem_6rem_4rem_1rem] gap-2 rounded-lg bg-background-subtle px-3 py-2 text-xs text-table-header sm:grid">
        <span>Item</span>
        <span className="text-right">Price</span>
        <span className="text-center">Qty</span>
        <span className="text-right">Total</span>
        <span />
      </div>

      <div className="min-h-48 flex-1 px-4 py-2">
        {lines.length === 0 ? (
          <div className="grid h-full min-h-44 place-items-center text-center text-sm text-text-secondary">
            <div className="flex flex-col items-center gap-2">
              <ShoppingBasket className="size-8 text-text-muted" aria-hidden="true" />
              <p>Nothing in the cart yet.</p>
              <p>{emptyHint}</p>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col">
            {lines.map((line) => (
              <CartLineRow
                key={line.variantId}
                line={line}
                product={productOf(line.productId)}
                onQuantity={(q) => setQuantity(line.variantId, q)}
                onRemove={() => remove(line.variantId)}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t px-4 py-4">
        <p className="flex items-baseline justify-between text-sm">
          <span className="text-text-secondary">
            Subtotal ({items} {items === 1 ? "item" : "items"})
          </span>
          <span className="font-display text-xl font-bold tabular">{formatMoney(shown)}</span>
        </p>
        <Button
          type="button"
          size="lg"
          disabled={lines.length === 0 || pending}
          onClick={onComplete}
          className="h-14 justify-between px-5 text-base"
        >
          <span className="flex items-center gap-2">
            {pending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" /> Completing…
              </>
            ) : (
              <>
                <Banknote aria-hidden="true" /> Complete Sale (Cash Only)
              </>
            )}
          </span>
          <Money amount={total} className="font-semibold" />
        </Button>
      </div>
    </section>
  );
}

function CartLineRow({
  line,
  product,
  onQuantity,
  onRemove,
}: {
  line: CartLine;
  product: Product | undefined;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const row = useRef<HTMLLIElement>(null);
  const qty = useRef<HTMLSpanElement>(null);
  const [leaving, setLeaving] = useState(false);
  const first = useRef(true);

  // Enter: the row grows in. Quantity changes: the number gives a small bump. Both under 250 ms.
  useGSAP(
    () => {
      registerGsap();
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (first.current) {
          first.current = false;
          gsap.from(row.current, { height: 0, opacity: 0, duration: duration.fast, ease: ease.enter, clearProps: "height,opacity" });
        } else {
          gsap.fromTo(qty.current, { scale: 1.35 }, { scale: 1, duration: duration.fast, ease: ease.playful });
        }
      });
    },
    { scope: row, dependencies: [line.quantity] },
  );

  function removeAnimated() {
    if (leaving) return;
    setLeaving(true);
    registerGsap();
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return onRemove();
    gsap.to(row.current, {
      height: 0,
      opacity: 0,
      paddingTop: 0,
      paddingBottom: 0,
      duration: duration.fast,
      ease: "power2.in",
      onComplete: onRemove,
    });
  }

  const atMax = line.quantity >= line.stock;

  return (
    <li
      ref={row}
      className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-2 overflow-hidden border-b border-border-subtle py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_3.75rem_6rem_4rem_1rem]"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {product ? (
          <ProductPicture product={product} colour={product.variants.find((v) => v.id === line.variantId)?.colour} className="size-10" />
        ) : null}
        <div className="min-w-0">
          <p className="line-clamp-2 text-[0.8125rem] leading-tight font-medium">{line.name}</p>
          <p className="truncate text-xs text-text-secondary">{line.label}</p>
        </div>
      </div>
      <Money amount={line.unitPrice} className="hidden text-right text-xs sm:block" />
      <div className="flex items-center justify-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={`One fewer ${line.name} ${line.label}`}
          disabled={line.quantity <= 1}
          onClick={() => onQuantity(line.quantity - 1)}
        >
          <Minus />
        </Button>
        <span ref={qty} aria-label={`Quantity ${line.quantity}`} className="w-7 text-center text-sm font-medium tabular">
          {line.quantity}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={`One more ${line.name} ${line.label}`}
          disabled={atMax}
          title={atMax ? `Only ${line.stock} on the shelf` : undefined}
          onClick={() => onQuantity(line.quantity + 1)}
        >
          <Plus />
        </Button>
      </div>
      <Money amount={lineTotal(line)} className={cn("text-right text-xs font-semibold")} />
      <button
        type="button"
        aria-label={`Remove ${line.name} ${line.label}`}
        onClick={removeAnimated}
        className="grid size-5 place-items-center rounded text-text-secondary outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-4" />
      </button>
    </li>
  );
}
