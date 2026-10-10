/**
 * Live updates (new sales, stock changes) for the dashboard, streamed from the
 * server over Server-Sent Events (/api/events). The connection opens with the
 * first listener and closes with the last; the browser reconnects by itself.
 */
export type RealtimeEvent =
  | { type: "sale.created"; saleId: string; receiptNumber: string; total: number; at: string }
  | { type: "stock.changed"; at: string };

export type RealtimeHandler = (event: RealtimeEvent) => void;

const handlers = new Set<RealtimeHandler>();
let source: EventSource | null = null;

/** Listen for live events. Returns an unsubscribe function. */
export function subscribe(handler: RealtimeHandler): () => void {
  handlers.add(handler);
  if (!source && typeof EventSource !== "undefined") {
    source = new EventSource("/api/events");
    source.onmessage = (message: MessageEvent<string>) => {
      try {
        const event = JSON.parse(message.data) as RealtimeEvent;
        handlers.forEach((h) => h(event));
      } catch {
        // Not one of ours (e.g. a keep-alive): ignore.
      }
    };
  }
  return () => {
    handlers.delete(handler);
    if (handlers.size === 0) {
      source?.close();
      source = null;
    }
  };
}
