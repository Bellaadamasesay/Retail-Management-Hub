"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";
import { cn } from "@/lib/utils";

export interface Series {
  key: string;
  label: string;
  /** CSS colour token, e.g. "var(--chart-1)". */
  token: string;
  /** Matching Tailwind background class for the legend dot. */
  className: string;
}

interface SeriesBarChartProps<T extends { label: string }> {
  data: T[];
  series: Series[];
  stacked?: boolean;
  /** Formats values in the tooltip and axis. */
  format: (value: number) => string;
  /** What the chart shows, for screen readers. */
  label: string;
  className?: string;
}

export function SeriesLegend({ series, className }: { series: Series[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary", className)}>
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("size-2.5 rounded-[3px]", s.className)} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/** A bar chart for any set of series, grouped or stacked, in the palette's chart colours. */
export function SeriesBarChart<T extends { label: string }>({ data, series, stacked = false, format, label, className }: SeriesBarChartProps<T>) {
  const reduced = useReducedMotion();
  const rows = data as unknown as Record<string, number | string>[];

  return (
    <div className={cn("h-64 w-full", className)} role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} interval="preserveStartEnd" />
          <YAxis tickFormatter={format} tickLine={false} axisLine={false} width={48} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: "var(--surface-hover)", opacity: 0.6 }}
            content={({ active, payload, label: tick }) =>
              active && payload?.length ? (
                <div className="rounded-lg bg-chart-tooltip px-3 py-2 text-xs shadow-lifted ring-1 ring-border">
                  <p className="mb-1 font-semibold">{tick}</p>
                  {payload.map((p) => (
                    <p key={String(p.dataKey)} className="flex items-center justify-between gap-6">
                      <span className="flex items-center gap-1.5 text-text-secondary">
                        <span className="size-2 rounded-[2px]" style={{ background: series.find((s) => s.key === p.dataKey)?.token }} />
                        {series.find((s) => s.key === p.dataKey)?.label}
                      </span>
                      <span className="tabular font-medium">{format(Number(p.value))}</span>
                    </p>
                  ))}
                </div>
              ) : null
            }
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId={stacked ? "stack" : undefined}
              fill={s.token}
              radius={!stacked || i === series.length - 1 ? [3, 3, 0, 0] : 0}
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
            {series.map((s) => (
              <th key={s.key}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r.label)}>
              <td>{String(r.label)}</td>
              {series.map((s) => (
                <td key={s.key}>{format(Number(r[s.key]))}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
