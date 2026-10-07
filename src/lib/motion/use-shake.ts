"use client";

import { useCallback, useRef } from "react";
import { gsap, registerGsap } from "./register";
import { REDUCED_MOTION_QUERY } from "./tokens";

/**
 * A short horizontal shake for failed sign-ins and invalid fields. Attach the
 * ref to the element; call `shake()` on failure. Reduced motion: no movement
 * (the error message and red state still communicate the failure).
 */
export function useShake<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  const shake = useCallback(() => {
    const el = ref.current;
    if (!el || window.matchMedia(REDUCED_MOTION_QUERY).matches) return;
    registerGsap();
    gsap.fromTo(
      el,
      { x: 0 },
      {
        keyframes: { x: [-10, 9, -7, 5, -3, 0] },
        duration: 0.42,
        ease: "power2.out",
        clearProps: "transform",
      },
    );
  }, []);

  return { ref, shake };
}
