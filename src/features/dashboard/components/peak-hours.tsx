"use client";

import { useRef } from "react";
import { gsap, registerGsap, useGSAP } from "@/lib/motion/register";
import { duration, ease, stagger } from "@/lib/motion/tokens";
import { TRADING_HOURS } from "../lib/metrics";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hour = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "a" : "p"}`;

/**
 * When the shop is busiest: weekday by trading hour, cell depth showing the
 * number of sales. Cells fade in one after another. The counts are also there
 * as text for screen readers.
 */
export function PeakHours({ grid }: { grid: number[][] }) {
  const root = useRef<HTMLDivElement>(null);
  const max = Math.max(1, ...grid.flat());

  useGSAP(
    () => {
      registerGsap();
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-cell]", { opacity: 0, scale: 0.6, duration: duration.fast, ease: ease.enter, stagger: { each: stagger.tight / 3, grid: [7, TRADING_HOURS.length], from: "start" } });
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="flex flex-col gap-1.5" role="group" aria-label="Busiest hours by weekday">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `2.25rem repeat(${TRADING_HOURS.length}, minmax(0, 1fr))` }}>
        <span />
        {TRADING_HOURS.map((h) => (
          <span key={h} className="text-center text-[0.65rem] text-text-secondary">
            {hour(h)}
          </span>
        ))}
        {grid.map((row, d) => (
          <div key={DAYS[d]} className="contents">
            <span className="self-center text-xs text-text-secondary">{DAYS[d]}</span>
            {row.map((count, i) => (
              <span
                key={i}
                data-cell
                title={`${DAYS[d]} ${hour(TRADING_HOURS[i])}: ${count} ${count === 1 ? "sale" : "sales"}`}
                className="aspect-square rounded-[5px] bg-chart-1"
                style={{ opacity: count === 0 ? 0.07 : 0.18 + (count / max) * 0.82 }}
              >
                <span className="sr-only">
                  {DAYS[d]} {hour(TRADING_HOURS[i])}: {count}
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1 flex items-center justify-end gap-2 text-[0.65rem] text-text-secondary" aria-hidden="true">
        Quieter
        {[0.1, 0.35, 0.6, 0.85, 1].map((o) => (
          <span key={o} className="size-3 rounded-[3px] bg-chart-1" style={{ opacity: o }} />
        ))}
        Busier
      </div>
    </div>
  );
}
