import type { Event } from "@prisma/client";

function severityKind(s: string) {
  if (s === "critical") return "danger";
  if (s === "warning") return "warn";
  if (s === "info") return "info";
  if (s === "ok") return "ok";
  return "muted";
}

export function EventTimeline({ events }: { events: Event[] }) {
  if (events.length === 0) {
    return <div className="empty">No events recorded yet.</div>;
  }
  return (
    <div className="timeline">
      {events.map((e) => (
        <div key={e.id} className={`tl-item ${severityKind(e.severity)}`}>
          <div className="tl-dot" />
          <div className="tl-body">
            <div className="tl-title">{e.message}</div>
            <div className="tl-meta">
              <span className="mono" style={{ color: "var(--text-3)" }}>{e.type}</span>
            </div>
          </div>
          <div className="tl-time">{e.createdAt.toLocaleTimeString()}</div>
        </div>
      ))}
    </div>
  );
}
