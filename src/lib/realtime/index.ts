/**
 * Live updates (new sales, stock changes) for the dashboard. The UI only knows
 * this interface; today it is fed by the mock API through a BroadcastChannel,
 * and when the backend exists this file becomes an SSE or WebSocket client
 * with the same shape.
 */
export type RealtimeEvent =
  | { type: "sale.created"; saleId: string; receiptNumber: string; total: number; at: string }
  | { type: "stock.changed"; at: string };

export type RealtimeHandler = (event: RealtimeEvent) => void;

const CHANNEL = "retailhub-realtime";
const handlers = new Set<RealtimeHandler>();
let channel: BroadcastChannel | null = null;

function ensureChannel() {
  if (channel || typeof BroadcastChannel === "undefined") return;
  channel = new BroadcastChannel(CHANNEL);
  // Events from other tabs.
  channel.onmessage = (message: MessageEvent<RealtimeEvent>) => handlers.forEach((h) => h(message.data));
}

/** Listen for live events. Returns an unsubscribe function. */
export function subscribe(handler: RealtimeHandler): () => void {
  ensureChannel();
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

/** Mock server side: announce an event to this tab's listeners and every other tab. */
export function publish(event: RealtimeEvent) {
  ensureChannel();
  handlers.forEach((h) => h(event));
  channel?.postMessage(event);
}
