"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ShoppingBag, ShoppingCart, Package } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { SalesBarChart, SeriesLegend } from "@/components/charts/sales-bar-chart";
import { StatusDonut } from "@/components/charts/status-donut";
import { Money } from "@/components/data/money";
import { StatCard } from "@/components/data/stat-card";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProducts } from "@/features/catalog/api/use-products";
import { ProductPicture } from "@/features/catalog/components/product-picture";
import { useSales } from "@/features/sales/api/use-sales";
import { dailySeries, dayKey, percentChange } from "@/features/sales/lib/sales";
import { queryKeys } from "@/lib/api/query-keys";
import { useSession } from "@/lib/auth/session-context";
import { formatDayMonth } from "@/lib/format/date";
import { firstName, greetingFor } from "@/lib/format/greeting";
import { useRealtime } from "@/lib/realtime/use-realtime";
import { useShellStore } from "@/lib/stores/shell-store";
import { useStaggerIn } from "@/lib/motion/use-stagger-in";
import { appNow } from "@/lib/time";
import { cn } from "@/lib/utils";
import {
  categoryRevenue,
  comparisonLabel,
  CATEGORIES,
  inventoryStatus,
  kpisFor,
  lowStock,
  peakHours,
  rangeFor,
  rangeLabels,
  salesBuckets,
  topProducts,
  type DashboardRange,
} from "../lib/metrics";
import { ActivityFeed } from "./activity-feed";
import { LowStockPanel } from "./low-stock-panel";
import { PeakHours } from "./peak-hours";

const RANGES: DashboardRange[] = ["today", "week", "month"];

