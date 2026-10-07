"use client";

import { useRef } from "react";
import { gsap, registerGsap, useGSAP } from "./register";
import { duration, ease, REDUCED_MOTION_QUERY } from "./tokens";

/**
 * Short crossfade + slide when a route's content mounts. Attach the returned
 * ref to the page wrapper. Reduced motion: no animation, content just appears.
 */
export function usePageTransition<T extends HTMLElement = HTMLDivElement>() {
  const container = useRef<T>(null);

  useGSAP(
    () => {
      registerGsap();
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(container.current, {
          opacity: 0,
          y: 10,
          duration: duration.base,
          ease: ease.enter,
          clearProps: "transform,opacity",
        });
      });
      mm.add(REDUCED_MOTION_QUERY, () => {
        gsap.set(container.current, { clearProps: "all" });
      });
    },
    { scope: container },
  );

  return container;
}
