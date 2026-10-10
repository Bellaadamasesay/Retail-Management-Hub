"use client";

import { Clock } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { useProducts } from "@/features/catalog/api/use-products";
import { useSales } from "@/features/sales/api/use-sales";
import { ApiError } from "@/lib/api/client";
import type { Product, Sale, StockConflict, Variant } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session-context";
import { itemName, variantLabel } from "@/lib/inventory/stock";
import { can } from "@/lib/rbac/permissions";
import { canAccessPath } from "@/lib/rbac/routes";
import { flyTo } from "@/lib/motion/fly";
import { cartTotal } from "@/lib/pos/cart";
import { appNow } from "@/lib/time";
import { fetchAvailability, useCheckout, useStoreSettings } from "../api/use-checkout";
import { useCart } from "../store/cart-store";
import { CartPanel } from "./cart-panel";
import { ConflictDialog } from "./conflict-dialog";
import { ProductPanel } from "./product-panel";
import { ReceiptDialog } from "./receipt-dialog";
import { ScanPanel, type ScanOutcome } from "./scan-panel";

export function PosView() {
  const session = useSession();
  const products = useProducts();
  const settings = useStoreSettings();
  const mySales = useSales(session.sub);
  const checkout = useCheckout();
  // Roles that may browse the catalog pick from the grid; cashiers scan the item's label.
  const browse = can(session.role, "products.view");

  const lines = useCart((s) => s.lines);
  const idempotencyKey = useCart((s) => s.idempotencyKey);
  const add = useCart((s) => s.add);
  const clear = useCart((s) => s.clear);
  const setStock = useCart((s) => s.setStock);

  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [conflict, setConflict] = useState<StockConflict | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const catalog = useMemo(() => products.data ?? [], [products.data]);
  const byVariant = useMemo(() => {
    const map = new Map<string, { product: Product; variant: Variant }>();
    for (const product of catalog) for (const variant of product.variants) map.set(variant.id, { product, variant });
    return map;
  }, [catalog]);

  const addVariant = useCallback(
    async (product: Product, variant: Variant, source: Element | null): Promise<ScanOutcome> => {
      // A label can outlive the product: checkout would refuse it, so say so now.
      if (!product.active) {
        toast.error(`${product.name} is no longer for sale`, { description: "Put it aside and let your Super Admin know." });
        return "inactive";
      }
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
        unitPrice: product.price,
        stock,
      });
      if (result.status === "sold-out") {
        toast.error(`${itemName(product, variant)} is sold out`, { description: "There are none left on the shelf." });
      } else if (result.status === "capped") {
        toast.warning(`Only ${result.available} of ${itemName(product, variant)} on the shelf`, {
          description: "That's all of them in the cart.",
        });
      } else {
        flyTo(source, document.querySelector("[data-cart-target]"));
      }
      return result.status;
    },
    [add],
  );

  const findByCode = useCallback(
    (raw: string) => {
      const code = raw.trim().toLowerCase();
      return [...byVariant.values()].find((e) => e.variant.code.toLowerCase() === code) ?? null;
    },
    [byVariant],
  );

  const addByCode = useCallback(
    (raw: string) => {
      const hit = findByCode(raw);
      if (!hit) return false;
      void addVariant(hit.product, hit.variant, null);
      return true;
    },
    [findByCode, addVariant],
  );

  const dialogOpen = receipt !== null || conflict !== null;

  // The F2 listener outlives renders; always complete the current cart.
  const completeRef = useRef(completeSale);
  useEffect(() => {
    completeRef.current = completeSale;
  });

  // Till shortcuts: "/" jumps to search (or the item code field), F2 completes the sale.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const typing = event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
      if (event.key === "/" && !typing && !dialogOpen) {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "F2" && !dialogOpen) {
        event.preventDefault();
        completeRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialogOpen]);

  const total = cartTotal(lines);

  /** Cash only, always the exact amount: nothing to type, and no change to give. */
  async function completeSale() {
    if (total <= 0 || checkout.isPending) return;
    const firstToday = !(mySales.data ?? []).some(
      (s) => new Date(s.createdAt).toISOString().slice(0, 10) === appNow().toISOString().slice(0, 10),
    );
    try {
      const sale = await checkout.mutateAsync({
        input: { lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })), tendered: total },
        idempotencyKey,
      });
      clear();
      setReceipt(sale);
      if (firstToday) toast.success("That's your first sale of the day", { description: "A good start." });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
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
        description={
          browse
            ? "Search for a product, or select from the list to add items to the cart."
            : "Scan each item to add it to the cart."
        }
        actions={
          canAccessPath(session.role, "/sales") ? (
            <Link href="/sales" className={buttonVariants({ variant: "outline", className: "h-11 px-5" })}>
              <Clock aria-hidden="true" /> Recent Sales
            </Link>
          ) : null
        }
      />

      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_28rem]">
        {browse ? (
          <ProductPanel
            products={catalog}
            searchRef={searchRef}
            onPick={(product, variant, source) => void addVariant(product, variant, source)}
            onExactCode={addByCode}
          />
        ) : (
          <ScanPanel
            inputRef={searchRef}
            lookup={findByCode}
            onAdd={(product, variant) => addVariant(product, variant, null)}
            onUnknown={(code) =>
              toast.error(`No item has the code “${code}”`, {
                description: "Check the label and scan again, or ask your Super Admin.",
              })
            }
          />
        )}
        <CartPanel
          productOf={(id) => catalog.find((p) => p.id === id)}
          onComplete={() => void completeSale()}
          pending={checkout.isPending}
          emptyHint={browse ? "Tap a product to start the sale." : "Scan an item to start the sale."}
        />
      </div>

      <ConflictDialog conflict={conflict} lines={lines} onAdjust={adjustToStock} onClose={() => setConflict(null)} />
      <ReceiptDialog
        sale={receipt}
        settings={settings.data}
        onNewSale={() => {
          setReceipt(null);
          // Ready for the next customer's first scan.
          if (!browse) setTimeout(() => searchRef.current?.focus());
        }}
      />
    </div>
  );
}
