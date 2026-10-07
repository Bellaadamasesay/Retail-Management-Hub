"use client";

import { useId, useRef } from "react";
import { gsap, registerGsap, useGSAP } from "@/lib/motion/register";
import { duration, ease, REDUCED_MOTION_QUERY } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  /** Line colour comes from `currentColor`, so set a text colour class. */
  className?: string;
}

const W = 120;
const H = 44;
const PAD = 3;

function toPoints(data: number[]) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  return data.map((v, i) => [
    (i / Math.max(data.length - 1, 1)) * W,
    H - PAD - ((v - min) / span) * (H - PAD * 2),
  ]);
}

/** Smooth micro-trend line with a soft area fill; the line draws itself in. */
export function Sparkline({ data, className }: SparklineProps) {
  const gradientId = useId();
  const line = useRef<SVGPathElement>(null);
  const root = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      registerGsap();
      const path = line.current;
      if (!path || typeof path.getTotalLength !== "function") return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const length = path.getTotalLength();
        gsap.fromTo(
          path,
          { strokeDasharray: length, strokeDashoffset: length },
          {
            strokeDashoffset: 0,
            duration: duration.slow,
            ease: ease.enter,
            clearProps: "strokeDasharray,strokeDashoffset",
          },
        );
      });
      mm.add(REDUCED_MOTION_QUERY, () => {});
    },
    { scope: root },
  );

  if (data.length < 2) return null;
  const pts = toPoints(data);
  // Smooth the line with horizontal-tangent cubic segments between points.
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  const area = `${d} L${W},${H} L0,${H} Z`;

  return (
    <svg
      ref={root}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("h-11 w-full overflow-visible", className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        ref={line}
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
