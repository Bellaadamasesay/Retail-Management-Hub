"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Download, Receipt as ReceiptIcon, ReceiptText, ShoppingBag, ShoppingCart, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data/data-table";
import { FilterSelect } from "@/components/data/filter-select";
import { Money } from "@/components/data/money";
import { SearchInput } from "@/components/data/search-input";
import { StatCard } from "@/components/data/stat-card";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/brand/empty-state";
import { useUsers } from "@/features/users/api/use-users";
import type { Sale } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session-context";
import { downloadCsv } from "@/lib/csv";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { useStaggerIn } from "@/lib/motion/use-stagger-in";
import { usePermission } from "@/lib/rbac/use-permission";
import { useShellStore } from "@/lib/stores/shell-store";
import { appNow } from "@/lib/time";
import { useSales } from "../api/use-sales";
import {
  dailySeries,
  dayKey,
  percentChange,
  periodRange,
  previousRange,
  salesBetween,
  totalsOf,
  type Period,
} from "../lib/sales";
import { SaleDetailDialog } from "./sale-detail-dialog";

const periodOptions = [
  { value: "day", label: "Selected day" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

interface Row {
  sale: Sale;
  cashier: string;
  units: number;
}

/**
 * Sales history. A Cashier sees their own sales for the day picked in the top
 * bar, with that day's shift totals. A Super Admin sees every sale with
 * filters. Either can open a sale to reprint its receipt.
 */
export function SalesView() {
  const session = useSession();
  const viewAll = usePermission("sales.view_all");
  const asOf = useShellStore((s) => s.asOf);
  const today = dayKey(appNow().toISOString());
  const day = asOf ?? today;

  const sales = useSales(viewAll ? undefined : session.sub);
  const users = useUsers();
  const [query, setQuery] = useState("");
  const [cashier, setCashier] = useState("all");
  const [period, setPeriod] = useState<Period>("day");
  const [open, setOpen] = useState<Sale | null>(null);
  const cards = useStaggerIn<HTMLDivElement>({ dependencies: [sales.isSuccess] });

  const nameOf = useMemo(() => {
    const map = new Map((users.data ?? []).map((u) => [u.id, u.name]));
    return (id: string) => map.get(id) ?? "Unknown";
  }, [users.data]);

  // A Cashier only ever has the "selected day" view: their shift.
  const range = useMemo(() => (viewAll ? periodRange(period, day) : ([day, day] as [string, string])), [viewAll, period, day]);
  const all = useMemo(() => sales.data ?? [], [sales.data]);

  const scoped = useMemo(() => (range ? salesBetween(all, range[0], range[1]) : all), [all, range]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.filter((s) => {
      if (viewAll && cashier !== "all" && s.cashierId !== cashier) return false;
      return !q || s.receiptNumber.toLowerCase().includes(q) || s.lines.some((l) => l.name.toLowerCase().includes(q) || l.sku.toLowerCase().includes(q));
    });
  }, [scoped, query, cashier, viewAll]);

  const rows = useMemo<Row[]>(
    () =>
      [...filtered]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((sale) => ({ sale, cashier: nameOf(sale.cashierId), units: sale.lines.reduce((n, l) => n + l.quantity, 0) })),
    [filtered, nameOf],
  );

  const totals = totalsOf(filtered);
  const previous = range ? totalsOf(salesBetween(viewAll && cashier !== "all" ? all.filter((s) => s.cashierId === cashier) : all, ...previousRange(range))) : null;
  const delta = (current: number, before: number | undefined) => {
    const pct = before === undefined ? undefined : percentChange(current, before);
    return pct === undefined ? undefined : { percent: pct, label: viewAll && period !== "day" ? "from the previous period" : "from the day before" };
  };
  const trendSource = viewAll && cashier !== "all" ? all.filter((s) => s.cashierId === cashier) : all;
  const trendEnd = range ? range[1] : day;

  const cashierOptions = useMemo(
    () => [
      { value: "all", label: "All Cashiers" },
      ...[...new Set(all.map((s) => s.cashierId))].map((id) => ({ value: id, label: nameOf(id) })),
    ],
    [all, nameOf],
  );

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        id: "receipt",
        header: "Receipt",
        accessorFn: (r) => r.sale.receiptNumber,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => setOpen(row.original.sale)}
            className="font-mono text-xs font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
          >
            {row.original.sale.receiptNumber}
          </button>
        ),
      },
      {
        id: "time",
        header: "Date & Time",
        accessorFn: (r) => r.sale.createdAt,
        cell: ({ getValue }) => <span className="text-text-secondary">{formatDateTime(String(getValue()))}</span>,
      },
      ...(viewAll ? [{ id: "cashier", header: "Cashier", accessorFn: (r: Row) => r.cashier } as ColumnDef<Row, unknown>] : []),
      { id: "items", header: "Items", accessorFn: (r) => r.units },
      { id: "total", header: "Total", accessorFn: (r) => r.sale.total, cell: ({ getValue }) => <Money amount={Number(getValue())} className="font-medium" /> },
      { id: "cash", header: "Cash Received", accessorFn: (r) => r.sale.payment.tendered, cell: ({ getValue }) => <Money amount={Number(getValue())} /> },
      { id: "change", header: "Change", accessorFn: (r) => r.sale.payment.change, cell: ({ getValue }) => <Money amount={Number(getValue())} /> },
      {
        id: "actions",
        header: () => <span className="block text-right">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              aria-label={`View receipt ${row.original.sale.receiptNumber}`}
              onClick={() => setOpen(row.original.sale)}
            >
              <ReceiptIcon aria-hidden="true" /> Receipt
            </Button>
          </div>
        ),
      },
    ],
    [viewAll],
  );

  const periodLabel = !range
    ? "all time"
    : range[0] === range[1]
      ? day === today
        ? "today"
        : formatDate(`${day}T12:00:00Z`)
      : `${formatDate(`${range[0]}T12:00:00Z`)} to ${formatDate(`${range[1]}T12:00:00Z`)}`;

  function exportCsv() {
    downloadCsv("retailhub-sales.csv", [
      ["Receipt", "Date & time", "Cashier", "Items", "Total (Le)", "Cash received (Le)", "Change (Le)"],
      ...rows.map((r) => [r.sale.receiptNumber, r.sale.createdAt, r.cashier, r.units, r.sale.total / 100, r.sale.payment.tendered / 100, r.sale.payment.change / 100]),
    ]);
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Sales History"
        description={
          viewAll
            ? "Every sale across the store. Open one to reprint its receipt."
            : `Your sales ${day === today ? "this shift" : `on ${formatDate(`${day}T12:00:00Z`)}`}. Pick another day from the date at the top.`
        }
        actions={
          viewAll ? (
            <Button variant="outline" className="h-10" disabled={rows.length === 0} onClick={exportCsv}>
              <Download aria-hidden="true" /> Export
            </Button>
          ) : null
        }
      />

      <div ref={cards} className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={viewAll ? "Total Sales" : "Shift Total"}
          kind="money"
          value={totals.total}
          icon={ShoppingBag}
          accent="forest"
          delta={previous ? delta(totals.total, previous.total) : undefined}
          hint={`Cash taken ${periodLabel}`}
          trend={dailySeries(trendSource, trendEnd, 7, (t) => t.total)}
        />
        <StatCard
          label="Transactions"
          value={totals.count}
          icon={ShoppingCart}
          accent="clay"
          delta={previous ? delta(totals.count, previous.count) : undefined}
          hint={`Sales rung up ${periodLabel}`}
          trend={dailySeries(trendSource, trendEnd, 7, (t) => t.count)}
        />
        <StatCard
          label="Items Sold"
          value={totals.units}
          icon={ReceiptText}
          accent="sage"
          delta={previous ? delta(totals.units, previous.units) : undefined}
          hint={`Units sold ${periodLabel}`}
          trend={dailySeries(trendSource, trendEnd, 7, (t) => t.units)}
        />
        <StatCard
          label="Average Sale"
          kind="money"
          value={totals.average}
          icon={TrendingUp}
          accent="ochre"
          hint="Total divided by transactions"
          trend={dailySeries(trendSource, trendEnd, 7, (t) => t.average)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by receipt number or item…"
          aria-label="Search sales"
          className="min-w-64 flex-1 basis-80"
        />
        {viewAll ? (
          <>
            <FilterSelect label="Cashier" value={cashier} onChange={setCashier} options={cashierOptions} />
            <FilterSelect label="Period" value={period} onChange={(v) => setPeriod(v as Period)} options={periodOptions} />
          </>
        ) : null}
        <Button
          variant="outline"
          className="h-10"
          disabled={query === "" && cashier === "all" && (!viewAll || period === "day")}
          onClick={() => {
            setQuery("");
            setCashier("all");
            setPeriod("day");
          }}
        >
          Clear Filters
        </Button>
      </div>

      {sales.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading sales">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : sales.isError ? (
        <EmptyState
          className="bg-card"
          icon={<ReceiptText className="size-6" />}
          title="We couldn’t load the sales"
          description="Check your connection and try again."
          action={
            <Button size="sm" onClick={() => sales.refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          pageSize={8}
          itemLabel="sales"
          getRowId={(r) => r.sale.id}
          empty={{
            title: viewAll ? "No sales match those filters" : "No sales on this shift yet",
            description: viewAll
              ? "Try another cashier or period."
              : "Sales you ring up will show here, with your shift totals above.",
          }}
        />
      )}

      <SaleDetailDialog sale={open} onClose={() => setOpen(null)} />
    </div>
  );
}
