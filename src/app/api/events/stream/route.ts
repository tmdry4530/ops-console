import { listEvents } from "@/server/events";
import { formatSseFrame } from "@/server/event-stream";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      let iteration = 0;
      let lastFirstId = "";
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(formatSseFrame(event, data)));
      const tick = async () => {
        if (closed || request.signal.aborted) return;
        try {
          const events = await listEvents();
          const firstId = events[0]?.id ?? "";
          send(iteration === 0 ? "snapshot" : firstId !== lastFirstId ? "update" : "heartbeat", {
            events,
            generatedAt: new Date().toISOString(),
            iteration
          });
          lastFirstId = firstId;
          iteration += 1;
        } catch (error) {
          send("error", { message: error instanceof Error ? error.message : "event stream error" });
        }
      };
      void tick();
      interval = setInterval(() => void tick(), 2000);
      request.signal.addEventListener("abort", () => {
        closed = true;
        if (interval) clearInterval(interval);
        controller.close();
      });
    },
    cancel() {
      closed = true;
      if (interval) clearInterval(interval);
    }
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive"
    }
  });
}
