import Link from "next/link";
import { MetricCard } from "@/components/metric-card";
import { getDiscordOutboxSummary } from "@/server/discord-outbox-monitor";
import { formatDateTimeKo } from "@/lib/korean-labels";

export const dynamic = "force-dynamic";

function meta(value: unknown, key: string) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? String((value as Record<string, unknown>)[key] ?? "-")
    : "-";
}

export default async function ReportsPage() {
  const summary = await getDiscordOutboxSummary();
  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>Discord Outbox</h1>
          <div className="sub">queued · retry · dead-letter · delivered 관리</div>
        </div>
        <div className="actions">
          <Link href="/events" className="btn sm">이벤트 스트림</Link>
        </div>
      </div>

      <div className="grid-12" style={{ marginBottom: 20 }}>
        <div className="span-3"><MetricCard label="Queued" value={String(summary.totals.queued)} delta="backlog" /></div>
        <div className="span-3"><MetricCard label="Retry" value={String(summary.totals.retryPending)} delta="pending" /></div>
        <div className="span-3"><MetricCard label="Dead-letter" value={String(summary.totals.deadLetter)} delta="needs review" /></div>
        <div className="span-3"><MetricCard label="Delivered" value={String(summary.totals.delivered)} delta="sent" trend="up" /></div>
      </div>

      <div className="card">
        <div className="card-body flush">
          <div className="tbl-wrap">
            <table className="tbl compact-paths">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Status</th>
                  <th style={{ width: 110 }}>Channel</th>
                  <th className="path-col">Message</th>
                  <th style={{ width: 90 }}>Attempts</th>
                  <th className="date-col">Time</th>
                </tr>
              </thead>
              <tbody>
                {summary.items.map((item) => (
                  <tr key={item.event.id}>
                    <td>
                      <span className={`badge ${item.status === "dead_letter" ? "warn" : item.status === "delivered" ? "ok" : ""}`}>
                        <span className="dot" />{item.status}
                      </span>
                    </td>
                    <td>{meta(item.event.metadata, "channel")}</td>
                    <td className="path-col">{item.event.message}</td>
                    <td className="mono">{meta(item.event.metadata, "deliveryAttempts")}</td>
                    <td className="muted date-col">{formatDateTimeKo(item.event.createdAt)}</td>
                  </tr>
                ))}
                {summary.items.length === 0 && <tr><td colSpan={5} className="empty">No reports.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
