import type { Role } from "@/lib/api/types";

/**
 * Role-based access matrix from the PRD (section 2, "Role-Based Access Control
 * (RBAC) Matrix"). Each PRD row is a module; the cells become the permissions
 * below. UI gating is UX only: the API remains the authority.
 *
 * PRD cell                                   Admin | Keeper | Cashier
 * System Settings & User Onboarding          full  | none   | none      -> users.manage, settings.manage
 * Product Catalog Management                 CRUD  | add/edit| view     -> products.*
 * Stock Intake & Daily Audit                 full + approvals | log intake, daily stock take | view quantities
 * Sales Checkout / POS                       full  | none   | create orders, record payments
 * Sales History & Receipt Reprints           all   | none   | own shift only
 * Reports & Analytics                        revenue/profit/variance | stock movement | own shift totals
 * System Audit Logs                          all   | none   | none
 *
 * A few PRD cells are cut off with "..." in the source document (Keeper's
 * "Add/Edit SKUs & Product V...", "Log Intake, Perform Daily ...", Cashier's
 * "Create Orders, Record Pay...", Keeper's "Stock Movement Reports ...").
 * They are read as product variants, daily stock takes, payments and stock
 * movement reports, matching the module descriptions in section 3.
 *
 * Deliberate departure from the PRD: Cashiers only get POS. Their shift
 * history, catalog, quantities and shift totals are not available to them.
 */
export const PERMISSIONS = [
  "dashboard.view",
  "products.view",
  "products.edit", // create + edit products, variants and SKUs
  "products.delete",
  "inventory.view", // see quantities
  "inventory.intake", // log stock intake
  "stocktake.perform", // daily physical count
  "stocktake.approve",
  "pos.use", // create orders and record payment
  "sales.view_own", // own shift sales only
  "sales.view_all",
  "reports.shift_totals", // cashier: daily individual shift totals
  "reports.stock_movement", // keeper
  "reports.financial", // admin: revenue, profit, variance
  "audit.view",
  "users.manage",
  "settings.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const rolePermissions: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: [
    "dashboard.view",
    "products.view",
    "products.edit",
    "products.delete",
    "inventory.view",
    "inventory.intake",
    "stocktake.perform",
    "stocktake.approve",
    "pos.use",
    "sales.view_own",
    "sales.view_all",
    "reports.stock_movement",
    "reports.financial",
    "audit.view",
    "users.manage",
    "settings.manage",
  ],
  INVENTORY_KEEPER: [
    "products.view",
    "products.edit",
    "inventory.view",
    "inventory.intake",
    "stocktake.perform",
    "reports.stock_movement",
  ],
  // Cashiers work the till and nothing else: one page, so the shell drops the sidebar.
  CASHIER: ["pos.use"],
};

export function can(role: Role | undefined, permission: Permission): boolean {
  return role ? rolePermissions[role].includes(permission) : false;
}

export const roleLabels: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  INVENTORY_KEEPER: "Inventory Keeper",
  CASHIER: "Cashier",
};
