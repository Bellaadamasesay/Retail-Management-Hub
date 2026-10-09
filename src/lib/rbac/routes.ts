import {
  Boxes,
  ClipboardCheck,
  ClipboardList,
  FileBarChart,
  History,
  House,
  PackagePlus,
  ReceiptText,
  Settings,
  ShoppingBag,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/api/types";
import { can, type Permission } from "./permissions";

export type NavGroup = "Sales" | "Inventory" | "Analytics & Admin";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Visible when the role holds at least one of these. */
  anyOf: readonly Permission[];
  /** Section heading in the sidebar; the Dashboard stands on its own above the sections. */
  group?: NavGroup;
}

/**
 * Sidebar layout. The PRD defines three interfaces/modules (Sales & POS,
 * Inventory & Stock Management, Super Admin & Analytics), so the sidebar is
 * grouped the same way: the Super Admin Dashboard on top, then Sales, then
 * Inventory (catalog, intake and the daily stock take, in the PRD's order),
 * then Analytics & Admin (reports, audit, users and settings). A role only
 * sees the items it has access to, and empty sections disappear.
 */
export const navItems: readonly NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: House, anyOf: ["dashboard.view"] },

  { label: "Sales / POS", href: "/pos", icon: ReceiptText, anyOf: ["pos.use"], group: "Sales" },
  { label: "Sales History", href: "/sales", icon: History, anyOf: ["sales.view_own", "sales.view_all"], group: "Sales" },

  { label: "Inventory", href: "/inventory", icon: Boxes, anyOf: ["inventory.view"], group: "Inventory" },
  { label: "Products", href: "/products", icon: ShoppingBag, anyOf: ["products.view"], group: "Inventory" },
  { label: "Stock Intake", href: "/inventory/intake", icon: PackagePlus, anyOf: ["inventory.intake"], group: "Inventory" },
  {
    label: "Stock Take",
    href: "/inventory/stock-take",
    icon: ClipboardList,
    anyOf: ["stocktake.perform", "stocktake.approve"],
    group: "Inventory",
  },

  {
    label: "Reports",
    href: "/reports",
    icon: FileBarChart,
    anyOf: ["reports.shift_totals", "reports.stock_movement", "reports.financial"],
    group: "Analytics & Admin",
  },
  { label: "Audit Logs", href: "/audit", icon: ClipboardCheck, anyOf: ["audit.view"], group: "Analytics & Admin" },
  { label: "Users", href: "/users", icon: Users, anyOf: ["users.manage"], group: "Analytics & Admin" },
  { label: "Settings", href: "/settings", icon: Settings, anyOf: ["settings.manage"], group: "Analytics & Admin" },
];

/** Routes that are not in the sidebar but still need a guard. */
const extraRoutes: readonly Pick<NavItem, "href" | "anyOf">[] = [
  { href: "/reports/revenue", anyOf: ["reports.financial"] },
  { href: "/reports/variance", anyOf: ["reports.financial"] },
  { href: "/reports/stock-movement", anyOf: ["reports.stock_movement"] },
  { href: "/reports/shift", anyOf: ["reports.shift_totals"] },
];

const guarded = [...navItems, ...extraRoutes];

/** Where each role lands after signing in. */
export const landingPath: Record<Role, string> = {
  SUPER_ADMIN: "/dashboard",
  INVENTORY_KEEPER: "/inventory",
  CASHIER: "/pos",
};

export const FORBIDDEN_PATH = "/forbidden";

function matches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The most specific guarded route for a path (so /inventory/stock-take beats /inventory). */
function routeFor(pathname: string) {
  return guarded
    .filter((r) => matches(pathname, r.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

export function canAccessPath(role: Role | undefined, pathname: string): boolean {
  if (!role) return false;
  const route = routeFor(pathname);
  // Paths outside the guarded set (e.g. /forbidden) are open to any signed-in user.
  if (!route) return true;
  return route.anyOf.some((p) => can(role, p));
}

export function navFor(role: Role | undefined): NavItem[] {
  return navItems.filter((item) => item.anyOf.some((p) => can(role, p)));
}

/** Roles with a single page get no sidebar, menu button or page search. */
export function hasNav(role: Role | undefined): boolean {
  return navFor(role).length > 1;
}

/** Which sidebar item is active for a path: the most specific match. */
export function activeNavHref(pathname: string): string | undefined {
  return navItems
    .filter((i) => matches(pathname, i.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}
