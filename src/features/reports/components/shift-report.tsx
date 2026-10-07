"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Banknote, ReceiptText, ShoppingBag, ShoppingCart } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data/data-table";
import { Money } from "@/components/data/money";
import { StatCard } from "@/components/data/stat-card";
import { useSales } from "@/features/sales/api/use-sales";
import { useSession } from "@/lib/auth/session-context";
import { downloadCsv } from "@/lib/csv";
import { formatDate, formatTime } from "@/lib/format/date";
import { useLogReportRun } from "../api/use-report-runs";
import { useReportRange } from "../lib/range";
import { shiftDays, type ShiftDay } from "../lib/reports";
import { ReportFrame } from "./report-frame";

const columns: ColumnDef<ShiftDay, unknown>[] = [
  { id: "day", header: "Day", accessorFn: (r) => r.day, cell: ({ getValue }) => <span className="font-medium">{formatDate(`${String(getValue())}T12:00:00Z`)}</span> },
  { id: "first", header: "First Sale", accessorFn: (r) => r.firstSale ?? "", cell: ({ row }) => <span className="text-text-secondary">{row.original.firstSale ? formatTime(row.original.firstSale) : "–"}</span> },
  { id: "last", header: "Last Sale", accessorFn: (r) => r.lastSale ?? "", cell: ({ row }) => <span className="text-text-secondary">{row.original.lastSale ? formatTime(row.original.lastSale) : "–"}</span> },
  { accessorKey: "sales", header: "Sales" },
  { accessorKey: "units", header: "Items" },
  { accessorKey: "total", header: "Total", cell: ({ getValue }) => <Money amount={Number(getValue())} className="font-medium" /> },
  { accessorKey: "cashReceived", header: "Cash Received", cell: ({ getValue }) => <Money amount={Number(getValue())} /> },
  { accessorKey: "changeGiven", header: "Change Given", cell: ({ getValue }) => <Money amount={Number(getValue())} /> },
];

/** Cashier: their own daily shift totals. Nobody else's sales ever reach this screen. */
export function ShiftReport() {
  const session = useSession();
  const { range, setRange, tuple, today } = useReportRange();
  const sales = useSales(session.sub);
  const log = useLogReportRun();

  const days = useMemo(() => shiftDays(sales.data ?? [], session.sub, tuple), [sales.data, session.sub, tuple]);
  const totals = days.reduce(
    (a, d) => ({ sales: a.sales + d.sales, units: a.units + d.units, total: a.total + d.total, cash: a.cash + d.cashReceived }),
    { sales: 0, units: 0, total: 0, cash: 0 },
  );

  async function exportReport() {
    downloadCsv(`retailhub-my-shifts-${tuple[0]}-to-${tuple[1]}.csv`, [
      ["Day", "First sale", "Last sale", "Sales", "Items", "Total (Le)", "Cash received (Le)", "Change given (Le)"],
      ...days.map((d) => [d.day, d.firstSale ?? "", d.lastSale ?? "", d.sales, d.units, d.total / 100, d.cashReceived / 100, d.changeGiven / 100]),
    ]);
    try {
      await log.mutateAsync({ name: "My Shift Totals", type: "Shift Totals", href: "/reports/shift", from: tuple[0], to: tuple[1] });
      toast.success("Shift totals exported");
    } catch {
      toast.error("Exported, but couldn’t record it");
    }
  }

  return (
    <ReportFrame
      title="My Shift Totals"
      description="Your own sales for each day you worked."
      range={range}
      onRange={setRange}
      today={today}
      onExport={exportReport}
      exportLabel="Export Totals"
      exportDisabled={sales.isPending}
    >
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Sales" kind="money" value={totals.total} icon={ShoppingBag} accent="forest" hint="Money taken in these days" />
        <StatCard label="Transactions" value={totals.sales} icon={ShoppingCart} accent="clay" hint="Sales you rang up" />
        <StatCard label="Items Sold" value={totals.units} icon={ReceiptText} accent="sage" hint="Units sold" />
        <StatCard label="Cash Received" kind="money" value={totals.cash} icon={Banknote} accent="ochre" hint="Notes handed over, before change" />
      </div>
      <DataTable
        columns={columns}
        data={days}
        pageSize={8}
        itemLabel="days"
        getRowId={(r) => r.day}
        empty={{ title: "No shifts in these dates", description: "Pick a different date range." }}
      />
    </ReportFrame>
  );
}
