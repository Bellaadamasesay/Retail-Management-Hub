"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, CircleCheck, CircleX, ClipboardCheck, Download, FileText, LoaderCircle, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data/data-table";
import { FilterSelect } from "@/components/data/filter-select";
import { SearchInput } from "@/components/data/search-input";
import { StatCard } from "@/components/data/stat-card";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useStaffName } from "@/features/users/api/use-users";
import { ApiError } from "@/lib/api/client";
import type { Category, StockTake } from "@/lib/api/types";
import { downloadCsv } from "@/lib/csv";
import { formatDateTime } from "@/lib/format/date";
import { STORE } from "@/lib/store-info";
import { formatVariance, statusLabels, summarize } from "@/lib/inventory/variance";
import { useStaggerIn } from "@/lib/motion/use-stagger-in";
import { Can } from "@/lib/rbac/can";
import { usePermission } from "@/lib/rbac/use-permission";
import { cn } from "@/lib/utils";
import { useCreateStockTake, useStockTakes } from "../api/use-stock-takes";

const statusVariant = {
  approved: "success",
  in_progress: "info",
  pending_approval: "warning",
  cancelled: "destructive",
} as const;

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "in_progress", label: "In Progress" },
  { value: "pending_approval", label: "Pending" },
  { value: "approved", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const locationOptions = [
  { value: "all", label: "All Locations" },
  { value: STORE.location, label: STORE.location },
];

const scopeOptions = [
  { value: "All", label: "Everything in the store" },
  { value: "Shoes", label: "Shoes" },
  { value: "Bags", label: "Bags" },
  { value: "Accessories", label: "Accessories" },
];

interface Row {
  take: StockTake;
  createdBy: string;
  counted: number;
  total: number;
  variance: number;
  differences: number;
}

const columns: ColumnDef<Row, unknown>[] = [
    {
      id: "reference",
      header: "Reference",
      accessorFn: (r) => r.take.reference,
      cell: ({ row }) => (
        <Link
          href={`/inventory/stock-take/${row.original.take.id}`}
          className="font-mono text-xs font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
        >
          {row.original.take.reference}
        </Link>
      ),
    },
    { id: "name", header: "Name", accessorFn: (r) => r.take.name },
    { id: "location", header: "Location", accessorFn: () => STORE.location },
    { id: "total", header: "Total Items", accessorFn: (r) => r.total },
    { id: "counted", header: "Counted Items", accessorFn: (r) => r.counted },
    {
      id: "variance",
      header: "Variance",
      accessorFn: (r) => r.variance,
      cell: ({ getValue }) => {
        const v = Number(getValue());
        return (
          <span className={cn("tabular font-medium", v < 0 && "text-destructive", v > 0 && "text-success")}>
            {formatVariance(v)}
          </span>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (r) => statusLabels[r.take.status],
      cell: ({ row }) => (
        <Badge variant={statusVariant[row.original.take.status]}>{statusLabels[row.original.take.status]}</Badge>
      ),
    },
    { id: "by", header: "Created By", accessorFn: (r) => r.createdBy },
    {
      id: "created",
      header: "Created Date",
      accessorFn: (r) => r.take.createdAt,
      cell: ({ getValue }) => <span className="text-text-secondary">{formatDateTime(String(getValue()))}</span>,
    },
    {
      id: "actions",
      header: () => <span className="block text-right">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Link
            href={`/inventory/stock-take/${row.original.take.id}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
            aria-label={`Open ${row.original.take.reference}`}
          >
            {row.original.take.status === "in_progress" ? "Continue" : row.original.take.status === "pending_approval" ? "Review" : "View"}
          </Link>
        </div>
      ),
    },
];

export function StockTakesView() {
  const takes = useStockTakes();
  const staffName = useStaffName();
  const canApprove = usePermission("stocktake.approve");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [location, setLocation] = useState("all");
  const [creating, setCreating] = useState(false);
  const cards = useStaggerIn<HTMLDivElement>();

  const rows = useMemo<Row[]>(
    () =>
      [...(takes.data ?? [])]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((take) => {
          const s = summarize(take.lines);
          return { take, createdBy: staffName(take.createdBy), counted: s.counted, total: s.total, variance: s.netVariance, differences: s.differences };
        }),
    [takes.data, staffName],
  );

  const visible = rows.filter((r) => {
    const q = query.trim().toLowerCase();
    if (status !== "all" && r.take.status !== status) return false;
    if (location !== "all" && location !== STORE.location) return false;
    return !q || r.take.reference.toLowerCase().includes(q) || r.take.name.toLowerCase().includes(q) || r.createdBy.toLowerCase().includes(q);
  });
  const filtered = query.trim() !== "" || status !== "all" || location !== "all";

  const count = (s: StockTake["status"]) => rows.filter((r) => r.take.status === s).length;
  const waiting = rows.filter((r) => r.take.status === "pending_approval");

  function exportCsv() {
    downloadCsv("retailhub-stock-takes.csv", [
      ["Reference", "Name", "Location", "Total items", "Counted items", "Variance", "Status", "Created by", "Created"],
      ...visible.map((r) => [r.take.reference, r.take.name, STORE.location, r.total, r.counted, r.variance, statusLabels[r.take.status], r.createdBy, r.take.createdAt]),
    ]);
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Stock Take"
        description="Create and manage stock takes to keep your inventory accurate."
        actions={
          <>
            <Button variant="outline" className="h-10" disabled={visible.length === 0} onClick={exportCsv}>
              <Download aria-hidden="true" /> Export
            </Button>
            <Can permission="stocktake.perform">
              <Button className="h-10" onClick={() => setCreating(true)}>
                <Plus aria-hidden="true" /> New Stock Take
              </Button>
            </Can>
          </>
        }
      />

      <div ref={cards} className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Stock Takes" value={rows.length} icon={FileText} accent="sage" hint="All stock take records" />
        <StatCard
          label="In Progress"
          value={count("in_progress") + count("pending_approval")}
          icon={LoaderCircle}
          accent="info"
          hint="Being counted or awaiting approval"
        />
        <StatCard label="Completed" value={count("approved")} icon={CircleCheck} accent="forest" hint="Finished stock takes" />
        <StatCard label="Cancelled" value={count("cancelled")} icon={CircleX} accent="clay" hint="Cancelled stock takes" />
      </div>

      {canApprove && waiting.length > 0 ? (
        <Card className="gap-4 border-warning/40 p-5" aria-label="Waiting for approval">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="size-5 text-warning" aria-hidden="true" />
            <h2 className="font-display text-lg font-semibold">Waiting for your approval</h2>
          </div>
          <ul className="flex flex-col divide-y">
            {waiting.map((r) => (
              <li key={r.take.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <span>
                  <span className="font-medium">
                    {r.take.reference} · {r.take.name}
                  </span>
                  <span className="text-text-secondary">
                    {" "}
                    · counted by {r.createdBy} · {r.differences === 0 ? "no differences" : `${r.differences} ${r.differences === 1 ? "difference" : "differences"}, ${formatVariance(r.variance)} units net`}
                  </span>
                </span>
                <Link href={`/inventory/stock-take/${r.take.id}`} className={buttonVariants({ size: "sm" })}>
                  Review <ArrowRight aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by reference, name or created by…"
          aria-label="Search stock takes"
          className="min-w-64 flex-1 basis-80"
        />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={statusOptions} />
        <FilterSelect label="Location" value={location} onChange={setLocation} options={locationOptions} />
        <Button
          variant="outline"
          className="h-10"
          disabled={!filtered}
          onClick={() => {
            setQuery("");
            setStatus("all");
            setLocation("all");
          }}
        >
          Clear Filters
        </Button>
      </div>

      {takes.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading stock takes">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={visible}
          pageSize={8}
          itemLabel="stock takes"
          getRowId={(r) => r.take.id}
          empty={{
            title: filtered ? "No stock takes match those filters" : "No stock takes yet",
            description: filtered
              ? "Try a different reference or name, or clear the filters."
              : "Start a count to compare what is on the shelf with what the system says.",
          }}
        />
      )}

      <NewStockTakeDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function NewStockTakeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const create = useCreateStockTake();
  const [name, setName] = useState("");
  const [scope, setScope] = useState("All");
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    try {
      const take = await create.mutateAsync({ name, scope: scope as Category | "All" });
      toast.success(`${take.reference} started`, { description: `${take.lines.length} items to count.` });
      onOpenChange(false);
      setName("");
      router.push(`/inventory/stock-take/${take.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We couldn’t start that count. Check your connection and try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">New Stock Take</DialogTitle>
          <DialogDescription>
            Pick the part of the store you are counting. The system snapshots what it expects to find on the shelf.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="take-name" className="text-sm font-semibold">
            Name
          </Label>
          <Input id="take-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bags section" />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">What are you counting?</span>
          <FilterSelect label="Scope" value={scope} onChange={setScope} options={scopeOptions} className="w-full" />
        </div>
        {error ? (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={start} disabled={create.isPending}>
            {create.isPending ? "Starting…" : "Start counting"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
