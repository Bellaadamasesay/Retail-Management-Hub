"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardList, Coins, MinusCircle, PlusCircle } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data/data-table";
import { Money } from "@/components/data/money";
import { StatCard } from "@/components/data/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useProducts } from "@/features/catalog/api/use-products";
import { useStockTakes } from "@/features/inventory/api/use-stock-takes";
import { downloadCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format/date";
import { formatVariance, REASONS, reasonLabels } from "@/lib/inventory/variance";
import { cn } from "@/lib/utils";
import { useLogReportRun } from "../api/use-report-runs";
import { useReportRange } from "../lib/range";
import { varianceRows, varianceTotals, type VarianceRow } from "../lib/reports";
import { ReportFrame } from "./report-frame";

const columns: ColumnDef<VarianceRow, unknown>[] = [
  {
    id: "ref",
    header: "Stock take",
    accessorFn: (r) => r.reference,
    cell: ({ row }) => (
      <Link href={`/inventory/stock-take/${row.original.takeId}`} className="font-mono text-xs font-medium underline-offset-4 hover:underline">
        {row.original.reference}
      </Link>
    ),
  },
  { accessorKey: "date", header: "Counted", cell: ({ getValue }) => <span className="text-text-secondary">{formatDate(`${String(getValue())}T12:00:00Z`)}</span> },
  {
    id: "item",
    header: "Item",
    accessorFn: (r) => `${r.product} ${r.label}`,
    cell: ({ row }) => (
      <span>
        {row.original.product} <span className="text-text-secondary">· {row.original.label}</span>
      </span>
    ),
  },
  { accessorKey: "sku", header: "SKU", cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue())}</span> },
  { accessorKey: "expected", header: "Expected" },
  { accessorKey: "counted", header: "Counted" },
  {
    accessorKey: "variance",
    header: "Variance",
    cell: ({ getValue }) => {
      const v = Number(getValue());
      return <span className={cn("tabular font-medium", v < 0 ? "text-destructive" : "text-success")}>{formatVariance(v)}</span>;
    },
  },
  {
    id: "reason",
    header: "Reason",
    accessorFn: (r) => (r.reason ? reasonLabels[r.reason] : ""),
  },
  { accessorKey: "value", header: "Value", cell: ({ getValue }) => <Money amount={Number(getValue())} /> },
  {
    id: "status",
    header: "Status",
    accessorFn: (r) => r.status,
    cell: ({ row }) => (
      <Badge variant={row.original.status === "approved" ? "success" : "warning"}>
        {row.original.status === "approved" ? "Approved" : "Pending"}
      </Badge>
    ),
  },
];

/** Super Admin: every stock-count difference in the range, why it happened and what it was worth. */
export function VarianceReport() {
  const { range, setRange, tuple, today } = useReportRange();
  const takes = useStockTakes();
  const products = useProducts();
  const log = useLogReportRun();

  const rows = useMemo(() => varianceRows(takes.data ?? [], products.data ?? [], tuple), [takes.data, products.data, tuple]);
  const totals = varianceTotals(rows);
  const takeCount = new Set(rows.map((r) => r.takeId)).size;

  async function exportReport() {
    downloadCsv(`retailhub-variance-${tuple[0]}-to-${tuple[1]}.csv`, [
      ["Stock take", "Counted on", "Product", "Variant", "SKU", "Expected", "Counted", "Variance", "Reason", "Value (Le)", "Status"],
      ...rows.map((r) => [r.reference, r.date, r.product, r.label, r.sku, r.expected, r.counted, r.variance, r.reason ? reasonLabels[r.reason] : "", r.value / 100, r.status === "approved" ? "Approved" : "Pending"]),
    ]);
    try {
      await log.mutateAsync({ name: "Variance Report", type: "Variance", href: "/reports/variance", from: tuple[0], to: tuple[1] });
      toast.success("Variance report exported", { description: "It's listed under Recent Reports." });
    } catch {
      toast.error("Exported, but couldn’t add it to Recent Reports");
    }
  }

  return (
    <ReportFrame
      title="Variance"
      description="Where the shelf and the system disagreed, and what it cost."
      crumbs={[{ label: "Reports", href: "/reports" }, { label: "Variance" }]}
      range={range}
      onRange={setRange}
      today={today}
      onExport={exportReport}
      exportDisabled={takes.isPending}
    >
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Differences" value={totals.differences} icon={ClipboardList} accent="sage" hint={`Across ${takeCount} ${takeCount === 1 ? "stock take" : "stock takes"}`} />
        <StatCard label="Units Short" value={totals.shortUnits} icon={MinusCircle} accent="clay" hint="Counted fewer than expected" />
        <StatCard label="Units Over" value={totals.overUnits} icon={PlusCircle} accent="forest" hint="Counted more than expected" />
        <StatCard label="Net Value" kind="money" value={Math.abs(totals.value)} icon={Coins} accent="ochre" hint={totals.value < 0 ? "Lost, at cost price" : "Gained, at cost price"} />
      </div>

      <Card className="gap-4 p-6">
        <h2 className="font-display text-lg font-semibold">Why it happened</h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {REASONS.map((r, i) => (
            <li key={r} className="rounded-lg bg-background-subtle px-4 py-3">
              <p className="text-sm text-text-secondary">{reasonLabels[r]}</p>
              <p className="tabular mt-1 flex items-center gap-2 text-2xl font-semibold">
                <span aria-hidden="true" className={cn("size-2.5 rounded-full", ["bg-chart-2", "bg-chart-3", "bg-chart-5"][i])} />
                {totals.byReason[r]}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <DataTable
        columns={columns}
        data={rows}
        pageSize={8}
        itemLabel="differences"
        getRowId={(r) => `${r.takeId}-${r.sku}`}
        empty={{ title: "No differences in these dates", description: "Either every count matched the system, or none was submitted in this range." }}
      />
    </ReportFrame>
  );
}
