"use client";

import { Clock } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useProducts } from "@/features/catalog/api/use-products";
import { useSales } from "@/features/sales/api/use-sales";
import { ApiError } from "@/lib/api/client";
import type { Product, Sale, StockConflict, Variant } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session-context";
import { parseLeones } from "@/lib/format/money";
import { flyTo } from "@/lib/motion/fly";
import { canComplete } from "@/lib/pos/cash";
import { cartTotal } from "@/lib/pos/cart";
import { appNow } from "@/lib/time";
import { useMediaQuery } from "@/lib/use-media-query";
import { fetchAvailability, useCheckout, useStoreSettings } from "../api/use-checkout";
import { useCart } from "../store/cart-store";
import { CartPanel } from "./cart-panel";
import { ConflictDialog } from "./conflict-dialog";
import { PaymentPanel } from "./payment-panel";
import { ProductPanel } from "./product-panel";
import { ReceiptDialog } from "./receipt-dialog";

const variantLabel = (v: Pick<Variant, "colour" | "size">) => (v.size === "One size" ? v.colour : `${v.colour} · ${v.size}`);

export function PosView() {
  const session = useSession();
  const products = useProducts();
  const settings = useStoreSettings();
  const mySales = useSales(session.sub);
  const checkout = useCheckout();

  const lines = useCart((s) => s.lines);
  const tenderedText = useCart((s) => s.tendered);
  const idempotencyKey = useCart((s) => s.idempotencyKey);
  const add = useCart((s) => s.add);
  const clear = useCart((s) => s.clear);
  const setStock = useCart((s) => s.setStock);

  const wide = useMediaQuery("(min-width: 1280px)");
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [conflict, setConflict] = useState<StockConflict | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const catalog = useMemo(() => products.data ?? [], [products.data]);
  const byVariant = useMemo(() => {
    const map = new Map<string, { product: Product; variant: Variant }>();
    for (const product of catalog) for (const variant of product.variants) map.set(variant.id, { product, variant });
    return map;
  }, [catalog]);

  const addVariant = useCallback(
    async (product: Product, variant: Variant, source: Element | null) => {
      // Ask the server how many are really on the shelf right now; fall back to what we last loaded.
      let stock = variant.stock;
      try {
        stock = (await fetchAvailability([variant.id]))[variant.id] ?? variant.stock;
      } catch {
        // Offline blips shouldn't stop a scan; checkout re-checks anyway.
      }
      const result = add({
        variantId: variant.id,
        productId: product.id,
        name: product.name,
        label: variantLabel(variant),
        sku: variant.sku,
        unitPrice: product.price,
        stock,
      });
      if (result.status === "sold-out") {
        toast.error(`${product.name} (${variantLabel(variant)}) is sold out`, { description: "There are none left on the shelf." });
      } else if (result.status === "capped") {
        toast.warning(`Only ${result.available} of ${product.name} (${variantLabel(variant)}) on the shelf`, {
          description: "That's all of them in the cart.",
        });
      } else {
        flyTo(source, document.querySelector("[data-cart-target]"));
      }
    },
    [add],
  );

  const addByCode = useCallback(
    (raw: string) => {
      const code = raw.trim().toLowerCase();
      const hit = [...byVariant.values()].find((e) => e.variant.sku.toLowerCase() === code);
      if (!hit) return false;
      void addVariant(hit.product, hit.variant, null);
      return true;
    },
    [byVariant, addVariant],
  );

  const dialogOpen = paying || receipt !== null || conflict !== null;

  // Till shortcuts: "/" jumps to search, F2 to the cash field.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const typing = event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
      if (event.key === "/" && !typing && !dialogOpen) {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "F2" && !dialogOpen) {
        event.preventDefault();
        if (wide) amountRef.current?.focus();
        else if (useCart.getState().lines.length > 0) setPaying(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialogOpen, wide]);

  const total = cartTotal(lines);
  const tendered = tenderedText.trim() === "" ? Number.NaN : parseLeones(tenderedText);

  async function confirmPayment() {
    if (!canComplete(total, tendered) || checkout.isPending) return;
    const firstToday = !(mySales.data ?? []).some(
      (s) => new Date(s.createdAt).toISOString().slice(0, 10) === appNow().toISOString().slice(0, 10),
    );
    try {
      const sale = await checkout.mutateAsync({
        input: { lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })), tendered },
        idempotencyKey,
      });
      clear();
      setPaying(false);
      setReceipt(sale);
      if (firstToday) toast.success("That's your first sale of the day", { description: "A good start." });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setPaying(false);
        setConflict(error.body as StockConflict);
      } else {
        toast.error("We couldn't complete that sale", {
          description:
            error instanceof ApiError
              ? error.message
              : "Check the connection and try again. The cart is safe and nothing was charged twice.",
        });
      }
    }
  }

  function startPayment() {
    if (wide) {
      if (canComplete(total, tendered)) void confirmPayment();
      else amountRef.current?.focus();
    } else {
      setPaying(true);
    }
  }

  function adjustToStock() {
    if (!conflict) return;
    setStock(Object.fromEntries(conflict.shortages.map((s) => [s.variantId, s.available])));
    toast("Cart updated to what's left");
    setConflict(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Sales / POS"
        description="Search for a product, or select from the list to add items to the cart."
        actions={
          <Link href="/sales" className={buttonVariants({ variant: "outline", className: "h-11 px-5" })}>
            <Clock aria-hidden="true" /> Recent Sales
          </Link>
        }
      />

      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_22rem_17rem]">
        <ProductPanel
          products={catalog}
          searchRef={searchRef}
          onPick={(product, variant, source) => void addVariant(product, variant, source)}
          onExactCode={addByCode}
        />
        <CartPanel productOf={(id) => catalog.find((p) => p.id === id)} onComplete={startPayment} />
        {wide ? <PaymentPanel onConfirm={confirmPayment} pending={checkout.isPending} inputRef={amountRef} /> : null}
      </div>

      {/* Narrower tablets: payment opens as a dialog from "Complete Sale". */}
      <Dialog open={paying && !wide} onOpenChange={setPaying}>
        <DialogContent className="gap-3 p-4 sm:max-w-sm">
          <DialogTitle className="sr-only">Payment</DialogTitle>
          <DialogDescription className="sr-only">Enter the cash received and confirm the sale.</DialogDescription>
          <PaymentPanel onConfirm={confirmPayment} pending={checkout.isPending} className="border-0 p-0 shadow-none" />
        </DialogContent>
      </Dialog>

      <ConflictDialog conflict={conflict} lines={lines} onAdjust={adjustToStock} onClose={() => setConflict(null)} />
      <ReceiptDialog sale={receipt} settings={settings.data} onNewSale={() => setReceipt(null)} />
    </div>
  );
}
