import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  json,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AuditChange } from "@/lib/api/types";

/**
 * The store's database. Money is integer minor units (cents of a Leone), as in
 * the UI. Stock only changes alongside a row in stock_movements, written in the
 * same transaction, so every balance can be traced.
 */

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });
const at = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const now = (name: string) => at(name).notNull().defaultNow();

export const role = pgEnum("role", ["SUPER_ADMIN", "INVENTORY_KEEPER", "CASHIER"]);
export const category = pgEnum("category", ["Shoes", "Bags", "Accessories"]);
export const movementType = pgEnum("movement_type", ["incoming", "outgoing", "adjustment"]);
export const stockTakeStatus = pgEnum("stock_take_status", ["in_progress", "pending_approval", "approved", "cancelled"]);
export const varianceReason = pgEnum("variance_reason", ["damage", "loss", "count_error"]);

/** Printed numbers: receipts RC-1001…, intakes INT-001…, counts STK-0001…, item labels 100001… */
export const receiptNumbers = pgSequence("receipt_number_seq", { startWith: 1001 });
export const intakeNumbers = pgSequence("intake_number_seq", { startWith: 1 });
export const stockTakeNumbers = pgSequence("stock_take_number_seq", { startWith: 1 });
export const labelCodes = pgSequence("label_code_seq", { startWith: 100001 });

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    username: text("username").notNull(),
    email: text("email").notNull(),
    role: role("role").notNull(),
    active: boolean("active").notNull().default(true),
    passwordHash: text("password_hash").notNull(),
    /** Cashiers only: 4-digit PIN for the shared till, hashed like the password. */
    pinHash: text("pin_hash"),
    /** Wrong passwords/PINs in a row; at the limit the account locks for a few minutes. */
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: at("locked_until"),
    lastLoginAt: at("last_login_at"),
    createdAt: now("created_at"),
  },
  (t) => [uniqueIndex("users_email_key").on(sql`lower(${t.email})`)],
);

export const settings = pgTable(
  "settings",
  {
    /** Always 1: the store has one settings row. */
    id: integer("id").primaryKey().default(1),
    storeName: text("store_name").notNull(),
    address: text("address").notNull().default(""),
    phone: text("phone").notNull().default(""),
  },
  (t) => [check("settings_single_row", sql`${t.id} = 1`)],
);

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  category: category("category").notNull(),
  description: text("description").notNull().default(""),
  price: integer("price").notNull(),
  cost: integer("cost").notNull(),
  active: boolean("active").notNull().default(true),
  /** Variation types in display order, e.g. ["Colour", "Size"]; empty for one version. */
  optionTypes: jsonb("option_types").$type<string[]>().notNull().default([]),
  /** The product photo (JPEG from the camera). Served by /api/products/:id/image. */
  image: bytea("image"),
  imageType: text("image_type"),
  /** Bumped when the photo changes, so browsers fetch the new one. */
  imageVersion: integer("image_version").notNull().default(0),
  /** Deleted products are hidden but kept, so old sales and stock history still have names. */
  deletedAt: at("deleted_at"),
  createdAt: now("created_at"),
  updatedAt: now("updated_at"),
});

export const variants = pgTable(
  "variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** The number on the item's QR label: what the till scans. */
    code: text("code")
      .notNull()
      .default(sql`nextval('label_code_seq')::text`),
    // json, not jsonb: jsonb reorders keys, and the order is how the variation reads ("Black · 42").
    options: json("options").$type<Record<string, string>>().notNull().default({}),
    stock: integer("stock").notNull().default(0),
    reorderThreshold: integer("reorder_threshold").notNull().default(3),
    /** Order within the product (the order the combinations were listed in). */
    position: integer("position").notNull().default(0),
  },
  (t) => [
    uniqueIndex("variants_code_key").on(t.code),
    index("variants_product_idx").on(t.productId),
    check("variants_stock_not_negative", sql`${t.stock} >= 0`),
  ],
);

