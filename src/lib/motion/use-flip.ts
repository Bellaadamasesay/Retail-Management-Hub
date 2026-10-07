"use client";

import { useCallback, useRef } from "react";
import { gsap, registerGsap, useGSAP } from "./register";
import { duration, ease, REDUCED_MOTION_QUERY } from "./tokens";

type FlipState = ReturnType<(typeof import("gsap/Flip"))["Flip"]["getState"]>;

/**
 * GSAP Flip for reordering and layout switches (filter, sort, grid/table).
 * Elements carry `data-flip-id`; call `capture()` right before the state change
 * that moves them, and they glide from their old to new positions after render.
 * The Flip plugin is loaded on first use. Reduced motion: no animation.
 */
export function useFlip<T extends HTMLElement = HTMLDivElement>(dependencies: unknown[]) {
  const scope = useRef<T>(null);
  const saved = useRef<FlipState | null>(null);

  const capture = useCallback(async () => {
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;
    const { Flip } = await import("gsap/Flip");
    registerGsap();
    gsap.registerPlugin(Flip);
    saved.current = Flip.getState("[data-flip-id]");
  }, []);

  useGSAP(
    () => {
      const state = saved.current;
      if (!state) return;
      saved.current = null;
      import("gsap/Flip").then(({ Flip }) => {
        gsap.registerPlugin(Flip);
        const mm = gsap.matchMedia();
        mm.add("(prefers-reduced-motion: no-preference)", () => {
          Flip.from(state, {
            duration: duration.base,
            ease: ease.enter,
            absolute: false,
            nested: false,
            onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: duration.base }),
            onLeave: (els) => gsap.to(els, { opacity: 0, duration: duration.fast }),
          });
        });
      });
    },
    { scope, dependencies },
  );

  return { scope, capture };
}
