"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Page numbers to show: 1 2 3 4 5 … 31 near the start, a window in the middle, … 27 28 29 30 31 near the end. */
export function pageWindow(current: number, count: number): (number | "gap")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "gap", count];
  if (current >= count - 3) return [1, "gap", count - 4, count - 3, count - 2, count - 1, count];
  return [1, "gap", current - 1, current, current + 1, "gap", count];
}

interface TablePaginationProps {
  /** Zero-based page index. */
  page: number;
  pageSize: number;
  totalItems: number;
  pageSizeOptions: readonly number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Plural noun for the summary, e.g. "products". */
  itemLabel: string;
}

const pageButton =
  "grid size-9 place-items-center rounded-lg border text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40";

/** "Showing 1 to 8 of 245 products" with rows-per-page and numbered pager, as on the approved list screens. */
export function TablePagination({
  page,
  pageSize,
  totalItems,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  itemLabel,
}: TablePaginationProps) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const from = totalItems === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(totalItems, (page + 1) * pageSize);

  return (
    <div className="flex flex-col items-start justify-between gap-3 py-3 text-sm sm:flex-row sm:items-center">
      <p className="text-text-secondary" aria-live="polite">
        Showing {from} to {to} of {totalItems} {itemLabel}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-text-secondary">Rows per page</span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(Number(v))}
          items={pageSizeOptions.map((n) => ({ value: String(n), label: String(n) }))}
        >
          <SelectTrigger aria-label="Rows per page" className="h-9 w-[4.5rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} className="min-w-[4.5rem]">
            {pageSizeOptions.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <nav aria-label="Pagination" className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Previous page"
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
            className={cn(pageButton, "border-border bg-card hover:bg-surface-hover")}
          >
            <ChevronLeft className="size-4" />
          </button>
          {pageWindow(page + 1, pageCount).map((entry, i) =>
            entry === "gap" ? (
              <span key={`gap-${i}`} aria-hidden="true" className="grid size-9 place-items-center text-text-secondary">
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                aria-label={`Page ${entry}`}
                aria-current={entry === page + 1 ? "page" : undefined}
                onClick={() => onPageChange(entry - 1)}
                className={cn(
                  pageButton,
                  entry === page + 1
                    ? "border-primary bg-primary font-medium text-primary-foreground"
                    : "border-border bg-card hover:bg-surface-hover",
                )}
              >
                {entry}
              </button>
            ),
          )}
          <button
            type="button"
            aria-label="Next page"
            disabled={page >= pageCount - 1}
            onClick={() => onPageChange(page + 1)}
            className={cn(pageButton, "border-border bg-card hover:bg-surface-hover")}
          >
            <ChevronRight className="size-4" />
          </button>
        </nav>
      </div>
    </div>
  );
}
