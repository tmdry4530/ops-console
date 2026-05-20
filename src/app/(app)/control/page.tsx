import type { Route } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { ApprovalActions } from "@/components/approval-actions";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
import { CommandCompilerBar } from "@/components/command-compiler-bar";
import { formatDateTimeKo, formatTimeKo, labelForHealth, labelForRisk, labelForStatus } from "@/lib/korean-labels";
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

function eventKind(severity: string): StatusKind {
  if (severity === "critical") return "danger";
  if (severity === "warning") return "warn";
  return "info";
}

function scopeKind(state: string): StatusKind {
  if (state === "active") return "ok";
  return "muted";
}

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

export default async function ControlCenterPage() {
  const control = await getControlCenterSummary();
  const topTasks = control.tasks.filter((task) => ["queued", "running", "waiting_approval", "needs_changes", "failed"].includes(task.status)).slice(0, 12);
  const costRows = control.costRows.filter((row) => row.costToday > 0 || row.tokensToday > 0 || row.latencyMs !== null).slice(0, 8);

  return (
    <>
      <AutoRefresh intervalMs={8000} />
      <div className="control-shell">
        <section className="control-hero">
          <div>
            <div className="eyebrow">Local Agent Control Center · Ops Console DB canonical</div>
            <h1>로컬 에이전트 관제센터</h1>
            <p>Company/Auth/Crypto/Alpha/X-CDP 경계를 분리해서 agent, task, approval, health, trace를 읽기 전용으로 본다.</p>
          </div>
          <div className="control-hero-actions">
            <div className="live-pill"><span /> Live · {formatTimeKo(control.generatedAt)}</div>
            <Link href="/approvals" className="btn warn sm">승인 콘솔</Link>
            <Link href="/events" className="btn ghost sm">이벤트 원장</Link>
          </div>
        </section>

        {control.highRiskApprovals.length > 0 && (
          <section className="control-critical">
            <div>
              <div className="eyebrow danger">High-risk approval gate</div>
              <strong>{control.highRiskApprovals[0].title}</strong>
              <p>{control.highRiskApprovals[0].summary}</p>
            </div>
            <Link href={`/approvals/${control.highRiskApprovals[0].id}` as Route} className="btn danger">강한 확인 필요</Link>
          </section>
        )}

        <section className="control-command-bar" aria-label="Global Command Bar">
          <div>
            <span className="eyebrow">Global Command Bar</span>
            <strong>/route /run /approve /pause agent</strong>
          </div>
          <CommandCompilerBar />
          <div className="control-command-tags">
            <span>Kiro-style executor</span>
            <span>RBAC write-gated</span>
            <span>approval gated</span>
          </div>
        </section>

        <section className="control-metrics" aria-label="Observability Strip">
          <div className="control-metric"><span>Observability Strip</span><strong>{control.summary.running}/{control.summary.agents}</strong><em>agents live/total</em></div>
          <div className="control-metric"><span>Queue</span><strong>{control.summary.activeTasks}</strong><em>active · queue {control.summary.queueDepth}</em></div>
          <div className="control-metric alert"><span>Approval</span><strong>{control.summary.openApprovals}</strong><em>high risk {control.summary.highRiskApprovals}</em></div>
          <div className="control-metric"><span>Incidents</span><strong>{control.summary.incidents}</strong><em>cron/auth/worker watched</em></div>
          <div className="control-metric"><span>Cost/token</span><strong>{money(control.summary.totalCostToday)}</strong><em>avg latency {control.summary.averageLatencyMs}ms</em></div>
          <div className="control-metric"><span>Artifacts</span><strong>{control.summary.artifacts}</strong><em>restricted {control.summary.restrictedArtifacts}</em></div>
        </section>

        <section className="card" aria-label="Company-native system monitor">
          <div className="card-head">
            <div className="title">Company-native Monitor / Manage</div>
            <div className="sub">· Netdata · LangSmith · Windmill · Google Status 패턴을 우리 구조에 맞게 적용</div>
            <div className="right"><span className="tag">Hermes Workspace retired</span></div>
          </div>
          <div className="card-body flush control-table-wrap">
            <table className="tbl control-table">
              <thead><tr><th>System</th><th>Scope</th><th>State</th><th>Route</th><th>Reference pattern</th><th>Risk gate</th><th>Operator action</th></tr></thead>
              <tbody>
                {control.localSystems.systems.map((system) => (
                  <tr key={system.slug}>
                    <td><strong>{system.name}</strong><div className="mono tiny">{system.slug}</div></td>
                    <td><StatusBadge label={system.scope} kind={system.scope === "Company" ? "ok" : "muted"} /></td>
                    <td><StatusBadge label={system.state} kind={statusKind(system.state)} /></td>
                    <td className="mono tiny">{system.route}</td>
                    <td className="truncate-cell">{system.referencePattern}</td>
                    <td className="truncate-cell">{system.riskGate}</td>
                    <td className="truncate-cell">{system.operatorAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="control-console-frame" aria-label="Reference-driven console frame">
          <aside className="control-route-rail">
            <span className="eyebrow">Agent / Route sidebar</span>
            <a href="#agents">Agent Registry Table</a>
            <a href="#sessions">Session / Run Timeline</a>
            <a href="#approvals">Approval Queue</a>
            <a href="#events">LaunchDarkly-style traces</a>
            <div className="reference-chip">FloQast-style roster</div>
            <div className="reference-chip">OpenSea-style dense grid</div>
          </aside>

          <div className="control-session-list" id="sessions">
            <div className="card-head"><div className="title">Session / Run Timeline</div><div className="sub">· central Kiro-style run list</div></div>
            {topTasks.slice(0, 5).map((task) => (
              <Link key={task.id} href={`/tasks/${task.id}` as Route} className="session-row">
                <span className={`session-dot ${task.status}`} />
                <div><strong>{task.title}</strong><em>{task.agentName} · {task.projectName} · {task.traceId.slice(0, 10)}</em></div>
                <StatusBadge label={labelForStatus(task.status)} kind={statusKind(task.status)} />
              </Link>
            ))}
            {topTasks.length === 0 && <div className="empty">실행 중인 session 없음</div>}
          </div>

          <aside className="control-inspector">
            <div className="card-head"><div className="title">Right Inspector</div><div className="sub">· Selected run · tool/model/artifact/verification</div></div>
            <div className="inspector-stack">
              <div><span>Selected run</span><strong>{topTasks[0]?.title ?? "선택된 run 없음"}</strong></div>
              <div><span>Model</span><strong>{control.agents[0]?.model ?? "unknown"}</strong></div>
              <div><span>Trace</span><strong>{topTasks[0]?.traceId.slice(0, 12) ?? "—"}</strong></div>
              <div><span>Verification</span><strong>tests · smoke · visual QA</strong></div>
            </div>
          </aside>
        </section>

        <section className="control-grid">
          <div className="card control-span-8" id="agents">
            <div className="card-head">
              <div className="title">Agent Registry Table</div>
              <div className="sub">· model/cost/risk/current task · FloQast-style roster</div>
              <div className="right"><span className="tag">read-only</span></div>
            </div>
            <div className="card-body flush control-table-wrap">
              <table className="tbl control-table">
                <thead>
                  <tr>
                    <th>Agent</th><th>Scope</th><th>State</th><th>Current task</th><th>Heartbeat</th><th>Model</th><th>Cost</th><th>Risk</th><th>Queue</th>
                  </tr>
                </thead>
                <tbody>
                  {control.agents.map((agent) => (
                    <tr key={agent.id} className={agent.expectedStopped ? "is-neutral" : ""}>
                      <td><Link href={`/agents/${agent.id}` as Route} className="strong-link">{agent.name}</Link><div className="mono tiny">{agent.slug}</div></td>
                      <td><StatusBadge label={agent.scope} kind={agent.scope === "Company" ? "ok" : "muted"} /></td>
                      <td><StatusBadge label={agent.expectedStopped ? "정상 중지" : labelForStatus(agent.runtimeLabel)} kind={statusKind(agent.runtime)} /></td>
                      <td className="truncate-cell">{agent.currentTask ?? "현재 작업 없음"}</td>
                      <td>{formatTimeKo(agent.heartbeatAt)}</td>
                      <td className="mono tiny">{agent.model}</td>
                      <td className="mono tiny">{money(agent.costToday)}</td>
                      <td><RiskBadge risk={agent.risk} /></td>
                      <td className="mono tiny">{agent.queueDepth}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card control-span-4">
            <div className="card-head"><div className="title">Health matrix</div><div className="sub">· deep/cron/auth/worker</div></div>
            <div className="card-body control-health-list">
              {control.healthRows.slice(0, 12).map((row) => (
                <div key={`${row.scope}-${row.name}`} className="health-row">
                  <div><strong>{row.name}</strong><span>{row.scope} · {row.note}</span></div>
                  <div className="health-cells" aria-label={`${row.name} health`}>
                    {Array.from({ length: 5 }, (_, index) => <i key={index} className={`cell ${row.status}`} />)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card control-span-7">
            <div className="card-head"><div className="title">Task board · state machine</div><div className="sub">· queued → running → approval → completed/failed</div></div>
            <div className="card-body flush control-table-wrap">
              <table className="tbl control-table">
                <thead><tr><th>Task</th><th>State</th><th>Agent</th><th>Risk</th><th>Trace</th><th>Next</th></tr></thead>
                <tbody>
                  {topTasks.map((task) => (
                    <tr key={task.id}>
                      <td><Link href={`/tasks/${task.id}` as Route} className="strong-link">{task.title}</Link><div className="tiny">{task.projectName}</div></td>
                      <td><StatusBadge label={labelForStatus(task.status)} kind={statusKind(task.status)} /></td>
                      <td>{task.agentName}</td>
                      <td><RiskBadge risk={task.riskLevel} /></td>
                      <td className="mono tiny">{task.traceId.slice(0, 10)}</td>
                      <td className="truncate-cell">{task.nextAction ?? task.blocker ?? "대기"}</td>
                    </tr>
                  ))}
                  {topTasks.length === 0 && <tr><td colSpan={6} className="empty">활성 작업 없음</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card control-span-5" id="approvals">
            <div className="card-head"><div className="title">Approval console</div><div className="sub">· high-risk pinned</div><div className="right"><Link href="/approvals" className="btn ghost sm">전체</Link></div></div>
            <div className="card-body control-approval-list">
              {control.approvals.slice(0, 8).map((approval) => (
                <div key={approval.id} className={`approval-row action-row risk-${approval.riskLevel}`}>
                  <Link href={`/approvals/${approval.id}` as Route} className="approval-main-link">
                    <RiskBadge risk={approval.riskLevel} />
                    <div><strong>{approval.title}</strong><span>{approval.scope} · secret check: {approval.secretExposureCheck}</span></div>
                    <StatusBadge label={labelForStatus(approval.status)} kind={statusKind(approval.status)} />
                  </Link>
                  {approval.status === "pending" && (
                    <ApprovalActions approvalId={approval.id} status={approval.status} manualReportId={null} variant="compact" riskLevel={approval.riskLevel} />
                  )}
                </div>
              ))}
              {control.approvals.length === 0 && <div className="empty">승인 대기 없음</div>}
            </div>
          </div>

          <div className="card control-span-4">
            <div className="card-head"><div className="title">Scope boundary</div><div className="sub">· 섞지 않음</div></div>
            <div className="card-body control-boundaries">
              {control.scopeBoundaries.map((boundary) => (
                <div key={boundary.scope} className="boundary-row">
                  <StatusBadge label={boundary.scope} kind={scopeKind(boundary.state)} />
                  <span>{boundary.rule}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card control-span-4">
            <div className="card-head"><div className="title">Trace preview</div><div className="sub">· run/step/tool/model/artifact</div></div>
            <div className="card-body trace-list">
              {control.traces.slice(0, 8).map((trace) => (
                <div key={trace.id} className="trace-row">
                  <span className={`trace-dot ${trace.status}`} />
                  <div><strong>{trace.kind}</strong><span>{trace.title}</span><em><Link href={`/traces/${trace.traceId}` as Route}>{formatTimeKo(trace.at)} · {trace.traceId.slice(0, 10)}</Link></em></div>
                </div>
              ))}
              {control.traces.length === 0 && <div className="empty">trace event 없음</div>}
            </div>
          </div>

          <div className="card control-span-4">
            <div className="card-head"><div className="title">Incident center</div><div className="sub">· worker stopped 정상 처리</div></div>
            <div className="card-body incident-list">
              {control.incidents.slice(0, 8).map((incident) => (
                <div key={incident.id} className={`incident-row ${incident.severity}`}>
                  <strong>{incident.title}</strong>
                  <span>{incident.state} · {incident.affectedScope.join(" / ") || "scope unknown"}</span>
                  <em>{formatDateTimeKo(incident.updatedAt)} · {incident.traceId.slice(0, 10)}</em>
                </div>
              ))}
              {control.incidents.length === 0 && <div className="empty">열린 incident 없음 · worker gateway stopped는 정상</div>}
            </div>
          </div>

          <div className="card control-span-8" id="events">
            <div className="card-head"><div className="title">Event stream</div><div className="sub">· latest 60 · secret-safe metadata</div></div>
            <div className="card-body flush control-table-wrap">
              <table className="tbl control-table">
                <thead><tr><th>Time</th><th>Source</th><th>Severity</th><th>Summary</th><th>Trace</th></tr></thead>
                <tbody>
                  {control.events.slice(0, 16).map((event) => (
                    <tr key={event.id}>
                      <td className="mono tiny">{formatTimeKo(event.createdAt)}</td>
                      <td>{event.source}</td>
                      <td><StatusBadge label={labelForStatus(event.severity)} kind={eventKind(event.severity)} /></td>
                      <td className="truncate-cell">{event.message}</td>
                      <td className="mono tiny">{event.traceId.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card control-span-4">
            <div className="card-head"><div className="title">Cost/latency/token</div><div className="sub">· P1 dashboard seed</div></div>
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
        </section>
      </div>
    </>
  );
}
