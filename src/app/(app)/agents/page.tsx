import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { formatTimeKo, labelForHealth, labelForStatus } from "@/lib/korean-labels";
import { getCompanyOpsMonitor, type AgentRuntimeState } from "@/server/ops-monitor";

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

  return (
    <>
      <AutoRefresh intervalMs={7000} />
      <div className="page-head">
        <div className="titles">
          <h1>Company 에이전트 관제센터</h1>
          <div className="sub">
            7초 자동 동기화 · Company 작업/모니터링 에이전트 {monitor.totals.agents}개 · 실시간 프로세스 {monitor.totals.processLive} · 워크플로 실행 {monitor.totals.workflowRunning}
          </div>
        </div>
        <div className="actions">
          <Link href="/events" className="btn ghost sm">이벤트 스트림</Link>
          <Link href="/approvals" className="btn sm">승인/게이트</Link>
        </div>
      </div>

      <div className="grid-12" style={{ marginBottom: 20 }}>
        <div className="span-2"><MetricCard label="전체" value={String(monitor.totals.agents)} delta="관리 대상" /></div>
        <div className="span-2"><MetricCard label="프로세스 live" value={String(monitor.totals.processLive)} delta="heartbeat 기반" trend="up" /></div>
        <div className="span-2"><MetricCard label="워크플로 실행" value={String(monitor.totals.workflowRunning)} delta="DB task 기반" /></div>
        <div className="span-2"><MetricCard label="활성 작업" value={String(monitor.totals.activeTasks)} delta="queued/running/waiting" /></div>
        <div className="span-2"><MetricCard label="게이트" value={String(monitor.totals.pendingApprovals)} alert={monitor.totals.pendingApprovals > 0} delta="승인/수동" /></div>
        <div className="span-2"><MetricCard label="보고 대기" value={String(monitor.totals.queuedReports)} delta="Discord outbox" /></div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="title">실시간 에이전트 운영 테이블</div>
          <div className="sub">· 상태/작업/heartbeat/산출물/다음 조치</div>
        </div>
        <div className="card-body flush">
          <table className="tbl">
            <thead>
              <tr>
                <th>에이전트</th>
                <th>런타임</th>
                <th>상태</th>
                <th>활성 작업</th>
                <th>최근 보고</th>
                <th>다음 조치</th>
              </tr>
            </thead>
            <tbody>
              {monitor.agents.map((item) => (
                <tr key={item.agent.id}>
                  <td>
                    <Link href={`/agents/${item.agent.id}`} style={{ fontWeight: 600, color: "var(--text-0)" }}>{item.agent.name}</Link>
                    <div className="muted" style={{ fontSize: 11.5 }}>{item.agent.slug}</div>
                  </td>
                  <td><StatusBadge label={RUNTIME_LABELS[item.runtime.runtime]} kind={runtimeKind(item.runtime.runtime)} /></td>
                  <td>
                    <StatusBadge label={labelForStatus(item.agent.status)} />
                    <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>health: {labelForHealth(item.agent.health)}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{item.activeTasks[0]?.title ?? item.agent.currentTask ?? "현재 작업 없음"}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>
                      queued {item.taskCounts.queued} · running {item.taskCounts.running} · wait {item.taskCounts.waiting_approval} · failed {item.taskCounts.failed}
                    </div>
                  </td>
                  <td>
                    <div>{formatTimeKo(item.agent.heartbeatAt)}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>{item.runtime.heartbeat}</div>
                  </td>
                  <td>{item.runtime.operatorAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
