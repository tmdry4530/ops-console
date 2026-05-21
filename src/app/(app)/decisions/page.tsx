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
            <div className="eyebrow">Decisions · 결재함</div>
            <h1>사람 결정 대기열</h1>
            <p>approval, request changes, manual submit, rollback approval, one-time exception을 하나의 운영자 결정 큐로 본다. Discord approval은 금지다.</p>
          </div>
          <div className="control-hero-actions">
            <div className="live-pill"><span /> Pending · {pending.length}</div>
            <Link href="/control" className="btn ghost sm">Control로 복귀</Link>
          </div>
        </section>

        <section className="control-metrics" aria-label="Decision Summary">
          <div className="control-metric alert"><span>Pending decisions</span><strong>{pending.length}</strong><em>operator action required</em></div>
          <div className="control-metric alert"><span>High/Critical</span><strong>{highRisk.length}</strong><em>no auto-execution</em></div>
          <div className="control-metric"><span>Manual submit</span><strong>{pending.filter((d) => d.status === "manual_handoff" || d.status === "approved_waiting_execution").length}</strong><em>external proof only</em></div>
          <div className="control-metric"><span>Needs changes</span><strong>{pending.filter((d) => d.status === "needs_changes").length}</strong><em>request changes lane</em></div>
        </section>

        <section className="card">
          <div className="card-head"><div className="title">Decision Queue</div><div className="sub">· actionable first · completed hidden by default</div></div>
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
            {pending.length === 0 && <div className="empty">현재 사람이 결정할 항목 없음 · completed 항목은 기본 숨김</div>}
          </div>
        </section>
      </div>
    </>
  );
}
