import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
import { GlobalCommandBar } from "@/components/global-command-bar";
import { LiveInterventionPanel } from "@/components/live-intervention-panel";
import { formatTimeKo, labelForStatus } from "@/lib/korean-labels";
import { getControlCenterSummary } from "@/server/control-center";

export const dynamic = "force-dynamic";

type StatusKind = "ok" | "warn" | "danger" | "info" | "muted" | undefined;

function statusKind(status: string): StatusKind {
  if (["ok", "running", "completed", "process_live"].includes(status)) return "ok";
  if (["degraded", "waiting_approval", "needs_changes", "stopped", "queued"].includes(status)) return "warn";
  if (["failing", "failed", "blocked", "critical"].includes(status)) return "danger";
  if (["workflow_running", "executing"].includes(status)) return "info";
  return "muted";
}

export default async function ControlCenterPage() {
  const control = await getControlCenterSummary();
  const activeTasks = control.tasks.filter((task) => ["queued", "running", "waiting_approval", "needs_changes", "failed"].includes(task.status)).slice(0, 8);
  const criticalCount = control.highRiskApprovals.length + control.incidents.filter((incident) => incident.severity === "critical").length;

  return (
    <>
      <AutoRefresh intervalMs={8000} />
      <div className="control-shell">
        <section className="control-hero">
          <div>
            <div className="eyebrow">Control · 조작판</div>
            <h1>명령 / 자율성 / 개입 / Emergency Control</h1>
            <p>Control은 실행 조작판이다. 긴 이벤트·헬스·trace·agent 관측 상세는 Observe로 분리했다.</p>
          </div>
          <div className="control-hero-actions">
            <div className="live-pill"><span /> Live · {formatTimeKo(control.generatedAt)}</div>
            <Link href={"/decisions" as never} className="btn warn sm">결정 대기열</Link>
            <Link href={"/observe" as never} className="btn ghost sm">관측 계기판</Link>
          </div>
        </section>

        <section className="control-metrics" aria-label="Critical Summary">
          <div className={`control-metric ${criticalCount > 0 ? "alert" : ""}`}><span>Critical summary</span><strong>{criticalCount}</strong><em>high/critical gates + incidents</em></div>
          <div className="control-metric"><span>Active orchestration</span><strong>{control.summary.activeTasks}</strong><em>queue {control.summary.queueDepth}</em></div>
          <div className="control-metric alert"><span>Human decisions</span><strong>{control.autonomyDashboard.pendingHumanDecisions}</strong><em><Link href={"/decisions" as never}>open queue</Link></em></div>
          <div className="control-metric"><span>Interventions</span><strong>{control.autonomyDashboard.openInterventions}</strong><em>queued/running commands</em></div>
        </section>

        {control.highRiskApprovals.length > 0 && (
          <section className="control-critical">
            <div>
              <div className="eyebrow danger">Emergency control · high-risk gate</div>
              <strong>{control.highRiskApprovals[0].title}</strong>
              <p>{control.highRiskApprovals[0].summary}</p>
            </div>
            <Link href={"/decisions" as never} className="btn danger">결정 대기열에서 처리</Link>
          </section>
        )}

        <section className="control-command-bar" aria-label="Global Command Bar">
          <GlobalCommandBar agentSlugs={control.agents.map((agent) => agent.slug)} />
        </section>

        <section className="control-grid" aria-label="Control workbench">
          <div className="card control-span-8" id="autonomy">
            <div className="card-head"><div className="title">Autonomy Dashboard</div><div className="sub">· Governor decisions · parent/child state · verifier gate</div><div className="right"><span className="tag">canonical DB</span></div></div>
            <div className="card-body autonomy-dashboard">
              <div className="control-metrics compact autonomy-metric-grid">
                <div className="control-metric autonomy-metric"><span>Decisions</span><strong>{control.autonomyDashboard.decisions24h}</strong><em>latest window</em></div>
                <div className="control-metric autonomy-metric"><span>Auto allowed</span><strong>{control.autonomyDashboard.allowAuto24h}</strong><em>L3/L4 internal</em></div>
                <div className="control-metric autonomy-metric alert"><span>Gated</span><strong>{control.autonomyDashboard.gated24h}</strong><em>approval/manual/block</em></div>
                <div className="control-metric autonomy-metric"><span>Waiting children</span><strong>{control.autonomyDashboard.waitingChildren}</strong><em>delegated parents</em></div>
              </div>
              <div className="autonomy-levels autonomy-level-rail">
                {control.autonomyDashboard.levels.map((level) => <span key={level.level} className="tag autonomy-level-chip">{level.level} · {level.label}</span>)}
              </div>
            </div>
          </div>

          <div className="card control-span-4" id="intervention">
            <div className="card-head"><div className="title">Live Intervention Panel</div><div className="sub">· agent 개입은 Control에서만</div></div>
            <div className="card-body">
              <LiveInterventionPanel agents={control.agents.map((agent) => ({ id: agent.id, name: agent.name, slug: agent.slug, status: agent.status, currentTask: agent.currentTask }))} />
            </div>
          </div>

          <div className="card control-span-7" id="orchestration">
            <div className="card-head"><div className="title">Active Orchestrations</div><div className="sub">· parent / child / aggregation work only</div><div className="right"><Link href={"/observe" as never} className="btn ghost sm">상세 관측</Link></div></div>
            <div className="card-body flush control-table-wrap">
              <table className="tbl control-table">
                <thead><tr><th>Task</th><th>State</th><th>Agent</th><th>Risk</th><th>Next</th></tr></thead>
                <tbody>
                  {activeTasks.map((task) => (
                    <tr key={task.id}>
                      <td><Link href={`/tasks/${task.id}` as never} className="strong-link">{task.title}</Link><div className="tiny">{task.projectName}</div></td>
                      <td><StatusBadge label={labelForStatus(task.status)} kind={statusKind(task.status)} /></td>
                      <td>{task.agentName}</td>
                      <td><RiskBadge risk={task.riskLevel} /></td>
                      <td className="truncate-cell">{task.nextAction ?? task.blocker ?? "대기"}</td>
                    </tr>
                  ))}
                  {activeTasks.length === 0 && <tr><td colSpan={5} className="empty">활성 orchestration 없음</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card control-span-5" id="agent-drawer">
            <div className="card-head"><div className="title">Agent Control Drawer</div><div className="sub">· compact status + intervention target</div><div className="right"><Link href={"/observe/agents" as never} className="btn ghost sm">agent 관측</Link></div></div>
            <div className="card-body control-approval-list">
              {control.agents.slice(0, 7).map((agent) => (
                <div key={agent.id} className="approval-row agent-drawer-row">
                  <div className="agent-drawer-main"><strong>{agent.name}</strong><span>{agent.slug} · {agent.currentTask ?? "현재 작업 없음"}</span></div>
                  <div className="agent-drawer-status"><StatusBadge label={labelForStatus(agent.runtimeLabel)} kind={statusKind(agent.runtime)} /></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
