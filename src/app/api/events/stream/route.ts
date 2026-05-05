import { listEvents } from "@/server/events";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  const events = await listEvents();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`event: snapshot\ndata: ${JSON.stringify({ events })}\n\n`));
      controller.close();
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
