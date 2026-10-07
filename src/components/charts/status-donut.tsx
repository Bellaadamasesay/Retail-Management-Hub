"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { statusLabel, type StockStatus } from "@/lib/inventory/stock";
import { formatNumber } from "@/lib/format/money";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";
import { cn } from "@/lib/utils";
import type { StatusCounts } from "@/features/dashboard/lib/metrics";

/** In stock green, low stock ochre, out of stock terracotta: the palette's inventory donut. */
const SEGMENTS: { status: StockStatus; token: string; dot: string }[] = [
  { status: "in", token: "var(--donut-in-stock)", dot: "bg-donut-in-stock" },
  { status: "low", token: "var(--donut-low-stock)", dot: "bg-donut-low-stock" },
  { status: "out", token: "var(--donut-out-of-stock)", dot: "bg-donut-out-of-stock" },
];

export function StatusDonut({ counts, className }: { counts: StatusCounts; className?: string }) {
  const reduced = useReducedMotion();
  const data = SEGMENTS.map((s) => ({ ...s, value: counts[s.status] }));

  return (
    <div className={cn("flex items-center gap-5", className)}>
      <div
        className="relative size-36 shrink-0"
        role="img"
        aria-label={`Inventory status: ${statusLabel.in} ${counts.in}, ${statusLabel.low} ${counts.low}, ${statusLabel.out} ${counts.out}`}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart>
            <Pie
              data={counts.total === 0 ? [{ status: "in", value: 1, token: "var(--border)" }] : data}
              dataKey="value"
              innerRadius="72%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={counts.total === 0 ? 0 : 2}
              stroke="none"
              isAnimationActive={!reduced}
              animationDuration={800}
            >
              {(counts.total === 0 ? [{ token: "var(--border)" }] : data).map((d, i) => (
                <Cell key={i} fill={d.token} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="tabular text-2xl leading-none font-semibold">{formatNumber(counts.total)}</p>
            <p className="mt-1 text-xs text-text-secondary">Total Items</p>
          </div>
        </div>
      </div>
      <ul className="flex flex-1 flex-col gap-3 text-sm">
        {data.map((d) => (
          <li key={d.status} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className={cn("size-2.5 rounded-full", d.dot)} />
              {d.status === "in" ? "In Stock" : d.status === "low" ? "Low Stock" : "Out of Stock"}
            </span>
            <span className="tabular font-semibold">{formatNumber(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
