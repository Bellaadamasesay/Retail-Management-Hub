"use client";

import { ChevronRight, Download } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { DateRangePicker, type DayRange } from "@/components/shell/date-range-picker";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";

interface ReportFrameProps {
  title: string;
  description: string;
  /** Links shown above the title, e.g. Reports > Stock Movement. */
  crumbs?: { label: string; href?: string }[];
  range: DayRange;
  onRange: (range: DayRange) => void;
  today: string;
  /** Extra controls next to the date range. */
  controls?: ReactNode;
  onExport: () => void;
  exportLabel?: string;
  exportDisabled?: boolean;
  children: ReactNode;
}

/** The shared top of every report: breadcrumb, serif title, date range, export. */
export function ReportFrame({
  title,
  description,
  crumbs,
  range,
  onRange,
  today,
  controls,
  onExport,
  exportLabel = "Export Report",
  exportDisabled,
  children,
}: ReportFrameProps) {
  return (
    <div className="flex flex-col gap-8">
      {crumbs ? (
        <nav aria-label="Breadcrumb" className="-mb-2 flex flex-wrap items-center gap-1 text-sm text-text-secondary">
          {crumbs.map((c, i) => (
            <span key={c.label} className="flex items-center gap-1">
              {c.href ? (
                <Link href={c.href} className="underline-offset-2 hover:text-foreground hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page" className="font-medium text-foreground">
                  {c.label}
                </span>
              )}
              {i < crumbs.length - 1 ? <ChevronRight className="size-3.5" aria-hidden="true" /> : null}
            </span>
          ))}
        </nav>
      ) : null}
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            {controls}
            <DateRangePicker value={range} onChange={onRange} max={today} />
            <Button className="h-10" onClick={onExport} disabled={exportDisabled}>
              <Download aria-hidden="true" /> {exportLabel}
            </Button>
          </>
        }
      />
      {children}
    </div>
  );
}
