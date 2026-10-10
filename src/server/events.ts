import { EventEmitter } from "node:events";
import type { RealtimeEvent } from "@/lib/realtime";

/**
 * Live events (new sales, stock changes) for open dashboards, streamed by
 * /api/events. In-process, so it reaches everyone connected to this server
 * instance: right for one web service; several instances would need a shared
 * channel such as Postgres LISTEN/NOTIFY.
 */
const cache = globalThis as unknown as { __rmhEvents?: EventEmitter };
export const bus = (cache.__rmhEvents ??= new EventEmitter().setMaxListeners(200));

/** Announce after the change has been committed. */
export function publish(event: RealtimeEvent) {
  bus.emit("event", event);
}