export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    receiptNumber: text("receipt_number")
      .notNull()
      .default(sql`'RC-' || nextval('receipt_number_seq')`),
    createdAt: now("created_at"),
    cashierId: uuid("cashier_id")
      .notNull()
      .references(() => users.id),
    total: integer("total").notNull(),
    tendered: integer("tendered").notNull(),
    change: integer("change").notNull(),
    /** Sent by the till so a retried checkout can't sell twice. */
    idempotencyKey: text("idempotency_key"),
  },
  (t) => [
    uniqueIndex("sales_receipt_number_key").on(t.receiptNumber),
    uniqueIndex("sales_idempotency_key").on(t.idempotencyKey),
    index("sales_created_at_idx").on(t.createdAt),
    index("sales_cashier_idx").on(t.cashierId),
  ],
);

export const saleLines = pgTable(
  "sale_lines",
  {
    id: serial("id").primaryKey(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").notNull(),
    /** The item's name as it was sold (kept even if the product is renamed later). */
    name: text("name").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
  },
  (t) => [index("sale_lines_sale_idx").on(t.saleId)],
);

export const stockIntakes = pgTable("stock_intakes", {
  id: uuid("id").primaryKey().defaultRandom(),
  reference: text("reference")
    .notNull()
    .unique()
    .default(sql`'INT-' || lpad(nextval('intake_number_seq')::text, 3, '0')`),
  receivedAt: now("received_at"),
  supplier: text("supplier").notNull(),
  batchNote: text("batch_note").notNull().default(""),
  receivedBy: uuid("received_by")
    .notNull()
    .references(() => users.id),
});

export const intakeLines = pgTable("intake_lines", {
  id: serial("id").primaryKey(),
  intakeId: uuid("intake_id")
    .notNull()
    .references(() => stockIntakes.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id").notNull(),
  quantity: integer("quantity").notNull(),
  unitCost: integer("unit_cost").notNull(),
});

export const stockTakes = pgTable("stock_takes", {
  id: uuid("id").primaryKey().defaultRandom(),
  reference: text("reference")
    .notNull()
    .unique()
    .default(sql`'STK-' || lpad(nextval('stock_take_number_seq')::text, 4, '0')`),
  name: text("name").notNull(),
  /** A category, or "All". */
  scope: text("scope").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: now("created_at"),
  status: stockTakeStatus("status").notNull().default("in_progress"),
  submittedAt: at("submitted_at"),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: at("approved_at"),
});

export const stockTakeLines = pgTable("stock_take_lines", {
  id: serial("id").primaryKey(),
  takeId: uuid("take_id")
    .notNull()
    .references(() => stockTakes.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id").notNull(),
  expected: integer("expected").notNull(),
  counted: integer("counted"),
  reason: varianceReason("reason"),
});

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    at: now("at"),
    type: movementType("type").notNull(),
    /** INT-001 for an intake, the receipt number for a sale, STK-0001 for a count, or a note. */
    reference: text("reference").notNull(),
    variantId: uuid("variant_id").notNull(),
    /** Signed: positive adds stock, negative removes it. */
    quantity: integer("quantity").notNull(),
    /** Units on the shelf right after this movement. */
    balance: integer("balance").notNull(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
  },
  (t) => [index("stock_movements_variant_idx").on(t.variantId), index("stock_movements_at_idx").on(t.at)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    at: now("at"),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    detail: text("detail").notNull(),
    changes: jsonb("changes").$type<AuditChange[]>(),
  },
  (t) => [index("audit_log_at_idx").on(t.at)],
);

export const reportRuns = pgTable("report_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  href: text("href").notNull(),
  at: now("at"),
  generatedBy: uuid("generated_by")
    .notNull()
    .references(() => users.id),
  from: date("from", { mode: "string" }).notNull(),
  to: date("to", { mode: "string" }).notNull(),
});
