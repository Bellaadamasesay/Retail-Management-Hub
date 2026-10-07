"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, BarChart3, ClipboardCheck, MoreHorizontal, Package, ShoppingBag, ShoppingCart, TrendingUp, Truck } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { toast } from "sonner";
import { SalesBarChart, SeriesLegend } from "@/components/charts/sales-bar-chart";
import { DataTable } from "@/components/data/data-table";
import { StatCard } from "@/components/data/stat-card";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useProducts } from "@/features/catalog/api/use-products";
import { salesBuckets } from "@/features/dashboard/lib/metrics";
import { useSales } from "@/features/sales/api/use-sales";
import { addDays, dailySeries, salesBetween, totalsOf } from "@/features/sales/lib/sales";
import { useStaffName } from "@/features/users/api/use-users";
import type { ReportRun } from "@/lib/api/types";
import { downloadCsv } from "@/lib/csv";
import { formatDateTime, formatDayMonth } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import { useLogReportRun, useReportRuns } from "../api/use-report-runs";
import { useReportRange } from "../lib/range";
import { ReportFrame } from "./report-frame";

const typeIcon: Record<ReportRun["type"], { icon: typeof BarChart3; tone: string }> = {
  Sales: { icon: BarChart3, tone: "bg-kpi-info-bg text-kpi-info-fg" },
  "Revenue & Profit": { icon: TrendingUp, tone: "bg-kpi-forest-bg text-kpi-forest-fg" },
  Variance: { icon: ClipboardCheck, tone: "bg-kpi-clay-bg text-kpi-clay-fg" },
  "Stock Movement": { icon: Truck, tone: "bg-kpi-sage-bg text-kpi-sage-fg" },
  "Shift Totals": { icon: ShoppingBag, tone: "bg-kpi-ochre-bg text-kpi-ochre-fg" },
};

const available = [
  { href: "/reports/revenue", title: "Revenue & Profit", text: "What came in, what it cost, and what was left.", icon: TrendingUp },
  { href: "/reports/variance", title: "Variance", text: "Stock count differences, their reasons and their value.", icon: ClipboardCheck },
  { href: "/reports/stock-movement", title: "Stock Movement", text: "Everything that came in or went out, with balances.", icon: Truck },
] as const;

