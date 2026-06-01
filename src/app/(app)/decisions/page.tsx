import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { ApprovalActions } from "@/components/approval-actions";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTimeKo, labelForStatus } from "@/lib/korean-labels";
import { getControlCenterSummary } from "@/server/control-center";

export const dynamic = "force-dynamic";

type StatusKind = "ok" | "warn" | "danger" | "info" | "muted" | undefined;

function statusKind(status: string): StatusKind {
  if (["approved", "completed"].includes(status)) return "ok";
  if (["pending", "approved_waiting_execution", "executing", "needs_changes", "manual_handoff"].includes(status)) return "warn";
  if (["rejected", "failed", "blocked"].includes(status)) return "danger";
  return "muted";
}

function decisionKind(type: string, status: string) {
  const text = `${type} ${status}`.toLowerCase();
  if (text.includes("rollback")) return "rollback approval";
  if (text.includes("manual") || text.includes("handoff")) return "manual submit";
  if (text.includes("exception")) return "one-time exception";
  if (text.includes("needs_changes")) return "request changes";
  return "approval";
}

export default async function DecisionsPage() {
  const control = await getControlCenterSummary();
  const decisions = control.approvals;
  const pending = decisions.filter((decision) => ["pending", "needs_changes", "manual_handoff", "approved_waiting_execution", "executing"].includes(decision.status));
  const highRisk = pending.filter((decision) => decision.riskLevel === "high" || decision.riskLevel === "critical");

  return (
    <>
      <AutoRefresh intervalMs={10000} />
      <div className="control-shell">
        <section className="control-hero">
          <div>
            <div className="eyebrow">Hard Gates · 권한 경계</div>
            <h1>하드게이트 큐</h1>
            <p>역할 안 low/medium 작업은 자동 승인한다. 역할 밖 권한은 권한 보유 에이전트에게 위임하고, 이 화면은 high/critical·외부발송·실거래·결제·비밀·배포 같은 하드게이트만 다룬다.</p>
          </div>
          <div className="control-hero-actions">
            <div className="live-pill"><span /> Pending · {pending.length}</div>
            <Link href="/control" className="btn ghost sm">Control로 복귀</Link>
          </div>
        </section>

        <section className="control-metrics" aria-label="Decision Summary">
          <div className={`control-metric ${pending.length > 0 ? "alert" : ""}`}><span>Hard gates</span><strong>{pending.length}</strong><em>operator action only when gated</em></div>
          <div className="control-metric alert"><span>High/Critical</span><strong>{highRisk.length}</strong><em>no auto-execution</em></div>
          <div className="control-metric"><span>Manual handoff</span><strong>{pending.filter((d) => d.status === "manual_handoff" || d.status === "approved_waiting_execution").length}</strong><em>external proof only</em></div>
          <div className="control-metric"><span>Needs changes</span><strong>{pending.filter((d) => d.status === "needs_changes").length}</strong><em>request changes lane</em></div>
        </section>

        <section className="card">
          <div className="card-head"><div className="title">Hard Gate Queue</div><div className="sub">· authority delegation first · completed hidden by default</div></div>
          <div className="card-body control-approval-list">
            {pending.map((decision) => (
              <div key={decision.id} className={`approval-row action-row risk-${decision.riskLevel}`}>
                <div className="approval-main-link">
                  <RiskBadge risk={decision.riskLevel} />
                  <div>
                    <strong>{decision.title}</strong>
                    <span>{decisionKind(decision.type, decision.status)} · {decision.scope} · {formatDateTimeKo(decision.updatedAt)}</span>
                  </div>
                  <StatusBadge label={labelForStatus(decision.status)} kind={statusKind(decision.status)} />
                </div>
                <div className="ops-list">
                  <div><span>summary</span><strong>{decision.summary}</strong></div>
                  <div><span>trace</span><strong>{decision.traceId.slice(0, 16)}</strong></div>
                  {decision.taskId && <div><span>task</span><Link href={`/tasks/${decision.taskId}` as never}>execution receipt</Link></div>}
                  <div><span>secret check</span><strong>{decision.secretExposureCheck}</strong></div>
                </div>
                <ApprovalActions approvalId={decision.id} status={decision.status} manualReportId={null} variant="full" riskLevel={decision.riskLevel} />
              </div>
            ))}
            {pending.length === 0 && <div className="empty">현재 하드게이트 항목 없음 · 역할 내 작업은 자동 승인, 역할 밖 권한은 에이전트 위임</div>}
          </div>
        </section>
      </div>
    </>
  );
}
