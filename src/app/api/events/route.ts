import type { RealtimeEvent } from "@/lib/realtime";
import { requireUser } from "@/server/auth";
import { bus } from "@/server/events";
import { handle } from "@/server/http";

export const dynamic = "force-dynamic";

/** Server-Sent Events: new sales and stock changes, for live dashboards. */
export const GET = handle(async (request) => {
  await requireUser();
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: RealtimeEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      // Comments keep proxies from closing an idle connection.
      const ping = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 25_000);
      bus.on("event", send);
      cleanup = () => {
        clearInterval(ping);
        bus.off("event", send);
      };
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      });
      controller.enqueue(encoder.encode(": connected\n\n"));
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
});
