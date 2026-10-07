"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, registerGsap } from "./register";
import { duration, ease } from "./tokens";
import { useReducedMotion } from "./use-reduced-motion";

interface CountUpOptions {
  /** Seconds. Defaults to the shared counting duration. */
  duration?: number;
  /** Starting value on first mount. Defaults to 0. */
  from?: number;
}

/**
 * Animates a number toward `value`. On first mount it counts up from `from`;
 * on later changes it tweens from the previously displayed value (live updates).
 * With reduced motion it jumps straight to the final value.
 */
export function useCountUp(value: number, options: CountUpOptions = {}) {
  const reduced = useReducedMotion();
  const { duration: seconds = duration.count, from = 0 } = options;
  const [display, setDisplay] = useState(reduced ? value : from);
  const current = useRef(reduced ? value : from);

  useEffect(() => {
    if (reduced) {
      current.current = value;
      return;
    }
    registerGsap();
    const state = { n: current.current };
    const tween = gsap.to(state, {
      n: value,
      duration: seconds,
      ease: ease.count,
      onUpdate: () => {
        current.current = state.n;
        setDisplay(state.n);
      },
    });
    return () => {
      tween.kill();
    };
  }, [value, seconds, reduced]);

  // Reduced motion bypasses the tween entirely and shows the real value.
  return reduced ? value : display;
}
