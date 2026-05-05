import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const events = await db.event.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>Events</h1>
          <div className="sub">Audit stream · last 24h shown</div>
        </div>
        <div className="actions">
          <span className="badge ok"><span className="dot" /> Connected</span>
        </div>
      </div>
      <div className="card">
        <div className="card-body flush">
          <table className="tbl">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Type</th>
                <th>Message</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const kind =
                  e.severity === "critical"
                    ? "danger"
                    : e.severity === "warning"
                      ? "warn"
                      : "muted";
                return (
                  <tr key={e.id}>
                    <td>
                      <span className={`sev ${kind}`} style={{ marginRight: 8 }} />
                      <span className="muted" style={{ fontSize: 12 }}>{e.severity}</span>
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>{e.type}</td>
                    <td>{e.message}</td>
                    <td className="muted">{new Date(e.createdAt).toLocaleTimeString()}</td>
                  </tr>
                );
              })}
              {events.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty">No events.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
