"use client";

import { useRef } from "react";
import { gsap, registerGsap, useGSAP } from "./register";
import { duration, ease, stagger } from "./tokens";
import { REDUCED_MOTION_QUERY } from "./tokens";

interface StaggerOptions {
  /** CSS selector (inside the container) for the items to animate. */
  selector?: string;
  /** Vertical offset in px the items rise from. */
  y?: number;
  /** Replay the entrance when these change (e.g. once async rows have arrived). */
  dependencies?: unknown[];
}

/**
 * Fades + lifts children into place one after another (cards, rows, tiles).
 * Attach the returned ref to the container. Reduced motion: items just appear.
 */
export function useStaggerIn<T extends HTMLElement = HTMLDivElement>({
  selector = "[data-stagger]",
  y = 16,
  dependencies = [],
}: StaggerOptions = {}) {
  const container = useRef<T>(null);

  useGSAP(
    () => {
      registerGsap();
      // Nothing to animate yet (e.g. a table still waiting for its rows).
      if (!container.current?.querySelector(selector)) return;
      const mm = gsap.matchMedia();
      mm.add(`(prefers-reduced-motion: no-preference)`, () => {
        gsap.from(selector, {
          opacity: 0,
          y,
          scale: 0.985,
          duration: duration.base,
          ease: ease.enter,
          stagger: stagger.base,
          clearProps: "transform,opacity",
        });
      });
      mm.add(REDUCED_MOTION_QUERY, () => {
        gsap.set(selector, { clearProps: "all" });
      });
    },
    { scope: container, dependencies, revertOnUpdate: true },
  );

  return container;
}
