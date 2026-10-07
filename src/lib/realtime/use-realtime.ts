"use client";

import { useEffect, useEffectEvent } from "react";
import { subscribe, type RealtimeHandler } from "./index";

/** Calls `handler` for every live event while the component is mounted. */
export function useRealtime(handler: RealtimeHandler) {
  const latest = useEffectEvent(handler);
  useEffect(() => subscribe((event) => latest(event)), []);
}
