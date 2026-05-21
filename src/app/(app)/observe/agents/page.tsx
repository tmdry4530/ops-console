import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
import { formatTimeKo, labelForStatus } from "@/lib/korean-labels";
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

export default async function ObserveAgentsPage() {
  const control = await getControlCenterSummary();

  return (
    <>
      <AutoRefresh intervalMs={8000} />
      <div className="control-shell">
        <section className="control-hero">
          <div>
            <div className="eyebrow">Observe / Agents · read-only</div>
            <h1>Agent Fleet</h1>
            <p>agent 상태 확인 전용 화면이다. pause/resume/cancel/reassign/scope-limit 같은 개입은 Control drawer에서만 한다.</p>
          </div>
          <div className="control-hero-actions">
            <Link href={"/control#agent-drawer" as never} className="btn warn sm">개입은 Control</Link>
            <Link href={"/observe" as never} className="btn ghost sm">Observe</Link>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><div className="title">Agent Fleet Detail</div><div className="sub">· model/cost/risk/current task/capabilities</div></div>
          <div className="card-body flush control-table-wrap">
            <table className="tbl control-table">
              <thead><tr><th>Agent</th><th>Scope</th><th>Status</th><th>Current task</th><th>Heartbeat</th><th>Model</th><th>Cost</th><th>Risk</th><th>Queue</th><th>Capabilities</th></tr></thead>
              <tbody>
                {control.agents.map((agent) => (
                  <tr key={agent.id} className={agent.expectedStopped ? "is-neutral" : ""}>
                    <td><strong>{agent.name}</strong><div className="mono tiny">{agent.slug}</div></td>
                    <td><StatusBadge label={agent.scope} kind={agent.scope === "Company" ? "ok" : "muted"} /></td>
                    <td><StatusBadge label={agent.expectedStopped ? "정상 중지" : labelForStatus(agent.runtimeLabel)} kind={statusKind(agent.runtime)} /></td>
                    <td className="truncate-cell">{agent.currentTask ?? "현재 작업 없음"}</td>
                    <td>{formatTimeKo(agent.heartbeatAt)}</td>
                    <td className="mono tiny">{agent.model}</td>
                    <td className="mono tiny">${agent.costToday.toFixed(2)}</td>
                    <td><RiskBadge risk={agent.risk} /></td>
                    <td className="mono tiny">{agent.queueDepth}</td>
                    <td className="truncate-cell">{agent.capabilities.join(", ") || "capability 없음"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
