"use client";

import { useSyncExternalStore } from "react";

/** Tracks a CSS media query. Server and first paint report `fallback`. */
export function useMediaQuery(query: string, fallback = false) {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => fallback,
  );
}