function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card data-stagger className={cn("gap-4 p-6", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

const viewAll = (href: string, label: string) => (
  <Link href={href} className="text-sm font-medium text-primary underline underline-offset-2 hover:text-primary-hover" aria-label={label}>
    View All
  </Link>
);

/** The Super Admin's editorial overview: KPIs, sales by category, best sellers, stock health, busiest hours, low stock and live activity. */
export function DashboardView() {
  const session = useSession();
  const client = useQueryClient();
  const sales = useSales();
  const products = useProducts();
  const asOf = useShellStore((s) => s.asOf);
  const [range, setRange] = useState<DashboardRange>("today");
  const grid = useStaggerIn<HTMLDivElement>({ dependencies: [sales.isSuccess && products.isSuccess] });

  const now = appNow();
  const day = asOf ?? dayKey(now.toISOString());

  // Live: a sale or stock change anywhere refreshes the numbers and the activity feed.
  useRealtime(() => {
    for (const queryKey of [["sales"], queryKeys.products, queryKeys.audit, queryKeys.movements]) {
      void client.invalidateQueries({ queryKey });
    }
  });

  const allSales = useMemo(() => sales.data ?? [], [sales.data]);
  const catalog = useMemo(() => products.data ?? [], [products.data]);
  const win = useMemo(() => rangeFor(range, day), [range, day]);
  const kpi = useMemo(() => kpisFor(allSales, range, day), [allSales, range, day]);
  const buckets = useMemo(() => salesBuckets(allSales, catalog, win, (d) => formatDayMonth(`${d}T12:00:00Z`)), [allSales, catalog, win]);
  const best = useMemo(() => topProducts(allSales, catalog, win), [allSales, catalog, win]);
  const categories = useMemo(() => categoryRevenue(allSales, catalog, win), [allSales, catalog, win]);
  const busiest = useMemo(() => peakHours(allSales, day), [allSales, day]);
  const status = useMemo(() => inventoryStatus(catalog), [catalog]);
  const trendDays = range === "month" ? 14 : 7;
  const delta = (current: number, previous: number) => {
    const percent = percentChange(current, previous);
    return percent === undefined ? undefined : { percent, label: comparisonLabel[range] };
  };

  const attention = lowStock(catalog, 999);
  const out = attention.filter((i) => i.stock === 0).length;
  const low = attention.length - out;
  const loading = sales.isPending || products.isPending;
  const categoryTotal = CATEGORIES.reduce((n, c) => n + categories[c], 0);
  const label = `Sales by category, ${rangeLabels[range].toLowerCase()}`;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Dashboard"
        description={
          loading
            ? " "
            : `${greetingFor(new Date().getHours())}, ${firstName(session.name)}. ${
                attention.length === 0
                  ? "Everything is stocked above its reorder point."
                  : `${out > 0 ? `${out} ${out === 1 ? "item is" : "items are"} sold out` : ""}${out > 0 && low > 0 ? " and " : ""}${low > 0 ? `${low} ${low === 1 ? "is" : "are"} running low` : ""}.`
              }`
        }
        actions={
          <div role="radiogroup" aria-label="Period" className="flex gap-2">
            {RANGES.map((r) => (
              <Button
                key={r}
                type="button"
                role="radio"
                aria-checked={range === r}
                variant={range === r ? "default" : "outline"}
                className="h-10 px-5"
                onClick={() => setRange(r)}
              >
                {rangeLabels[r]}
              </Button>
            ))}
          </div>
        }
      />

      {loading ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]" aria-busy="true" aria-label="Loading dashboard">
          <div className="flex flex-col gap-8">
            <div className="grid gap-6 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-36" />
              ))}
            </div>
            <Skeleton className="h-80" />
          </div>
          <Skeleton className="h-[34rem]" />
        </div>
      ) : (
        <div ref={grid} className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="flex min-w-0 flex-col gap-6">
            <div className="grid gap-6 md:grid-cols-3">
              <StatCard
                label="Total Sales"
                kind="money"
                value={kpi.current.total}
                icon={Package}
                accent="forest"
                delta={delta(kpi.current.total, kpi.previous.total)}
                hint={`${formatDayMonth(`${win[0]}T12:00:00Z`)}${win[0] === win[1] ? "" : ` to ${formatDayMonth(`${win[1]}T12:00:00Z`)}`}`}
                trend={dailySeries(allSales, day, trendDays, (t) => t.total)}
              />
              <StatCard
                label="Transactions"
                value={kpi.current.count}
                icon={ShoppingCart}
                accent="clay"
                delta={delta(kpi.current.count, kpi.previous.count)}
                hint="Sales rung up"
                trend={dailySeries(allSales, day, trendDays, (t) => t.count)}
              />
              <StatCard
                label="Items Sold"
                value={kpi.current.units}
                icon={ShoppingBag}
                accent="sage"
                delta={delta(kpi.current.units, kpi.previous.units)}
                hint="Units sold"
                trend={dailySeries(allSales, day, trendDays, (t) => t.units)}
              />
            </div>

            <div className="grid items-start gap-6 min-[1800px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <Panel title="Sales Overview" action={<SeriesLegend />}>
                <SalesBarChart data={buckets} label={label} />
              </Panel>
              <Panel title="Top Selling Products" action={viewAll("/products", "View all products")}>
                {best.length === 0 ? (
                  <p className="py-6 text-sm text-text-secondary">No sales in this period yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-table-header">
                      <tr className="bg-background-subtle">
                        <th className="rounded-l-lg px-2 py-2 font-medium">#</th>
                        <th className="px-2 py-2 font-medium">Product</th>
                        <th className="px-2 py-2 text-right font-medium">Qty Sold</th>
                        <th className="rounded-r-lg px-2 py-2 text-right font-medium">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {best.map((p, i) => {
                        const product = catalog.find((c) => c.id === p.productId);
                        return (
                          <tr key={p.productId} className="border-b border-border-subtle last:border-0">
                            <td className="px-2 py-2.5 text-text-secondary">{i + 1}</td>
                            <td className="px-2 py-2.5">
                              <span className="flex items-center gap-2.5">
                                {product ? <ProductPicture product={product} className="size-8" /> : null}
                                {p.name}
                              </span>
                            </td>
                            <td className="tabular px-2 py-2.5 text-right">{p.quantity}</td>
                            <td className="px-2 py-2.5 text-right">
                              <Money amount={p.revenue} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </Panel>
            </div>

            <div className="grid items-start gap-6 min-[1800px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <Panel title="Busiest Hours" action={<span className="text-xs text-text-secondary">Last 4 weeks</span>}>
                <PeakHours grid={busiest} />
              </Panel>
              <Panel title="Low Stock Alerts" action={viewAll("/inventory", "View all inventory")}>
                <LowStockPanel products={catalog} />
              </Panel>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <Panel title="Inventory Status" action={viewAll("/inventory", "View inventory")}>
              <StatusDonut counts={status} />
            </Panel>
            <Panel title="Recent Activities" action={viewAll("/audit", "View audit logs")}>
              <ActivityFeed />
            </Panel>
            <Panel title="Top Categories">
              <ul className="flex flex-col gap-3">
                {CATEGORIES.map((c, i) => {
                  const share = categoryTotal ? (categories[c] / categoryTotal) * 100 : 0;
                  return (
                    <li key={c}>
                      <p className="mb-1 flex items-baseline justify-between text-sm">
                        <span>{c}</span>
                        <span className="text-text-secondary">
                          <Money amount={categories[c]} /> · {Math.round(share)}%
                        </span>
                      </p>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-hover">
                        <div className={cn("h-full rounded-full", ["bg-chart-1", "bg-chart-2", "bg-chart-3"][i])} style={{ width: `${share}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
