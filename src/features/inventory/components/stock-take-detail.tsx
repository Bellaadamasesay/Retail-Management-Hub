"use client";

import { ArrowLeft, CircleCheck, Loader2, Minus, PackageSearch, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/brand/empty-state";
import { SearchInput } from "@/components/data/search-input";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useProducts } from "@/features/catalog/api/use-products";
import { ProductPicture } from "@/features/catalog/components/product-picture";
import { useStaffName } from "@/features/users/api/use-users";
import { ApiError } from "@/lib/api/client";
import type { Product, StockTake, StockTakeLine, Variant, VarianceReason } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format/date";
import { variantLabel } from "@/lib/inventory/stock";
import { formatVariance, lineVariance, REASONS, reasonLabels, statusLabels, summarize } from "@/lib/inventory/variance";
import { gsap, registerGsap, useGSAP } from "@/lib/motion/register";
import { duration, ease, REDUCED_MOTION_QUERY } from "@/lib/motion/tokens";
import { usePermission } from "@/lib/rbac/use-permission";
import { STORE } from "@/lib/store-info";
import { deleteDraft, loadDraft, saveDraft } from "@/lib/storage/drafts";
import { cn } from "@/lib/utils";
import {
  useApproveStockTake,
  useCancelStockTake,
  useSaveCounts,
  useStockTake,
  useSubmitStockTake,
  type CountLineInput,
} from "../api/use-stock-takes";

type Filter = "all" | "uncounted" | "differences";

const statusVariant = {
  approved: "success",
  in_progress: "info",
  pending_approval: "warning",
  cancelled: "destructive",
} as const;

const draftKey = (id: string) => `stock-take:${id}`;

const toInputs = (lines: StockTakeLine[]): CountLineInput[] =>
  lines.map((l) => ({ variantId: l.variantId, counted: l.counted, reason: l.reason }));

export function StockTakeDetail({ id }: { id: string }) {
  const query = useStockTake(id);

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading stock take">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return (
      <EmptyState
        className="mx-auto max-w-xl bg-card"
        icon={<PackageSearch className="size-6" />}
        title={missing ? "We can’t find that stock take" : "We couldn’t load that stock take"}
        description={missing ? "It may have been removed. Head back to pick another." : "Check your connection and try again."}
        action={
          missing ? (
            <Link href="/inventory/stock-take" className={buttonVariants({ size: "sm" })}>
              Back to stock takes
            </Link>
          ) : (
            <Button size="sm" onClick={() => query.refetch()}>
              Try again
            </Button>
          )
        }
      />
    );
  }
  return <CountSheet key={query.data.id} take={query.data} />;
}

