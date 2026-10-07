/** Single source of truth for animation timing, so motion feels consistent. */
export const duration = {
  fast: 0.18,
  base: 0.35,
  slow: 0.7,
  count: 1.1,
} as const;

export const ease = {
  enter: "power3.out",
  move: "expo.inOut",
  playful: "back.out(1.4)",
  count: "power2.out",
} as const;

export const stagger = {
  tight: 0.04,
  base: 0.07,
  loose: 0.12,
} as const;

/** Media query used by every hook to decide whether to skip motion. */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
