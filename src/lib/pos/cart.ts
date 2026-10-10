export interface CartLine {
  variantId: string;
  productId: string;
  name: string;
  /** "Black · 42", or "" for a product sold in one version. */
  label: string;
  /** Minor units. The server re-prices from the catalog at checkout. */
  unitPrice: number;
  quantity: number;
  /** Units on the shelf when last checked: the ceiling for this line. */
  stock: number;
}

export const lineTotal = (line: Pick<CartLine, "unitPrice" | "quantity">) => line.unitPrice * line.quantity;

export const cartTotal = (lines: readonly CartLine[]) => lines.reduce((n, l) => n + lineTotal(l), 0);

export const itemCount = (lines: readonly CartLine[]) => lines.reduce((n, l) => n + l.quantity, 0);

export type AddResult =
  | { status: "added"; lines: CartLine[] }
  | { status: "capped"; lines: CartLine[]; available: number }
  | { status: "sold-out"; lines: CartLine[] };

/** Adds one unit, but never more than the shelf holds. */
export function addToCart(lines: readonly CartLine[], line: Omit<CartLine, "quantity">): AddResult {
  if (line.stock <= 0) return { status: "sold-out", lines: [...lines] };
  const existing = lines.find((l) => l.variantId === line.variantId);
  if (!existing) return { status: "added", lines: [...lines, { ...line, quantity: 1 }] };
  if (existing.quantity >= line.stock) {
    return { status: "capped", available: line.stock, lines: lines.map((l) => (l.variantId === line.variantId ? { ...l, stock: line.stock } : l)) };
  }
  return {
    status: "added",
    lines: lines.map((l) => (l.variantId === line.variantId ? { ...l, quantity: l.quantity + 1, stock: line.stock } : l)),
  };
}

/** Sets a quantity, clamped between 1 and the line's stock. */
export function setQuantity(lines: readonly CartLine[], variantId: string, quantity: number): CartLine[] {
  return lines.map((l) =>
    l.variantId === variantId ? { ...l, quantity: Math.min(Math.max(1, Math.floor(quantity) || 1), Math.max(1, l.stock)) } : l,
  );
}