function CountSheet({ take }: { take: StockTake }) {
  const products = useProducts();
  const staffName = useStaffName();
  const canPerform = usePermission("stocktake.perform");
  const canApprove = usePermission("stocktake.approve");
  const save = useSaveCounts(take.id);
  const submit = useSubmitStockTake(take.id);
  const approve = useApproveStockTake(take.id);
  const cancel = useCancelStockTake(take.id);

  const editable = take.status === "in_progress" && canPerform;
  const [lines, setLines] = useState<StockTakeLine[]>(take.lines);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [restoredAt, setRestoredAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [stamped, setStamped] = useState(false);
  const [dirty, setDirty] = useState(false);

  const variants = useMemo(() => {
    const map = new Map<string, { variant: Variant; product: Product }>();
    for (const product of products.data ?? []) for (const variant of product.variants) map.set(variant.id, { variant, product });
    return map;
  }, [products.data]);

  // Bring back counts typed on this device that never reached the server (refresh, closed tab, lost connection).
  useEffect(() => {
    if (!editable) return;
    let cancelled = false;
    loadDraft<CountLineInput[]>(draftKey(take.id)).then((draft) => {
      if (cancelled || !draft) return;
      const saved = new Map(draft.value.map((l) => [l.variantId, l]));
      const merged = take.lines.map((line) => {
        const local = saved.get(line.variantId);
        return local && local.counted !== null ? { ...line, counted: local.counted, reason: local.reason } : line;
      });
      if (JSON.stringify(toInputs(merged)) !== JSON.stringify(toInputs(take.lines))) {
        setLines(merged);
        setRestoredAt(draft.savedAt);
        setDirty(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [editable, take.id, take.lines]);

  // Autosave a local draft shortly after every change.
  useEffect(() => {
    if (!editable || !dirty) return;
    const timer = setTimeout(() => void saveDraft(draftKey(take.id), toInputs(lines)), 500);
    return () => clearTimeout(timer);
  }, [lines, dirty, editable, take.id]);

  function update(variantId: string, patch: Partial<StockTakeLine>) {
    setDirty(true);
    setLines((current) =>
      current.map((l) => {
        if (l.variantId !== variantId) return l;
        const next = { ...l, ...patch };
        // A reason only makes sense while the count differs from the system.
        if (next.counted === null || next.counted === next.expected) delete next.reason;
        return next;
      }),
    );
  }

  const summary = useMemo(() => summarize(lines), [lines]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lines
      .map((line) => ({ line, entry: variants.get(line.variantId) }))
      .filter(({ line, entry }) => {
        if (filter === "uncounted" && line.counted !== null) return false;
        if (filter === "differences" && (lineVariance(line) ?? 0) === 0) return false;
        if (!q || !entry) return !q;
        return (
          entry.product.name.toLowerCase().includes(q) ||
          entry.variant.sku.toLowerCase().includes(q)
        );
      });
  }, [lines, variants, filter, search]);

  async function saveProgress() {
    setError(null);
    try {
      await save.mutateAsync(toInputs(lines));
      setDirty(false);
      toast.success("Progress saved", { description: `${summary.counted} of ${summary.total} counted.` });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We couldn’t save. Your counts are kept on this device.");
    }
  }

  async function submitForApproval() {
    setError(null);
    try {
      await submit.mutateAsync(toInputs(lines));
      await deleteDraft(draftKey(take.id));
      setDirty(false);
      if (summary.differences === 0) {
        toast.success("Spot on! Zero variance", {
          description: "Every item matches the system. It's with a Super Admin for approval.",
          icon: <Sparkles className="size-4" />,
        });
      } else {
        toast.success(`${take.reference} submitted for approval`, {
          description: `${summary.differences} ${summary.differences === 1 ? "difference" : "differences"} for a Super Admin to review.`,
        });
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We couldn’t submit. Your counts are kept on this device.");
    }
  }

  async function approveCount() {
    setError(null);
    try {
      await approve.mutateAsync();
      setStamped(true);
      toast.success(`${take.reference} approved`, { description: "Stock now matches the count." });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We couldn’t approve that. Try again.");
    }
  }

  async function cancelCount() {
    try {
      await cancel.mutateAsync();
      await deleteDraft(draftKey(take.id));
      setConfirmCancel(false);
      toast(`${take.reference} cancelled`);
    } catch (e) {
      setConfirmCancel(false);
      setError(e instanceof ApiError ? e.message : "We couldn’t cancel that. Try again.");
    }
  }

  const status = take.status;
  const busy = save.isPending || submit.isPending || approve.isPending || cancel.isPending;
  const progress = summary.total ? Math.round((summary.counted / summary.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`${take.reference} · ${take.name}`}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Badge variant={statusVariant[status]}>{statusLabels[status]}</Badge>
            <span>
              {STORE.location} · {take.scope === "All" ? "Everything" : take.scope} · started by {staffName(take.createdBy)}{" "}
              {formatDateTime(take.createdAt)}
            </span>
          </span>
        }
        actions={
          <>
            <Link href="/inventory/stock-take" className={buttonVariants({ variant: "outline", className: "h-10" })}>
              <ArrowLeft aria-hidden="true" /> Back to stock takes
            </Link>
            {editable ? (
              <>
                <Button variant="outline" className="h-10" disabled={busy} onClick={() => setConfirmCancel(true)}>
                  Cancel count
                </Button>
                <Button variant="outline" className="h-10" disabled={busy || !dirty} onClick={saveProgress}>
                  {save.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null} Save progress
                </Button>
                <Button className="h-10" disabled={busy || !summary.canSubmit} onClick={submitForApproval}>
                  {submit.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null} Submit for approval
                </Button>
              </>
            ) : null}
            {status === "pending_approval" && canApprove ? (
              <>
                <Button variant="outline" className="h-10" disabled={busy} onClick={() => setConfirmCancel(true)}>
                  Turn down
                </Button>
                <Button className="h-10" disabled={busy} onClick={approveCount}>
                  {approve.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CircleCheck aria-hidden="true" />} Approve
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {restoredAt && editable ? (
        <p role="status" className="flex flex-wrap items-center gap-3 rounded-lg bg-info/10 px-4 py-3 text-sm text-info">
          Restored the counts you had typed on this device at {formatDateTime(restoredAt)}.
          <button
            type="button"
            className="font-medium underline underline-offset-2"
            onClick={() => {
              setLines(take.lines);
              setRestoredAt(null);
              setDirty(false);
              void deleteDraft(draftKey(take.id));
            }}
          >
            Discard them
          </button>
        </p>
      ) : null}
      {!editable && status === "in_progress" ? (
        <p className="rounded-lg bg-surface-hover px-4 py-3 text-sm text-text-secondary">
          This count is still being worked on. You can follow along but not change it.
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or SKU…"
              aria-label="Search this count"
              className="min-w-56 flex-1 basis-64"
            />
            <div role="radiogroup" aria-label="Show" className="inline-flex rounded-lg border bg-card p-0.5 text-sm">
              {(
                [
                  ["all", `All ${summary.total}`],
                  ["uncounted", `Uncounted ${summary.uncounted}`],
                  ["differences", `Differences ${summary.differences}`],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={filter === value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    "rounded-md px-3 py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    filter === value ? "bg-primary text-primary-foreground" : "text-text-secondary hover:bg-surface-hover",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {editable ? (
            <p className="text-xs text-text-secondary">
              Type the number you counted for each item. Counts are kept on this device as you go.
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-xl border bg-card shadow-soft">
            <table className="w-full text-sm">
              <thead className="bg-background-subtle text-left text-xs text-table-header">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Item</th>
                  <th className="px-3 py-2.5 font-medium">SKU</th>
                  <th className="px-3 py-2.5 text-right font-medium">Expected</th>
                  <th className="px-3 py-2.5 font-medium">Counted</th>
                  <th className="px-3 py-2.5 text-right font-medium">Variance</th>
                  <th className="px-3 py-2.5 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-text-secondary">
                      {filter === "uncounted"
                        ? "Everything has been counted."
                        : filter === "differences"
                          ? "No differences so far."
                          : "No items match that search."}
                    </td>
                  </tr>
                ) : (
                  rows.map(({ line, entry }) => (
                    <CountRow
                      key={line.variantId}
                      line={line}
                      entry={entry}
                      editable={editable}
                      onChange={(patch) => update(line.variantId, patch)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="relative lg:sticky lg:top-0 lg:self-start">
          <Card className="gap-5 p-6">
            <div>
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-lg font-semibold">Progress</h2>
                <span className="tabular text-sm text-text-secondary">{progress}%</span>
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                aria-label="Items counted"
                className="mt-2 h-2 overflow-hidden rounded-full bg-surface-hover"
              >
                <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-text-secondary">Counted</dt>
              <dd className="text-right tabular">
                {summary.counted} of {summary.total}
              </dd>
              <dt className="text-text-secondary">Units expected</dt>
              <dd className="text-right tabular">{summary.expectedUnits}</dd>
              <dt className="text-text-secondary">Units counted</dt>
              <dd className="text-right tabular">{summary.countedUnits}</dd>
              <dt className="text-text-secondary">Differences</dt>
              <dd className="text-right tabular">{summary.differences}</dd>
              <dt className="font-semibold">Net variance</dt>
              <dd
                className={cn(
                  "text-right font-semibold tabular",
                  summary.netVariance < 0 && "text-destructive",
                  summary.netVariance > 0 && "text-success",
                )}
              >
                {formatVariance(summary.netVariance)}
              </dd>
            </dl>
            {editable && !summary.canSubmit ? (
              <p className="text-xs text-text-secondary">
                {summary.uncounted > 0
                  ? `${summary.uncounted} ${summary.uncounted === 1 ? "item" : "items"} still to count.`
                  : `${summary.missingReasons} ${summary.missingReasons === 1 ? "difference needs" : "differences need"} a reason.`}
              </p>
            ) : null}
            {take.approvedBy ? (
              <p className="border-t pt-3 text-xs text-text-secondary">
                Approved by {staffName(take.approvedBy)}
                {take.approvedAt ? ` on ${formatDateTime(take.approvedAt)}` : ""}.
              </p>
            ) : null}
            {stamped && status === "approved" ? <ApprovalStamp /> : null}
          </Card>
        </aside>
      </div>

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {status === "pending_approval" ? "Turn down this count?" : "Cancel this count?"}
            </DialogTitle>
            <DialogDescription>
              {status === "pending_approval"
                ? "The count is closed without changing any stock. The team can start a new one."
                : "The counts entered so far, including those saved on this device, are discarded. Stock is not changed."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Keep counting</DialogClose>
            <Button variant="destructive" disabled={cancel.isPending} onClick={cancelCount}>
              {cancel.isPending ? "Cancelling…" : status === "pending_approval" ? "Turn down" : "Cancel count"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CountRow({
  line,
  entry,
  editable,
  onChange,
}: {
  line: StockTakeLine;
  entry: { variant: Variant; product: Product } | undefined;
  editable: boolean;
  onChange: (patch: Partial<StockTakeLine>) => void;
}) {
  const variance = lineVariance(line);
  const differs = variance !== null && variance !== 0;
  const name = entry ? `${entry.product.name} ${variantLabel(entry.variant)}` : line.variantId;

  return (
    <tr
      id={`row-${line.variantId}`}
      className="border-t border-border-subtle"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {entry ? <ProductPicture product={entry.product} colour={entry.variant.colour} className="size-9" /> : null}
          <div>
            <p className="font-medium">{entry?.product.name ?? "Unknown item"}</p>
            <p className="text-xs text-text-secondary">{entry ? variantLabel(entry.variant) : ""}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs">{entry?.variant.sku}</td>
      <td className="px-4 py-3 text-right tabular">{line.expected}</td>
      <td className="px-4 py-3">
        {editable ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={`One fewer ${name}`}
              disabled={(line.counted ?? 0) <= 0}
              onClick={() => onChange({ counted: Math.max(0, (line.counted ?? 0) - 1) })}
            >
              <Minus />
            </Button>
            <Input
              inputMode="numeric"
              aria-label={`Counted ${name}`}
              placeholder="–"
              value={line.counted ?? ""}
              onChange={(e) => {
                const text = e.target.value.trim();
                onChange({ counted: text === "" ? null : Math.max(0, Math.floor(Number(text)) || 0) });
              }}
              className="h-9 w-16 text-center"
            />
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={`One more ${name}`}
              onClick={() => onChange({ counted: (line.counted ?? 0) + 1 })}
            >
              <Plus />
            </Button>
          </div>
        ) : (
          <span className="tabular">{line.counted ?? "–"}</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <span
          className={cn(
            "inline-block min-w-9 rounded-md px-2 py-0.5 text-center text-xs font-semibold tabular transition-colors duration-300",
            variance === null && "text-text-muted",
            variance === 0 && "bg-surface-hover text-text-secondary",
            differs && variance! < 0 && "bg-destructive/15 text-destructive",
            differs && variance! > 0 && "bg-success/15 text-success",
          )}
        >
          {variance === null ? "–" : formatVariance(variance)}
        </span>
      </td>
      <td className="px-4 py-3">
        {differs ? (
          editable ? (
            <select
              aria-label={`Reason for the difference on ${name}`}
              value={line.reason ?? ""}
              onChange={(e) => onChange({ reason: (e.target.value || undefined) as VarianceReason | undefined })}
              aria-invalid={!line.reason}
              className={cn(
                "h-9 rounded-lg border bg-input-background px-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/40",
                line.reason ? "border-input" : "border-destructive",
              )}
            >
              <option value="">Choose a reason…</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {reasonLabels[r]}
                </option>
              ))}
            </select>
          ) : (
            <span>{line.reason ? reasonLabels[line.reason] : "–"}</span>
          )
        ) : null}
      </td>
    </tr>
  );
}

/** A rubber-stamp slam shown right after approval. Reduced motion: it simply appears. */
function ApprovalStamp() {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      registerGsap();
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ref.current,
          { scale: 2.4, opacity: 0, rotate: -22 },
          { scale: 1, opacity: 1, rotate: -9, duration: duration.base, ease: ease.playful },
        );
      });
      mm.add(REDUCED_MOTION_QUERY, () => {
        gsap.set(ref.current, { rotate: -9 });
      });
    },
    { scope: ref },
  );
  return (
    <div
      ref={ref}
      role="status"
      className="pointer-events-none absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-lg border-4 border-success bg-card/80 py-3 text-center font-display text-2xl font-bold tracking-widest text-success uppercase"
    >
      Approved
    </div>
  );
}
