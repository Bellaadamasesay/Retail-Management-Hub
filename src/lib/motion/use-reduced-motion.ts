"use client";

import { useSyncExternalStore } from "react";
import { REDUCED_MOTION_QUERY } from "./tokens";

function subscribe(callback: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/** True when the user asked the OS to reduce motion. Server renders as false. */
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}
