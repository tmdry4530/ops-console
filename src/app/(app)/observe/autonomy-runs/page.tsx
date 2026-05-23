import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { StatusBadge } from "@/components/status-badge";
import { getAutonomyRuns } from "@/server/autonomous-company-mode-store";

export const dynamic = "force-dynamic";

export default async function AutonomyRunsPage() {
  const runs = await getAutonomyRuns();
  const gated = runs.filter((run: any) => ["waiting_approval", "blocked"].includes(run.status) || ["require_owner_approval", "block", "require_manual_handoff"].includes(run.decision));
  return (
    <div className="control-shell">
      <AutoRefresh intervalMs={10000} />
      <section className="control-hero">
        <div>
          <div className="eyebrow">Observe · 자율 실행 감사</div>
          <h1>자율 실행 기록</h1>
          <p>트리거부터 정책 판단, protocol gate, 위임, verifier, trace/event/artifact/verification linkage까지 read-only로 확인한다.</p>
        </div>
        <Link href={"/control/autonomy" as never} className="btn ghost sm">Control 자율성</Link>
      </section>
      <section className="control-metrics">
        <div className="control-metric"><span>Runs</span><strong>{runs.length}</strong><em>latest</em></div>
        <div className="control-metric"><span>완료</span><strong>{runs.filter((r: any) => r.status === "completed").length}</strong><em>verified only</em></div>
        <div className="control-metric alert"><span>Exception gates</span><strong>{gated.length}</strong><em>owner/hq/manual/block</em></div>
      </section>
      <section className="control-grid">
        <div className="card control-span-12">
          <div className="card-head"><div className="title">Action Audit Timeline</div><div className="sub">· immutable linkage expectation</div></div>
          <div className="card-body control-approval-list">
            {runs.map((run: any) => (
              <div className="approval-row" key={run.id}>
                <div>
                  <strong>{run.runType}</strong>
                  <span>{run.primaryAgent} · decision {run.decision} · status {run.status}</span>
                  <div className="tiny">trace {run.traceId} · artifacts {(run.artifactIds ?? []).length} · verifications {(run.verificationIds ?? []).length} · events {(run.eventIds ?? []).length}</div>
                  <div className="tiny">after-action report required before completed for protocol-gated work</div>
                </div>
                <StatusBadge label={run.status} kind={run.status === "blocked" ? "danger" : run.status === "completed" ? "ok" : "info"} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
