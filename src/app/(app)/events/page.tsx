import { EventTimeline } from "@/components/event-timeline";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const events = await db.event.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6"><h2 className="text-2xl font-semibold">Events</h2><p className="mt-2 text-sm text-[var(--muted)]">Filterable API: `/api/events?type=...`; realtime snapshot SSE: `/api/events/stream`.</p><div className="mt-5"><EventTimeline events={events} /></div></section>;
}
