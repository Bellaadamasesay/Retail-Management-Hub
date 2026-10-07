"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CATEGORIES, type Bucket } from "@/features/dashboard/lib/metrics";
import { formatMoney } from "@/lib/format/money";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";
import type { Category } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/** Palette order (chart tokens): primary Forest, then Clay, then Ochre. */
const SERIES: Record<Category, { token: string; className: string }> = {
  Shoes: { token: "var(--chart-1)", className: "bg-chart-1" },
  Bags: { token: "var(--chart-2)", className: "bg-chart-2" },
  Accessories: { token: "var(--chart-3)", className: "bg-chart-3" },
};

/** "Le 6,000" on the axis would be wide; keep it compact: 6k, 1.2M. */
function compact(minor: number) {
  const value = minor / 100;
  if (value >= 1_000_000) return `${+(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${+(value / 1000).toFixed(1)}k`;
  return String(value);
}

interface SalesBarChartProps {
  data: Bucket[];
  /** What the chart shows, for screen readers. */
  label: string;
  className?: string;
}

export function SeriesLegend({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary", className)}>
      {CATEGORIES.map((c) => (
        <li key={c} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("size-2.5 rounded-[3px]", SERIES[c].className)} />
          {c}
        </li>
      ))}
    </ul>
  );
}

/** Stacked revenue bars by category. Bars grow from the baseline unless the user prefers reduced motion. */
export function SalesBarChart({ data, label, className }: SalesBarChartProps) {
  const reduced = useReducedMotion();
  const total = data.reduce((n, b) => n + b.Shoes + b.Bags + b.Accessories, 0);

  return (
    <div className={cn("h-64 w-full", className)} role="img" aria-label={`${label}. Total ${formatMoney(total)}.`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="0" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} interval="preserveStartEnd" />
          <YAxis
            tickFormatter={compact}
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-hover)", opacity: 0.6 }}
            content={({ active, payload, label: tick }) =>
              active && payload?.length ? (
                <div className="rounded-lg bg-chart-tooltip px-3 py-2 text-xs shadow-lifted ring-1 ring-border">
                  <p className="mb-1 font-semibold">{tick}</p>
                  {[...payload].reverse().map((p) => (
                    <p key={String(p.dataKey)} className="flex items-center justify-between gap-6">
                      <span className="flex items-center gap-1.5 text-text-secondary">
                        <span className="size-2 rounded-[2px]" style={{ background: SERIES[p.dataKey as Category]?.token }} />
                        {String(p.dataKey)}
                      </span>
                      <span className="tabular font-medium">{formatMoney(Number(p.value))}</span>
                    </p>
                  ))}
                </div>
              ) : null
            }
          />
          {CATEGORIES.map((c, i) => (
            <Bar
              key={c}
              dataKey={c}
              stackId="revenue"
              fill={SERIES[c].token}
              radius={i === CATEGORIES.length - 1 ? [3, 3, 0, 0] : 0}
              isAnimationActive={!reduced}
              animationDuration={700}
              animationEasing="ease-out"
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th>Period</th>
            {CATEGORIES.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((b) => (
            <tr key={b.key}>
              <td>{b.label}</td>
              {CATEGORIES.map((c) => (
                <td key={c}>{formatMoney(b[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
