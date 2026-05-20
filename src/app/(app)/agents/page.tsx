import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { formatTimeKo, labelForHealth, labelForStatus } from "@/lib/korean-labels";
import { getCompanyOpsMonitor, type AgentRuntimeState } from "@/server/ops-monitor";
import { getAgentPerformance } from "@/server/agent-performance";

export const dynamic = "force-dynamic";

const RUNTIME_LABELS: Record<AgentRuntimeState, string> = {
  process_live: "프로세스 실시간",
  workflow_running: "워크플로 실행",
  waiting: "승인/수동 대기",
  idle: "대기",
  failed_or_blocked: "오류/차단"
};

function runtimeKind(runtime: AgentRuntimeState) {
  return runtime === "process_live" ? "ok" : runtime === "failed_or_blocked" || runtime === "waiting" ? "warn" : undefined;
}

export default async function AgentsPage() {
  const monitor = await getCompanyOpsMonitor();
  const performance = await getAgentPerformance(30);
  const performanceBySlug = new Map<string, (typeof performance.agents)[number]>(performance.agents.map((agent) => [agent.agentSlug, agent]));
  const regressionCount = performance.agents.filter((agent) => agent.qualityBand === "regression").length;
  const watchCount = performance.agents.filter((agent) => agent.qualityBand === "watch").length;
  const avgScore = performance.agents.length === 0 ? 0 : performance.agents.reduce((sum, agent) => sum + (agent.evalScore ?? 0), 0) / performance.agents.length;

  return (
    <>
      <AutoRefresh intervalMs={7000} />
      <div className="page-head">
        <div className="titles">
          <h1>Company 에이전트</h1>
          <div className="sub">
            7초 자동 동기화 · Company 작업/모니터링 에이전트 {monitor.totals.agents}개 · live {monitor.totals.processLive} · workflow {monitor.totals.workflowRunning}
          </div>
        </div>
        <div className="actions">
          <Link href="/events" className="btn ghost sm">이벤트</Link>
          <Link href="/approvals" className="btn sm">승인</Link>
        </div>
      </div>

      <div className="grid-12" style={{ marginBottom: 20 }}>
        <div className="span-2"><MetricCard label="전체" value={String(monitor.totals.agents)} delta="agents" /></div>
        <div className="span-2"><MetricCard label="Live" value={String(monitor.totals.processLive)} delta="heartbeat" trend="up" /></div>
        <div className="span-2"><MetricCard label="Workflow" value={String(monitor.totals.workflowRunning)} delta="DB task" /></div>
        <div className="span-2"><MetricCard label="활성 작업" value={String(monitor.totals.activeTasks)} delta="active" /></div>
        <div className="span-2"><MetricCard label="게이트" value={String(monitor.totals.pendingApprovals)} alert={monitor.totals.pendingApprovals > 0} delta="approval" /></div>
        <div className="span-2"><MetricCard label="보고 대기" value={String(monitor.totals.queuedReports)} delta="outbox" /></div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <div className="title">Agent Harness 품질 대시보드</div>
          <div className="sub">· 30일 eval · rollback gate · weekly regression 대상</div>
          <div className="right"><span className="tag">평균 {(avgScore * 100).toFixed(0)}%</span></div>
        </div>
        <div className="card-body">
          <div className="grid-12">
            <div className="span-3 muted">regression: <strong style={{ color: regressionCount > 0 ? "var(--danger)" : "var(--text-0)" }}>{regressionCount}</strong></div>
            <div className="span-3 muted">watch: <strong style={{ color: watchCount > 0 ? "var(--warn)" : "var(--text-0)" }}>{watchCount}</strong></div>
            <div className="span-3 muted">eval cases: <strong style={{ color: "var(--text-0)" }}>{performance.agents.reduce((sum, agent) => sum + agent.evalCount, 0)}</strong></div>
            <div className="span-3 muted">API: <code>/api/agents/performance</code></div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
        {monitor.agents.map((item) => {
          const perf = performanceBySlug.get(item.agent.slug);
          return (
          <Link key={item.agent.id} href={`/agents/${item.agent.id}`} className="agent-card" style={{ textDecoration: "none" }}>
            <div className="head">
              <div className="avatar" style={{ background: "var(--bg-3)" }}>{item.agent.name[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="name">{item.agent.name}</div>
                <div className="role">{item.agent.slug}</div>
              </div>
              <StatusBadge label={RUNTIME_LABELS[item.runtime.runtime]} kind={runtimeKind(item.runtime.runtime)} />
            </div>

            <div className="muted" style={{ fontSize: 12, minHeight: 36, lineHeight: 1.45 }}>
              {item.activeTasks[0]?.title ?? item.agent.currentTask ?? "현재 작업 없음"}
            </div>

            <div className="heartbeat" title={item.runtime.heartbeat}>
              {Array.from({ length: 24 }, (_, i) => {
                const isOn = item.runtime.runtime === "process_live" || (item.runtime.runtime === "workflow_running" && i < 10);
                const warn = item.runtime.runtime === "waiting" || item.runtime.runtime === "failed_or_blocked";
                return <span key={i} className={warn && i >= 16 ? "warn-bar" : isOn && i < 18 ? "on" : ""} style={{ height: isOn && i < 18 ? "78%" : "34%" }} />;
              })}
            </div>

            <div className="between" style={{ fontSize: 11.5, color: "var(--text-3)", gap: 8 }}>
              <span>상태: {labelForStatus(item.agent.status)}</span>
              <span>health: {labelForHealth(item.agent.health)}</span>
            </div>
            <div className="between" style={{ fontSize: 11.5, color: "var(--text-3)", gap: 8, marginTop: 6 }}>
              <span>최근 보고: {formatTimeKo(item.agent.heartbeatAt)}</span>
              <span>조치: {item.runtime.operatorAction}</span>
            </div>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
              queued {item.taskCounts.queued} · running {item.taskCounts.running} · wait {item.taskCounts.waiting_approval} · failed {item.taskCounts.failed}
            </div>
            {perf ? (
              <div className="muted" style={{ fontSize: 11.5, marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                harness {perf.harnessVersion} · quality <strong style={{ color: perf.qualityBand === "regression" ? "var(--danger)" : perf.qualityBand === "watch" ? "var(--warn)" : "var(--text-0)" }}>{perf.qualityBand}</strong> · eval {perf.evalCount} · pass {perf.evalPassRate == null ? "n/a" : `${Math.round(perf.evalPassRate * 100)}%`}
                {perf.rollback.required ? <div style={{ color: "var(--danger)", marginTop: 4 }}>rollback 필요 → {perf.rollback.targetVersion}</div> : null}
              </div>
            ) : null}
          </Link>
          );
        })}
      </div>
    </>
  );
}
