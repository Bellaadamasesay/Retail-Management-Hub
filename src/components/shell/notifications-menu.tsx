"use client";

import { AlertTriangle, Bell, ClipboardCheck, PartyPopper } from "lucide-react";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useProducts } from "@/features/catalog/api/use-products";
import { useStockTakes } from "@/features/inventory/api/use-stock-takes";
import { useSession } from "@/lib/auth/session-context";
import { can } from "@/lib/rbac/permissions";

interface Alert {
  id: string;
  href: string;
  icon: ReactNode;
  title: string;
  detail: string;
}

/** Bell with a dot when something needs attention: low stock, and (for admins) counts waiting for approval. */
export function NotificationsMenu() {
  const { role } = useSession();
  const products = useProducts();
  const takes = useStockTakes();

  const alerts = useMemo<Alert[]>(() => {
    const result: Alert[] = [];
    if (can(role, "inventory.view") && products.data) {
      const variants = products.data.flatMap((p) => p.variants);
      const out = variants.filter((v) => v.stock === 0).length;
      const low = variants.filter((v) => v.stock > 0 && v.stock <= v.reorderThreshold).length;
      if (low > 0) {
        result.push({
          id: "low",
          href: "/inventory",
          icon: <AlertTriangle className="size-4" />,
          title: `${low} ${low === 1 ? "item is" : "items are"} running low`,
          detail: "At or under their reorder point",
        });
      }
      if (out > 0) {
        result.push({
          id: "out",
          href: "/inventory",
          icon: <AlertTriangle className="size-4" />,
          title: `${out} ${out === 1 ? "item is" : "items are"} sold out`,
          detail: "Nothing left on the shelf",
        });
      }
    }
    if (can(role, "stocktake.approve") && takes.data) {
      const pending = takes.data.filter((t) => t.status === "pending_approval").length;
      if (pending > 0) {
        result.push({
          id: "approve",
          href: "/inventory/stock-take",
          icon: <ClipboardCheck className="size-4" />,
          title: `${pending} stock ${pending === 1 ? "take is" : "takes are"} waiting for approval`,
          detail: "Review the variances and approve",
        });
      }
    }
    return result;
  }, [role, products.data, takes.data]);

  return (
    <Popover>
      <PopoverTrigger
        aria-label={alerts.length ? `Notifications, ${alerts.length} new` : "Notifications"}
        className="relative grid size-10 shrink-0 place-items-center rounded-full text-foreground outline-none transition-colors hover:bg-surface-hover focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Bell className="size-5" aria-hidden="true" />
        {alerts.length > 0 ? (
          <span
            aria-hidden="true"
            className="absolute top-2 right-2.5 size-2 rounded-full bg-destructive ring-2 ring-background"
          />
        ) : null}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2">
        <p className="px-2 py-1.5 font-display text-base font-semibold">Notifications</p>
        {alerts.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg px-2 py-4 text-sm text-text-secondary">
            <PartyPopper className="size-5 text-kpi-sage-fg" aria-hidden="true" />
            You&apos;re all caught up. Nothing needs attention right now.
          </div>
        ) : (
          <ul className="flex flex-col">
            {alerts.map((alert) => (
              <li key={alert.id}>
                <Link
                  href={alert.href}
                  className="flex items-start gap-3 rounded-lg px-2 py-2.5 outline-none hover:bg-surface-hover focus-visible:bg-surface-hover"
                >
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-kpi-ochre-bg text-kpi-ochre-fg">
                    {alert.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{alert.title}</span>
                    <span className="block text-xs text-text-secondary">{alert.detail}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
