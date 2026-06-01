import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
import { GlobalCommandBar } from "@/components/global-command-bar";
import { LiveInterventionPanel } from "@/components/live-intervention-panel";
import { formatTimeKo, labelForStatus, labelForTaskOperationalStatus, taskChildProgressLabel } from "@/lib/korean-labels";
import { getControlCenterSummary } from "@/server/control-center";
import { AGENT_ORGANIZATION_POLICY, ALLOWED_AUTONOMOUS_WORK, BLOCKED_AUTONOMOUS_ACTIONS } from "@/server/agent-organization-policy";

export const dynamic = "force-dynamic";

type StatusKind = "ok" | "warn" | "danger" | "info" | "muted" | undefined;

function statusKind(status: string): StatusKind {
  if (["ok", "running", "completed", "process_live"].includes(status)) return "ok";
  if (["degraded", "waiting_approval", "needs_changes", "stopped", "queued"].includes(status)) return "warn";
  if (["failing", "failed", "blocked", "critical"].includes(status)) return "danger";
  if (["workflow_running", "executing"].includes(status)) return "info";
  return "muted";
}

export default async function ControlCenterPage({ searchParams }: { searchParams?: Promise<{ agent?: string }> } = {}) {
  const [{ agent: selectedAgentSlug } = {}, control] = await Promise.all([searchParams, getControlCenterSummary()]);
  const activeTasks = control.tasks.filter((task) => ["queued", "running", "waiting_approval", "needs_changes", "failed"].includes(task.status)).slice(0, 8);
  const criticalCount = control.highRiskApprovals.length + control.incidents.filter((incident) => incident.severity === "critical").length;
  const drawerAgents = selectedAgentSlug ? control.agents.filter((agent) => agent.slug === selectedAgentSlug).concat(control.agents.filter((agent) => agent.slug !== selectedAgentSlug)).slice(0, 7) : control.agents.slice(0, 7);
  const interfaceAgents = AGENT_ORGANIZATION_POLICY.filter((agent) => agent.role === "interface");
  const parentAgent = AGENT_ORGANIZATION_POLICY.find((agent) => agent.role === "company-parent");
  const controlAgents = AGENT_ORGANIZATION_POLICY.filter((agent) => ["router", "risk-gate"].includes(agent.role));
  const workerAgents = AGENT_ORGANIZATION_POLICY.filter((agent) => agent.role === "worker");
  const serviceAgents = AGENT_ORGANIZATION_POLICY.filter((agent) => agent.role === "service-project");
  const providerAgents = AGENT_ORGANIZATION_POLICY.filter((agent) => agent.role === "capability-provider");

  return (
    <>
      <AutoRefresh intervalMs={8000} />
      <div className="control-shell">
        <section className="control-hero">
          <div>
            <div className="eyebrow">실행 조작판</div>
            <h1>지시 / 권한위임 / 하드게이트</h1>
            <p>Control은 실행 조작판이다. 역할 안 low/medium 작업은 자동 승인하고, 역할 밖 권한은 사람 대기열 대신 권한 보유 에이전트에게 위임한다.</p>
          </div>
          <div className="control-hero-actions">
            <div className="live-pill"><span /> Live · {formatTimeKo(control.generatedAt)}</div>
            <Link href={"/decisions" as never} className="btn warn sm">하드게이트 큐</Link>
            <Link href={"/observe" as never} className="btn ghost sm">관측 계기판</Link>
          </div>
        </section>

        <section className="control-metrics" aria-label="Critical Summary">
          <div className={`control-metric ${criticalCount > 0 ? "alert" : ""}`}><span>긴급 확인</span><strong>{criticalCount}</strong><em>고위험 승인 + 장애</em></div>
          <div className="control-metric"><span>진행 중 작업</span><strong>{control.summary.activeTasks}</strong><em>queue {control.summary.queueDepth}</em></div>
          <div className={`control-metric ${control.autonomyDashboard.pendingHumanDecisions > 0 ? "alert" : ""}`}><span>하드게이트 대기</span><strong>{control.autonomyDashboard.pendingHumanDecisions}</strong><em><Link href={"/decisions" as never}>hard gates only</Link></em></div>
          <div className="control-metric"><span>개입 명령</span><strong>{control.autonomyDashboard.openInterventions}</strong><em>queued/running commands</em></div>
        </section>

        <section className="card agent-org-panel" aria-label="Agent organization hierarchy">
          <div className="card-head"><div className="title">현재 에이전트 조직</div><div className="sub">· Company single-parent · interface/provider 분리 · Crypto Signal hard-gated</div><div className="right"><span className="tag">policy synced</span></div></div>
          <div className="card-body agent-org-body">
            <div className="agent-org-node interface-only">
              <span>Interface only</span>
              <strong>{interfaceAgents.map((agent) => agent.displayName).join(" / ")}</strong>
              <em>입력·알림 surface, 작업 ownership 없음</em>
            </div>
            <div className="agent-org-arrow">↓</div>
            <div className="agent-org-node parent">
              <span>Single parent</span>
              <strong>{parentAgent?.displayName ?? "Company Agent"}</strong>
              <em>모든 task/event/artifact/verification/trace의 운영 기준</em>
            </div>
            <div className="agent-org-groups">
              <div className="agent-org-group">
                <span>Control</span>
                {controlAgents.map((agent) => <strong key={agent.slug}>{agent.displayName}<em>{agent.role === "router" ? "router/delegator/aggregator" : "strategy/risk/approval gate"}</em></strong>)}
              </div>
              <div className="agent-org-group">
                <span>Workers</span>
                <strong>{workerAgents.map((agent) => agent.displayName.replace(" Agent", "")).join(" · ")}<em>역할 안 low/medium 내부 작업 자동 승인 · 역할 밖 권한은 권한 보유 에이전트로 위임</em></strong>
              </div>
              <div className="agent-org-group warn">
                <span>Service project</span>
                {serviceAgents.map((agent) => <strong key={agent.slug}>{agent.displayName}<em>monitoring/report/handoff만 허용, trading/order/secret은 hard gate</em></strong>)}
              </div>
              <div className="agent-org-group provider">
                <span>Capability provider</span>
                {providerAgents.map((agent) => <strong key={agent.slug}>{agent.displayName}<em>일반 작업 에이전트 아님; 인증·권한·세션 boundary</em></strong>)}
              </div>
            </div>
            <div className="agent-org-policy-row">
              <div><span>Auto allowed</span><strong>{ALLOWED_AUTONOMOUS_WORK.length}</strong><em>existing-service maintenance/docs/eval/linkage</em></div>
              <div><span>Hard-gated</span><strong>{BLOCKED_AUTONOMOUS_ACTIONS.length}</strong><em>new service · external send · trading · secrets · high/critical</em></div>
            </div>
          </div>
        </section>

        {control.highRiskApprovals.length > 0 && (
          <section className="control-critical">
            <div>
              <div className="eyebrow danger">하드게이트 확인 필요</div>
              <strong>{control.highRiskApprovals[0].title}</strong>
              <p>{control.highRiskApprovals[0].summary}</p>
            </div>
            <Link href={"/decisions" as never} className="btn danger">하드게이트 큐에서 처리</Link>
          </section>
        )}

        <section className="control-command-bar" aria-label="Global Command Bar">
          <GlobalCommandBar agentSlugs={control.agents.map((agent) => agent.slug)} />
        </section>

        <section className="control-grid" aria-label="Control workbench">
          <div className="card control-span-8" id="autonomy">
            <div className="card-head"><div className="title">자율 작업 상태</div><div className="sub">· 자동/수동 판단 · 하위작업 · 검증 게이트</div><div className="right"><span className="tag">canonical DB</span></div></div>
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
            <div className="card-head"><div className="title">즉시 지시/개입</div><div className="sub">· agent 개입은 Control에서만</div></div>
            <div className="card-body">
              <LiveInterventionPanel agents={control.agents.map((agent) => ({ id: agent.id, name: agent.name, slug: agent.slug, status: agent.status, currentTask: agent.currentTask }))} />
            </div>
          </div>

          <div className="card control-span-7" id="orchestration">
            <div className="card-head"><div className="title">진행 중 작업 큐</div><div className="sub">· parent / child / aggregation work only</div><div className="right"><Link href={"/observe" as never} className="btn ghost sm">상세 관측</Link></div></div>
            <div className="card-body flush control-table-wrap">
              <table className="tbl control-table">
                <thead><tr><th>Task</th><th>State</th><th>Agent</th><th>Risk</th><th>Next</th></tr></thead>
                <tbody>
                  {activeTasks.map((task) => (
                    <tr key={task.id}>
                      <td><Link href={`/tasks/${task.id}` as never} className="strong-link">{task.title}</Link><div className="tiny">{task.projectName}</div></td>
                      <td><StatusBadge label={labelForTaskOperationalStatus(task)} kind={statusKind(task.status)} />{taskChildProgressLabel(task) && <div className="tiny">{taskChildProgressLabel(task)}</div>}</td>
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
            <div className="card-head"><div className="title">에이전트 상태 요약</div><div className="sub">· compact status + intervention target</div><div className="right"><Link href={"/observe/agents" as never} className="btn ghost sm">agent 관측</Link></div></div>
            <div className="card-body control-approval-list">
              {drawerAgents.map((agent) => (
                <div key={agent.id} className={`approval-row agent-drawer-row ${agent.slug === selectedAgentSlug ? "selected" : ""}`}>
                  <div className="agent-drawer-main"><strong>{agent.name}</strong><span>{agent.slug} · {agent.currentTask ?? "현재 작업 없음"}</span>{agent.currentTaskId && <Link href={`/tasks/${agent.currentTaskId}` as never} className="tiny strong-link">current task receipt</Link>}<Link href={`/control?agent=${agent.slug}` as never} className="tiny strong-link">drawer deep link</Link></div>
                  <div className="agent-drawer-status"><StatusBadge label={labelForStatus(agent.runtimeLabel)} kind={statusKind(agent.runtime)} /><div className="tiny"><RiskBadge risk={agent.risk} /> · q {agent.queueDepth}</div></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
