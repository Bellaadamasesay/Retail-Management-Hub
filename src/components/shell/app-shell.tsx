"use client";

import type { ReactNode } from "react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useSession } from "@/lib/auth/session-context";
import { RoleRoute } from "@/lib/rbac/role-route";
import { hasNav } from "@/lib/rbac/routes";
import { useShellStore } from "@/lib/stores/shell-store";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./command-palette";
import { SidebarNav } from "./sidebar-nav";
import { Topbar } from "./topbar";

/** Authenticated frame: sidebar + topbar around the routed page. Single-page roles get the topbar only. */
export function AppShell({ children }: { children: ReactNode }) {
  const { role } = useSession();
  const nav = hasNav(role);
  const collapsed = useShellStore((s) => s.collapsed);
  const mobileNavOpen = useShellStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useShellStore((s) => s.setMobileNavOpen);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      {nav ? (
        <>
          <aside
            aria-label="Sidebar"
            className={cn(
              "hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out lg:flex",
              collapsed ? "w-[4.5rem]" : "w-[15.5rem]",
            )}
          >
            <div className={cn("flex h-[4.5rem] items-center px-6", collapsed && "justify-center px-0")}>
              {collapsed ? <LogoMark /> : <Logo />}
            </div>
            <div className={cn("flex-1 overflow-y-auto px-4 pt-3 pb-6", collapsed && "px-2")}>
              <SidebarNav collapsed={collapsed} />
            </div>
          </aside>

          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetContent side="left" showCloseButton={false} className="w-64 gap-0 bg-sidebar p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SheetDescription className="sr-only">Choose a page</SheetDescription>
              <div className="flex h-[4.5rem] items-center px-6">
                <Logo />
              </div>
              <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6">
                <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main id="main" className="flex-1 overflow-y-auto px-5 py-8 sm:px-8 xl:px-12">
          <RoleRoute>{children}</RoleRoute>
        </main>
      </div>

      {nav ? <CommandPalette /> : null}
    </div>
  );
}