/** The Super Admin's Reports landing: period KPIs, sales by category, recent reports and a way into each report. */
export function ReportsOverview() {
  const { range, setRange, tuple, today } = useReportRange();
  const sales = useSales();
  const products = useProducts();
  const runs = useReportRuns();
  const log = useLogReportRun();
  const staffName = useStaffName();

  const all = useMemo(() => sales.data ?? [], [sales.data]);
  const inRange = useMemo(() => salesBetween(all, ...tuple), [all, tuple]);
  const totals = totalsOf(inRange);
  const length = Math.round((Date.parse(`${tuple[1]}T00:00:00Z`) - Date.parse(`${tuple[0]}T00:00:00Z`)) / 86_400_000) + 1;
  const before = totalsOf(salesBetween(all, addDays(tuple[0], -length), addDays(tuple[0], -1)));
  const delta = (current: number, previous: number) =>
    previous > 0 ? { percent: Math.round(((current - previous) / previous) * 100), label: "from previous period" } : undefined;
  const buckets = useMemo(
    () => salesBuckets(all, products.data ?? [], tuple, (d) => formatDayMonth(`${d}T12:00:00Z`)),
    [all, products.data, tuple],
  );
  const trend = (pick: Parameters<typeof dailySeries>[3]) => dailySeries(all, tuple[1], 7, pick);

  async function exportReport() {
    const days = buckets.map((b) => {
      const dayTotals = totalsOf(salesBetween(all, b.key, b.key));
      return [b.key, dayTotals.count, dayTotals.units, dayTotals.total / 100, b.Shoes / 100, b.Bags / 100, b.Accessories / 100];
    });
    downloadCsv(`retailhub-sales-${tuple[0]}-to-${tuple[1]}.csv`, [
      ["Day", "Transactions", "Items sold", "Total (Le)", "Shoes (Le)", "Bags (Le)", "Accessories (Le)"],
      ...days,
    ]);
    try {
      await log.mutateAsync({ name: "Sales Report", type: "Sales", href: "/reports", from: tuple[0], to: tuple[1] });
      toast.success("Sales report exported", { description: "It's listed under Recent Reports." });
    } catch {
      toast.error("Exported, but couldn’t add it to Recent Reports");
    }
  }

  const columns = useMemo<ColumnDef<ReportRun, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Report Name",
        accessorFn: (r) => r.name,
        cell: ({ row }) => {
          const { icon: Icon, tone } = typeIcon[row.original.type];
          return (
            <Link href={row.original.href} className="flex items-center gap-3 font-medium underline-offset-4 hover:underline">
              <span className={cn("grid size-8 place-items-center rounded-md", tone)}>
                <Icon className="size-4" aria-hidden="true" />
              </span>
              {row.original.name}
            </Link>
          );
        },
      },
      { accessorKey: "type", header: "Type", cell: ({ getValue }) => <span className="text-text-secondary">{String(getValue())}</span> },
      {
        id: "at",
        header: "Date Generated",
        accessorFn: (r) => r.at,
        cell: ({ getValue }) => <span className="text-text-secondary">{formatDateTime(String(getValue()))}</span>,
      },
      { id: "by", header: "Generated By", accessorFn: (r) => staffName(r.generatedBy) },
      {
        id: "actions",
        header: () => <span className="block text-right">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`Actions for ${row.original.name}`}
                className="grid size-8 place-items-center rounded-md border border-border bg-card outline-none hover:bg-surface-hover focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem render={<Link href={row.original.href} />}>
                  <ArrowRight aria-hidden="true" /> Open report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [staffName],
  );

  return (
    <ReportFrame
      title="Reports"
      description="View and analyze your store performance with detailed reports."
      range={range}
      onRange={setRange}
      today={today}
      onExport={exportReport}
      exportDisabled={sales.isPending}
    >
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Sales" kind="money" value={totals.total} icon={ShoppingCart} accent="clay" delta={delta(totals.total, before.total)} trend={trend((t) => t.total)} />
        <StatCard label="Total Transactions" value={totals.count} icon={Package} accent="ochre" delta={delta(totals.count, before.count)} trend={trend((t) => t.count)} />
        <StatCard label="Items Sold" value={totals.units} icon={ShoppingBag} accent="sage" delta={delta(totals.units, before.units)} trend={trend((t) => t.units)} />
        <StatCard label="Average Sale" kind="money" value={totals.average} icon={TrendingUp} accent="info" hint="Total divided by transactions" trend={trend((t) => t.average)} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card className="gap-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Sales Report</h2>
            <SeriesLegend />
          </div>
          <SalesBarChart data={buckets} label="Sales by category for the chosen dates" />
        </Card>
        <section aria-labelledby="recent-reports" className="flex flex-col gap-2">
          <h2 id="recent-reports" className="font-display text-lg font-semibold">
            Recent Reports
          </h2>
          <DataTable
            columns={columns}
            data={runs.data ?? []}
            pageSize={5}
            pageSizeOptions={[5, 10]}
            itemLabel="reports"
            getRowId={(r) => r.id}
            empty={{ title: "No reports yet", description: "Exported and generated reports will be listed here." }}
          />
        </section>
      </div>

      <section aria-labelledby="all-reports" className="flex flex-col gap-3">
        <h2 id="all-reports" className="font-display text-lg font-semibold">
          All reports
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {available.map(({ href, title, text, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="group flex h-full items-start gap-4 rounded-xl border bg-card p-5 shadow-soft outline-none transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lifted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-kpi-forest-bg text-kpi-forest-fg">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-text-secondary">{text}</span>
                </span>
                <ArrowRight className="mt-1 size-4 text-text-secondary transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </ReportFrame>
  );
}

