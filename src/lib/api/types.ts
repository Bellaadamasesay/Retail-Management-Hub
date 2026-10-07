/** Domain types shared by the mock API now and the real API client later. Money is integer minor units. */

export type Role = "SUPER_ADMIN" | "INVENTORY_KEEPER" | "CASHIER";

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

/** A staff entry as seeded in the fixtures; the database adds when the account was created. */
export type SeedUser = Omit<User, "createdAt">;

/** Just enough to show who did something: safe for every role to read. */
export interface StaffName {
  id: string;
  name: string;
}

export type Category = "Shoes" | "Bags" | "Accessories";

export interface Variant {
  id: string;
  productId: string;
  sku: string;
  colour: string;
  /** Shoe size, belt size, or "One size". */
  size: string;
  /** Units currently on the shelf. */
  stock: number;
  /** Alert management when stock falls to or below this. */
  reorderThreshold: number;
}

export interface Product {
  id: string;
  /** Short parent code used as the SKU prefix, e.g. "LTB". */
  code: string;
  name: string;
  category: Category;
  description: string;
  /** Selling price in minor units. */
  price: number;
  /** Cost price in minor units. */
  cost: number;
  variants: Variant[];
  /** Inactive products stay in the catalog but cannot be sold. */
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockIntake {
  id: string;
  /** Printed reference, e.g. "INT-001". */
  reference: string;
  receivedAt: string;
  supplier: string;
  batchNote: string;
  receivedBy: string;
  lines: { variantId: string; quantity: number; unitCost: number }[];
}

export type VarianceReason = "damage" | "loss" | "count_error";

export interface StockTakeLine {
  variantId: string;
  /** What the system said was on the shelf when the count started. */
  expected: number;
  /** What was physically counted; null until that line has been counted. */
  counted: number | null;
  /** Mandatory whenever counted differs from expected. */
  reason?: VarianceReason;
}

export type StockTakeStatus = "in_progress" | "pending_approval" | "approved" | "cancelled";

export interface StockTake {
  id: string;
  /** Printed reference, e.g. "STK-0012". */
  reference: string;
  name: string;
  /** Which part of the catalog this count covers. */
  scope: Category | "All";
  /** The trading day being counted (yyyy-mm-dd). */
  date: string;
  createdBy: string;
  createdAt: string;
  status: StockTakeStatus;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  lines: StockTakeLine[];
}

export type MovementType = "incoming" | "outgoing" | "adjustment";

/** One entry in the stock ledger: stock arriving, leaving through a sale, or corrected by an approved count. */
export interface StockMovement {
  id: string;
  at: string;
  type: MovementType;
  /** INT-001 for intake, the receipt number for a sale, STK-0012 for a count. */
  reference: string;
  variantId: string;
  /** Signed: positive adds stock, negative removes it. */
  quantity: number;
  /** Units on the shelf right after this movement. */
  balance: number;
  actorId: string;
}

export interface SaleLine {
  variantId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
}

export interface Sale {
  id: string;
  receiptNumber: string;
  createdAt: string;
  cashierId: string;
  lines: SaleLine[];
  total: number;
  /** Payment is always cash: no other methods and no split payments. Both values are minor units. */
  payment: {
    /** Cash handed over by the customer (>= total). */
    tendered: number;
    /** Change given back: tendered - total. */
    change: number;
  };
}

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string;
  action:
    | "sale.create"
    | "stock.intake"
    | "stock.take.submit"
    | "stock.take.approve"
    | "stock.take.cancel"
    | "product.create"
    | "product.price_change"
    | "product.delete"
    | "user.create"
    | "user.update"
    | "user.revoke"
    | "user.restore"
    | "user.reset_credentials"
    | "settings.update";
  entity: string;
  detail: string;
  /** Before and after, for entries that changed something. Shown as a diff in the audit log. */
  changes?: AuditChange[];
}

export interface AuditChange {
  field: string;
  from: string;
  to: string;
}

export interface UserInput {
  name: string;
  email: string;
  role: Role;
}

export interface VariantInput {
  /** Present when editing an existing variant; absent for a new one. */
  id?: string;
  sku: string;
  colour: string;
  size: string;
  reorderThreshold: number;
}

/** Body for creating or updating a product. Stock is never set here: it moves through intake, stock take and sales. */
export interface ProductInput {
  code: string;
  name: string;
  category: Category;
  description: string;
  price: number;
  cost: number;
  active: boolean;
  variants: VariantInput[];
}

/** Body of a checkout. Prices and totals are never sent: the server reads them from the catalog. */
export interface SaleInput {
  lines: { variantId: string; quantity: number }[];
  /** Cash handed over, in minor units. */
  tendered: number;
}

/** What the till can say about a sale it refused because stock ran short (HTTP 409). */
export interface StockConflict {
  message: string;
  shortages: { variantId: string; requested: number; available: number }[];
}

/** Store details printed on receipts. Editable in Settings. */
export interface StoreSettings {
  storeName: string;
  address: string;
  phone: string;
}

export type ReportType = "Sales" | "Revenue & Profit" | "Variance" | "Stock Movement" | "Shift Totals";

/** One generated or exported report, for the "Recent Reports" list. */
export interface ReportRun {
  id: string;
  name: string;
  type: ReportType;
  /** Where it opens, e.g. "/reports/revenue". */
  href: string;
  at: string;
  generatedBy: string;
  /** Inclusive day range the report covered. */
  from: string;
  to: string;
}
