import { create } from "zustand";
import { addToCart, setQuantity, type AddResult, type CartLine } from "@/lib/pos/cart";

interface CartState {
  lines: CartLine[];
  /** Sent with checkout so a retry after a dropped connection can't sell twice. */
  idempotencyKey: string;
  add: (line: Omit<CartLine, "quantity">) => { status: AddResult["status"]; available?: number };
  setQuantity: (variantId: string, quantity: number) => void;
  setStock: (stock: Record<string, number>) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  /** Puts a basket back (undo for Clear Cart). */
  restore: (lines: CartLine[]) => void;
}

const newKey = () => crypto.randomUUID();

export const useCart = create<CartState>((set, get) => ({
  lines: [],
  idempotencyKey: newKey(),
  add: (line) => {
    const result = addToCart(get().lines, line);
    // The basket changed, so this is a different sale than any earlier attempt.
    set({ lines: result.lines, idempotencyKey: result.status === "added" ? newKey() : get().idempotencyKey });
    return { status: result.status, available: result.status === "capped" ? result.available : undefined };
  },
  setQuantity: (variantId, quantity) =>
    set((s) => ({ lines: setQuantity(s.lines, variantId, quantity), idempotencyKey: newKey() })),
  setStock: (stock) =>
    set((s) => ({
      lines: s.lines.map((l) => {
        const available = stock[l.variantId];
        return available === undefined ? l : { ...l, stock: available, quantity: Math.min(l.quantity, Math.max(available, 0)) };
      }).filter((l) => l.quantity > 0),
      idempotencyKey: newKey(),
    })),
  remove: (variantId) => set((s) => ({ lines: s.lines.filter((l) => l.variantId !== variantId), idempotencyKey: newKey() })),
  clear: () => set({ lines: [], idempotencyKey: newKey() }),
  restore: (lines) => set({ lines, idempotencyKey: newKey() }),
}));
