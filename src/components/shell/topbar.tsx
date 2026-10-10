"use client";

import { Menu, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth/session-context";
import { hasNav } from "@/lib/rbac/routes";
import { useShellStore } from "@/lib/stores/shell-store";
import { DatePicker } from "./date-picker";
import { NotificationsMenu } from "./notifications-menu";
import { ThemeMenu } from "./theme-menu";
import { UserMenu } from "./user-menu";

export function Topbar() {
  const pathname = usePathname();
  const nav = hasNav(useSession().role);
  const toggleCollapsed = useShellStore((s) => s.toggleCollapsed);
  const setMobileNavOpen = useShellStore((s) => s.setMobileNavOpen);
  const setPaletteOpen = useShellStore((s) => s.setPaletteOpen);

  const placeholder =
    pathname === "/dashboard"
      ? "Search products, sales, or reports…"
      : "Search products by name…";

  return (
    <div className="flex h-[4.5rem] shrink-0 items-center gap-4 border-b border-border-subtle px-5 sm:px-8 xl:px-12">
      {nav ? (
        <>
          <Button
            variant="outline"
            size="icon"
            aria-label="Open menu"
            className="lg:hidden"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Collapse or expand sidebar"
            className="hidden lg:inline-flex"
            onClick={toggleCollapsed}
          >
            <Menu />
          </Button>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search (Ctrl K)"
            className="flex h-10 min-w-0 max-w-[31rem] flex-1 items-center gap-3 rounded-lg border border-input bg-input-background px-3.5 text-left text-sm text-text-muted outline-none transition-colors hover:border-ring focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <Search className="size-[1.1rem] shrink-0 text-text-secondary" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{placeholder}</span>
            <kbd className="hidden shrink-0 rounded-md bg-surface-hover px-2 py-0.5 text-xs text-text-secondary sm:block">
              ⌘ K
            </kbd>
          </button>
        </>
      ) : (
        // No sidebar to carry the brand, so it moves up here.
        <Logo />
      )}

      <div className="ml-auto flex items-center gap-2 sm:gap-4">
        <NotificationsMenu />
        <UserMenu />
        <ThemeMenu />
        {/* The reference date only drives the dashboard, sales history and reports. */}
        {nav ? <DatePicker /> : null}
      </div>
    </div>
  );
}
