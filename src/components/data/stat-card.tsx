"use client";

import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Sparkline } from "@/components/data/sparkline";
import { Card } from "@/components/ui/card";
import { formatMoney, formatNumber, MINOR_FACTOR } from "@/lib/format/money";
import { useCountUp } from "@/lib/motion/use-count-up";
import { cn } from "@/lib/utils";

/** Accent families from the palette's KPI card table: tinted icon tile + emphasis colour. */
export type StatAccent = "forest" | "clay" | "sage" | "ochre" | "info";

const accentStyles: Record<StatAccent, { tile: string; spark: string }> = {
  forest: { tile: "bg-kpi-forest-bg text-kpi-forest-fg", spark: "text-kpi-forest-fg" },
  clay: { tile: "bg-kpi-clay-bg text-kpi-clay-fg", spark: "text-kpi-clay-fg" },
  sage: { tile: "bg-kpi-sage-bg text-kpi-sage-fg", spark: "text-kpi-sage-fg" },
  ochre: { tile: "bg-kpi-ochre-bg text-kpi-ochre-fg", spark: "text-kpi-ochre-fg" },
  info: { tile: "bg-kpi-info-bg text-kpi-info-fg", spark: "text-kpi-info-fg" },
};

interface StatCardProps {
  label: string;
  /** Raw value: minor units when kind is "money", otherwise a plain number. */
  value: number;
  kind?: "money" | "number";
  icon: LucideIcon;
  accent?: StatAccent;
  /** Percentage change, shown with an arrow, e.g. `{ percent: 12, label: "from yesterday" }`. */
  delta?: { percent: number; label: string };
  /** Plain context line shown when there is no delta, e.g. "All stock take records". */
  hint?: ReactNode;
  /** Micro-trend; omit for cards without a chart. */
  trend?: number[];
  className?: string;
}

export function StatCard({
  label,
  value,
  kind = "number",
  icon: Icon,
  accent = "forest",
  delta,
  hint,
  trend,
  className,
}: StatCardProps) {
  const animated = useCountUp(value);
  // While counting, step in whole Leones so cents don't flicker; the final value shows exactly.
  const shown =
    kind === "money" && animated !== value
      ? Math.round(animated / MINOR_FACTOR) * MINOR_FACTOR
      : animated;
  const text = kind === "money" ? formatMoney(shown) : formatNumber(shown);
  const styles = accentStyles[accent];
  const up = (delta?.percent ?? 0) >= 0;

  return (
    <Card
      data-stagger
      className={cn(
        "relative gap-0 p-6 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lifted",
        className,
      )}
    >
      <div className="flex items-center gap-3.5">
        <div
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-xl",
            styles.tile,
          )}
        >
          <Icon className="size-[1.4rem]" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-text-secondary">{label}</p>
          <p className="tabular mt-0.5 text-[1.5rem] leading-tight font-semibold whitespace-nowrap">
            {text}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        {delta ? (
          <p className="flex items-center gap-1 text-[0.8125rem] whitespace-nowrap text-text-secondary">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-semibold",
                up ? "text-success" : "text-destructive",
              )}
            >
              {up ? (
                <ArrowUp className="size-3.5" aria-label="Up" />
              ) : (
                <ArrowDown className="size-3.5" aria-label="Down" />
              )}
              {Math.abs(delta.percent)}%
            </span>
            {delta.label}
          </p>
        ) : (
          <p className="text-sm text-text-secondary">{hint}</p>
        )}
        {trend ? (
          <div className="w-[38%] max-w-36">
            <Sparkline data={trend} className={styles.spark} />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
