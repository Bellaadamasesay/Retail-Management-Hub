"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Coins, Percent, ShoppingCart, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { SeriesBarChart, SeriesLegend, type Series } from "@/components/charts/series-bar-chart";
import { DataTable } from "@/components/data/data-table";
import { Money } from "@/components/data/money";
import { StatCard } from "@/components/data/stat-card";
import { Card } from "@/components/ui/card";
import { useProducts } from "@/features/catalog/api/use-products";
import { useSales } from "@/features/sales/api/use-sales";
import { downloadCsv } from "@/lib/csv";
import { formatDayMonth } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { useLogReportRun } from "../api/use-report-runs";
import { useReportRange } from "../lib/range";
import { profitByCategory, revenueByDay, revenueTotals, topItems, type ItemRow } from "../lib/reports";
import { ReportFrame } from "./report-frame";

const series: Series[] = [
  { key: "revenue", label: "Revenue", token: "var(--chart-1)", className: "bg-chart-1" },
  { key: "profit", label: "Profit", token: "var(--chart-2)", className: "bg-chart-2" },
];

/** Compact money for chart axes: 6k, 1.2M. */
const axis = (minor: number) => {
  const v = minor / 100;
  return v >= 1_000_000 ? `${+(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(v);
};

const columns: ColumnDef<ItemRow, unknown>[] = [
  {
    id: "item",
    header: "Item",
    accessorFn: (r) => `${r.name} ${r.label}`,
    cell: ({ row }) => (
      <span>
        {row.original.name}
        {row.original.label ? <span className="text-text-secondary"> · {row.original.label}</span> : null}
      </span>
    ),
  },
  { accessorKey: "units", header: "Units" },
  { accessorKey: "revenue", header: "Revenue", cell: ({ getValue }) => <Money amount={Number(getValue())} /> },
  { accessorKey: "profit", header: "Profit", cell: ({ getValue }) => <Money amount={Number(getValue())} className="font-medium" /> },
];

/** Super Admin: revenue, cost of goods and profit over a date range. */
export function RevenueReport() {
  const { range, setRange, tuple, today } = useReportRange();
  const sales = useSales();
  const products = useProducts();
  const log = useLogReportRun();

  const catalog = useMemo(() => products.data ?? [], [products.data]);
  const all = useMemo(() => sales.data ?? [], [sales.data]);
  const days = useMemo(() => revenueByDay(all, catalog, tuple), [all, catalog, tuple]);
  const totals = revenueTotals(days);
  const chart = days.map((d) => ({ label: formatDayMonth(`${d.day}T12:00:00Z`), revenue: d.revenue, profit: d.profit }));
  const best = useMemo(() => topItems(all, catalog, tuple, 10), [all, catalog, tuple]);
  const categories = useMemo(() => profitByCategory(all, catalog, tuple), [all, catalog, tuple]);

  async function exportReport() {
    downloadCsv(`danicess-revenue-profit-${tuple[0]}-to-${tuple[1]}.csv`, [
      ["Day", "Sales", "Items sold", "Revenue (Le)", "Cost of goods (Le)", "Profit (Le)"],
      ...days.map((d) => [d.day, d.sales, d.units, d.revenue / 100, d.cost / 100, d.profit / 100]),
      ["Total", totals.sales, totals.units, totals.revenue / 100, totals.cost / 100, totals.profit / 100],
    ]);
    try {
      await log.mutateAsync({ name: "Revenue & Profit Report", type: "Revenue & Profit", href: "/reports/revenue", from: tuple[0], to: tuple[1] });
      toast.success("Revenue & profit report exported", { description: "It's listed under Recent Reports." });
    } catch {
      toast.error("Exported, but couldn’t add it to Recent Reports");
    }
  }

  return (
    <ReportFrame
      title="Revenue & Profit"
      description="What came in, what it cost, and what was left."
      crumbs={[{ label: "Reports", href: "/reports" }, { label: "Revenue & Profit" }]}
      range={range}
      onRange={setRange}
      today={today}
      onExport={exportReport}
      exportDisabled={sales.isPending}
    >
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" kind="money" value={totals.revenue} icon={ShoppingCart} accent="forest" hint={`${totals.sales} sales`} />
        <StatCard label="Cost of Goods" kind="money" value={totals.cost} icon={Coins} accent="ochre" hint="At current cost prices" />
        <StatCard label="Profit" kind="money" value={totals.profit} icon={TrendingUp} accent="sage" hint="Revenue minus cost of goods" />
        <StatCard label="Margin" value={totals.margin} icon={Percent} accent="clay" hint="Profit as a % of revenue" />
      </div>

      <Card className="gap-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Revenue and profit by day</h2>
          <SeriesLegend series={series} />
        </div>
        <SeriesBarChart data={chart} series={series} format={axis} label="Revenue and profit by day for the chosen dates" />
        <p className="text-xs text-text-secondary">
          Sales don&apos;t store the cost they were bought at, so profit uses each product&apos;s current cost price. If a cost
          changes, past profit is restated.
        </p>
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section aria-labelledby="best-sellers" className="flex flex-col gap-2">
          <h2 id="best-sellers" className="font-display text-lg font-semibold">
            Best sellers
          </h2>
          <DataTable
            columns={columns}
            data={best}
            pageSize={5}
            pageSizeOptions={[5, 10]}
            itemLabel="items"
            getRowId={(r) => r.variantId}
            empty={{ title: "No sales in these dates", description: "Pick a wider date range." }}
          />
        </section>
        <Card className="gap-4 p-6">
          <h2 className="font-display text-lg font-semibold">By category</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-table-header">
              <tr>
                <th className="py-1.5 font-medium">Category</th>
                <th className="py-1.5 text-right font-medium">Revenue</th>
                <th className="py-1.5 text-right font-medium">Profit</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(categories) as (keyof typeof categories)[]).map((c) => (
                <tr key={c} className="border-t border-border-subtle">
                  <td className="py-2">{c}</td>
                  <td className="tabular py-2 text-right">{formatMoney(categories[c].revenue)}</td>
                  <td className="tabular py-2 text-right font-medium">{formatMoney(categories[c].profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </ReportFrame>
  );
}
