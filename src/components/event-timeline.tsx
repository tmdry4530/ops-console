import type { Event } from "@prisma/client";
import { StatusBadge } from "./status-badge";

export function EventTimeline({ events }: Readonly<{ events: Event[] }>) {
  if (events.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No events recorded yet.</p>;
  }

  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li className="rounded-2xl border border-[var(--line)] bg-[#07110f] p-4" key={event.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">{event.message}</p>
            <StatusBadge label={event.severity} tone={event.severity === "critical" ? "danger" : event.severity === "warning" ? "warning" : "neutral"} />
          </div>
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{event.type} · {event.createdAt.toISOString()}</p>
        </li>
      ))}
    </ol>
  );
}
