import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTimeKo, formatTimeKo, labelForHealth, labelForStatus } from "@/lib/korean-labels";
import { getControlCenterSummary } from "@/server/control-center";

export const dynamic = "force-dynamic";

type StatusKind = "ok" | "warn" | "danger" | "info" | "muted" | undefined;

function statusKind(status: string): StatusKind {
  if (["ok", "running", "completed", "process_live"].includes(status)) return "ok";
  if (["degraded", "waiting_approval", "needs_changes", "stopped", "queued", "blocked"].includes(status)) return "warn";
  if (["failing", "failed", "critical"].includes(status)) return "danger";
  if (["workflow_running", "executing"].includes(status)) return "info";
  return "muted";
}

function eventKind(severity: string): StatusKind {
  if (severity === "critical") return "danger";
  if (severity === "warning") return "warn";
  return "info";
}

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

export default async function ObservePage() {
  const control = await getControlCenterSummary();
  const costRows = control.costRows.filter((row) => row.costToday > 0 || row.tokensToday > 0 || row.latencyMs !== null).slice(0, 10);

  return (
    <>
      <AutoRefresh intervalMs={8000} />
      <div className="control-shell">
        <section className="control-hero">
          <div>
            <div className="eyebrow">Observe · 계기판</div>
            <h1>Read-only 관측</h1>
            <p>system health, agent fleet, traces, events, incidents, cost/latency, worker/cron 상태를 읽기 전용으로 본다. 조작은 Control에서만 한다.</p>
          </div>
          <div className="control-hero-actions">
            <div className="live-pill"><span /> Live · {formatTimeKo(control.generatedAt)}</div>
            <Link href={"/observe/agents" as never} className="btn ghost sm">Agent fleet 상세</Link>
          </div>
        </section>

        <section className="control-metrics" aria-label="Observe Summary">
          <div className="control-metric"><span>Agent fleet</span><strong>{control.summary.running}/{control.summary.agents}</strong><em>live/total</em></div>
          <div className="control-metric"><span>Traces</span><strong>{control.traces.length}</strong><em>recent lineage events</em></div>
          <div className={`control-metric ${control.summary.incidents > 0 ? "alert" : ""}`}><span>Incidents</span><strong>{control.summary.incidents}</strong><em>critical/failed task derived</em></div>
          <div className="control-metric"><span>Cost/token</span><strong>{money(control.summary.totalCostToday)}</strong><em>avg latency {control.summary.averageLatencyMs}ms</em></div>
        </section>

        <section className="control-grid">
          <div className="card control-span-8">
            <div className="card-head"><div className="title">System Health</div><div className="sub">· deep/cron/auth/worker · read-only</div></div>
            <div className="card-body flush control-table-wrap">
              <table className="tbl control-table">
                <thead><tr><th>System</th><th>Scope</th><th>State</th><th>Note</th></tr></thead>
                <tbody>
                  {control.healthRows.slice(0, 16).map((row) => (
                    <tr key={`${row.scope}-${row.name}`}>
                      <td><strong>{row.name}</strong></td>
                      <td>{row.scope}</td>
                      <td><StatusBadge label={labelForHealth(row.status)} kind={statusKind(row.status)} /></td>
                      <td className="truncate-cell">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card control-span-4">
            <div className="card-head"><div className="title">Worker / Cron State</div><div className="sub">· stopped by design 구분</div></div>
            <div className="card-body control-health-list">
              {control.localSystems.systems.map((system) => (
                <div key={system.slug} className="health-row">
                  <div><strong>{system.name}</strong><span>{system.scope} · {system.route}</span></div>
                  <StatusBadge label={system.state} kind={statusKind(system.state)} />
                </div>
              ))}
            </div>
          </div>

          <div className="card control-span-8" id="agents">
            <div className="card-head"><div className="title">Agent Fleet Compact</div><div className="sub">· status only · intervention stays in Control</div><div className="right"><Link href={"/observe/agents" as never} className="btn ghost sm">상세</Link></div></div>
            <div className="card-body flush control-table-wrap">
              <table className="tbl control-table">
                <thead><tr><th>Agent</th><th>Scope</th><th>Runtime</th><th>Current task</th><th>Heartbeat</th><th>Risk</th><th>Queue</th></tr></thead>
                <tbody>
                  {control.agents.slice(0, 12).map((agent) => (
                    <tr key={agent.id}>
                      <td><strong>{agent.name}</strong><div className="mono tiny">{agent.slug}</div></td>
                      <td><StatusBadge label={agent.scope} kind={agent.scope === "Company" ? "ok" : "muted"} /></td>
                      <td><StatusBadge label={labelForStatus(agent.runtimeLabel)} kind={statusKind(agent.runtime)} /></td>
                      <td className="truncate-cell">{agent.currentTask ?? "현재 작업 없음"}</td>
                      <td>{formatTimeKo(agent.heartbeatAt)}</td>
                      <td><RiskBadge risk={agent.risk} /></td>
                      <td className="mono tiny">{agent.queueDepth}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card control-span-4">
            <div className="card-head"><div className="title">Cost / Latency</div><div className="sub">· model metadata aggregates</div></div>
            <div className="card-body cost-list">
              {costRows.map((row) => (
                <div key={row.traceId} className="cost-row">
                  <div><strong>{row.agent}</strong><span className="mono">{row.model}</span></div>
                  <div><strong>{money(row.costToday)}</strong><span>{row.tokensToday} tok · {row.latencyMs ?? "—"}ms</span></div>
                </div>
              ))}
              {costRows.length === 0 && <div className="empty">비용/토큰 메타데이터 없음</div>}
            </div>
          </div>

          <div className="card control-span-4">
            <div className="card-head"><div className="title">Trace Preview</div><div className="sub">· lineage route</div></div>
            <div className="card-body trace-list">
              {control.traces.slice(0, 10).map((trace) => (
                <div key={trace.id} className="trace-row">
                  <span className={`trace-dot ${trace.status}`} />
                  <div><strong>{trace.kind}</strong><span>{trace.title}</span><em>{formatTimeKo(trace.at)} · <Link href={`/traces/${trace.traceId}` as never}>{trace.traceId.slice(0, 10)}</Link></em></div>
                </div>
              ))}
              {control.traces.length === 0 && <div className="empty">trace event 없음</div>}
            </div>
          </div>

          <div className="card control-span-4">
            <div className="card-head"><div className="title">Incidents</div><div className="sub">· read-only triage feed</div></div>
            <div className="card-body incident-list">
              {control.incidents.slice(0, 8).map((incident) => (
                <div key={incident.id} className={`incident-row ${incident.severity}`}>
                  <strong>{incident.title}</strong>
                  <span>{incident.state} · {incident.affectedScope.join(" / ") || "scope unknown"}</span>
                  <em>{formatDateTimeKo(incident.updatedAt)} · {incident.traceId.slice(0, 10)}</em>
                </div>
              ))}
              {control.incidents.length === 0 && <div className="empty">열린 incident 없음</div>}
            </div>
          </div>

          <div className="card control-span-4">
            <div className="card-head"><div className="title">Events</div><div className="sub">· latest · secret-safe metadata</div></div>
            <div className="card-body trace-list">
              {control.events.slice(0, 12).map((event) => (
                <div key={event.id} className="trace-row">
                  <span className={`trace-dot ${event.severity === "critical" ? "failed" : event.severity === "warning" ? "blocked" : "succeeded"}`} />
                  <div><strong>{event.source}</strong><span>{event.message}</span><em>{formatTimeKo(event.createdAt)} · <StatusBadge label={labelForStatus(event.severity)} kind={eventKind(event.severity)} /></em></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
