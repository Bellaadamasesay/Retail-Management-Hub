"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDownToLine, ArrowUpFromLine, Download, Layers, Shuffle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { SeriesBarChart, SeriesLegend, type Series } from "@/components/charts/series-bar-chart";
import { DataTable } from "@/components/data/data-table";
import { FilterSelect } from "@/components/data/filter-select";
import { StatCard } from "@/components/data/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useProducts } from "@/features/catalog/api/use-products";
import { ProductPicture } from "@/features/catalog/components/product-picture";
import { useMovements } from "@/features/inventory/api/use-intakes";
import type { MovementType } from "@/lib/api/types";
import { downloadCsv } from "@/lib/csv";
import { formatDateTime, formatDayMonth } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import { useLogReportRun } from "../api/use-report-runs";
import { useReportRange } from "../lib/range";
import { movementByDay, movementRows, movementTotals, stockValue, type MovementRow } from "../lib/reports";
import { ReportFrame } from "./report-frame";

const series: Series[] = [
  { key: "incoming", label: "Incoming", token: "var(--chart-1)", className: "bg-chart-1" },
  { key: "outgoing", label: "Outgoing", token: "var(--chart-2)", className: "bg-chart-2" },
];

const typeOptions = [
  { value: "all", label: "All Movement Types" },
  { value: "incoming", label: "Incoming" },
  { value: "outgoing", label: "Outgoing" },
  { value: "adjustment", label: "Adjustment" },
];

const typeBadge: Record<MovementType, { label: string; variant: "success" | "warning" | "info" }> = {
  incoming: { label: "Incoming", variant: "success" },
  outgoing: { label: "Outgoing", variant: "warning" },
  adjustment: { label: "Adjustment", variant: "info" },
};

/** Keeper and Super Admin: everything that came in, went out or was corrected, with running balances. */
export function StockMovementReport() {
  const { range, setRange, tuple, today } = useReportRange();
  const movements = useMovements();
  const products = useProducts();
  const log = useLogReportRun();
  const [productId, setProductId] = useState("all");
  const [type, setType] = useState("all");

  const catalog = useMemo(() => products.data ?? [], [products.data]);
  const rows = useMemo(
    () =>
      movementRows(movements.data ?? [], catalog, tuple, {
        productId: productId === "all" ? undefined : productId,
        type: type === "all" ? undefined : (type as MovementType),
      }),
    [movements.data, catalog, tuple, productId, type],
  );
  const totals = movementTotals(rows);
  const chart = useMemo(() => movementByDay(rows, tuple, (d) => formatDayMonth(`${d}T12:00:00Z`)), [rows, tuple]);
  const productOptions = useMemo(
    () => [{ value: "all", label: "All Products" }, ...[...catalog].sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ value: p.id, label: p.name }))],
    [catalog],
  );

  const columns = useMemo<ColumnDef<MovementRow, unknown>[]>(
    () => [
      { id: "at", header: "Date & Time", accessorFn: (r) => r.movement.at, cell: ({ getValue }) => <span className="text-text-secondary">{formatDateTime(String(getValue()))}</span> },
      { id: "ref", header: "Reference No.", accessorFn: (r) => r.movement.reference, cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue())}</span> },
      {
        id: "product",
        header: "Product",
        accessorFn: (r) => `${r.product} ${r.label}`,
        cell: ({ row }) => {
          const product = catalog.find((p) => p.id === row.original.productId);
          return (
            <span className="flex items-center gap-2.5">
              {product ? <ProductPicture product={product} colour={row.original.label.split(" · ")[0]} className="size-8" /> : null}
              <span>
                {row.original.product}
                <span className="block text-xs text-text-secondary">{row.original.label}</span>
              </span>
            </span>
          );
        },
      },
      { id: "sku", header: "SKU", accessorFn: (r) => r.sku, cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue())}</span> },
      {
        id: "type",
        header: "Type",
        accessorFn: (r) => r.movement.type,
        cell: ({ row }) => <Badge variant={typeBadge[row.original.movement.type].variant}>{typeBadge[row.original.movement.type].label}</Badge>,
      },
      {
        id: "qty",
        header: "Quantity",
        accessorFn: (r) => r.movement.quantity,
        cell: ({ getValue }) => {
          const q = Number(getValue());
          return <span className={cn("tabular font-medium", q < 0 ? "text-destructive" : "text-success")}>{q > 0 ? `+${q}` : q}</span>;
        },
      },
      { id: "balance", header: "Balance", accessorFn: (r) => r.movement.balance },
    ],
    [catalog],
  );

  function exportCsv() {
    downloadCsv(`retailhub-stock-movement-${tuple[0]}-to-${tuple[1]}.csv`, [
      ["Date & time", "Reference", "Product", "Variant", "SKU", "Type", "Quantity", "Balance"],
      ...rows.map((r) => [r.movement.at, r.movement.reference, r.product, r.label, r.sku, typeBadge[r.movement.type].label, r.movement.quantity, r.movement.balance]),
    ]);
  }

  async function generate() {
    try {
      await log.mutateAsync({ name: "Stock Movement Report", type: "Stock Movement", href: "/reports/stock-movement", from: tuple[0], to: tuple[1] });
      toast.success("Stock movement report generated", { description: "It's listed under Recent Reports." });
    } catch {
      toast.error("Couldn’t record that report. Try again.");
    }
  }

  return (
    <ReportFrame
      title="Stock Movement Report"
      description="View all incoming and outgoing stock movements within a selected period."
      crumbs={[{ label: "Reports", href: "/reports" }, { label: "Stock Movement" }]}
      range={range}
      onRange={setRange}
      today={today}
      onExport={generate}
      exportLabel="Generate Report"
      controls={
        <>
          <FilterSelect label="Product" value={productId} onChange={setProductId} options={productOptions} />
          <FilterSelect label="Movement type" value={type} onChange={setType} options={typeOptions} className="min-w-48" />
        </>
      }
    >
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Incoming" value={totals.incoming} icon={ArrowDownToLine} accent="forest" hint="Units received" />
        <StatCard label="Total Outgoing" value={totals.outgoing} icon={ArrowUpFromLine} accent="clay" hint="Units sold" />
        <StatCard label="Net Movement" value={Math.abs(totals.net)} icon={Shuffle} accent="ochre" hint={`${totals.net >= 0 ? "Net gain" : "Net loss"} of units${totals.adjustments !== 0 ? `, incl. ${totals.adjustments > 0 ? "+" : ""}${totals.adjustments} from counts` : ""}`} />
        <StatCard label="Current Stock Value" kind="money" value={stockValue(catalog)} icon={Layers} accent="sage" hint="Units on the shelf at cost" />
      </div>

      <Card className="gap-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Stock Movement Trend</h2>
          <SeriesLegend series={series} />
        </div>
        <SeriesBarChart data={chart} series={series} stacked format={(v) => String(v)} label="Units received and sold per day for the chosen dates" />
      </Card>

      <section aria-labelledby="transactions" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="transactions" className="font-display text-lg font-semibold">
            Stock Movement Transactions
          </h2>
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download aria-hidden="true" /> Export Report
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={rows}
          pageSize={10}
          pageSizeOptions={[10, 25, 50]}
          itemLabel="transactions"
          getRowId={(r) => r.movement.id}
          empty={{ title: "No movements in these dates", description: "Try a wider date range, or clear the product and type filters." }}
        />
      </section>
    </ReportFrame>
  );
}

