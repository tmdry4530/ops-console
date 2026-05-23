import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { RiskBadge } from "@/components/risk-badge";
import { formatTimeKo } from "@/lib/korean-labels";
import { getAutonomyControlSummary } from "@/server/autonomous-company-mode-store";

export const dynamic = "force-dynamic";

export default async function AutonomyControlPage() {
  const autonomy = await getAutonomyControlSummary();
  const fullAuthority = autonomy.fullAuthorityPolicy;
  const fullAuthorityActive = autonomy.authorityMode === "enabled_full_authority_within_constitution";

  return (
    <>
      <AutoRefresh intervalMs={10000} />
      <div className="control-shell">
        <section className="control-hero">
          <div>
            <div className="eyebrow">Control · 자율 운영</div>
            <h1>회사 자율성 제어</h1>
            <p>
              Persistent pilot is active. Full Authority Within Constitution implementation is present but not activated until the owner explicitly approves activation.
            </p>
          </div>
          <div className="control-hero-actions">
            <div className="live-pill"><span /> Live · {formatTimeKo(autonomy.generatedAt)}</div>
            <Link href={"/decisions/owner-inbox" as never} className="btn warn sm">Exception-only 오너함</Link>
            <Link href={"/observe/autonomy-runs" as never} className="btn ghost sm">실행 감사</Link>
          </div>
        </section>

        <section className="control-metrics">
          <div className="control-metric"><span>현재 레벨</span><strong>{autonomy.currentMode}</strong><em>{autonomy.emergencyState}</em></div>
          <div className="control-metric"><span>Authority mode</span><strong>{fullAuthorityActive ? "FULL" : "PILOT"}</strong><em>{autonomy.authorityMode}</em></div>
          <div className="control-metric alert"><span>Full authority</span><strong>{fullAuthority.status}</strong><em>activation separate approval required</em></div>
          <div className="control-metric alert"><span>오너 결정</span><strong>{autonomy.metrics.ownerInbox}</strong><em>{autonomy.ownerInboxMode}</em></div>
        </section>

        <section className="control-grid">
          <div className="card control-span-8">
            <div className="card-head">
              <div className="title">Full Authority Within Constitution Controls</div>
              <div className="sub">· implemented controls · not runtime activation</div>
            </div>
            <div className="card-body">
              <div className="autonomy-levels autonomy-level-rail">
                <span className="tag autonomy-level-chip">mode · {fullAuthority.mode}</span>
                <span className="tag autonomy-level-chip">default · {fullAuthority.defaultDecision}</span>
                <span className="tag autonomy-level-chip">HQ · {fullAuthority.hqAgentRole}</span>
                <span className="tag autonomy-level-chip">Verifier · {fullAuthority.docsAgentRole}</span>
              </div>
              <p className="tiny">
                Emergency controls are always executable downward: pause, lower autonomy, emergency stop. Resume/raise/full-authority activation remains owner-confirmed.
              </p>
              <div className="control-hero-actions">
                <form method="post" action="/api/ops/autonomy/control-actions"><input type="hidden" name="action" value="pause" /><button className="btn ghost sm">일시 정지</button></form>
                <form method="post" action="/api/ops/autonomy/control-actions"><input type="hidden" name="action" value="lower_autonomy" /><input type="hidden" name="requestedLevel" value="L3" /><button className="btn ghost sm">Lower to L3</button></form>
                <form method="post" action="/api/ops/autonomy/control-actions"><input type="hidden" name="action" value="emergency_stop" /><button className="btn danger sm">Emergency Stop</button></form>
              </div>
            </div>
          </div>

          <div className="card control-span-4">
            <div className="card-head"><div className="title">Blast Radius Limits</div><div className="sub">· default deny when constitution missing</div></div>
            <div className="card-body control-approval-list">
              <div className="approval-row"><strong>global runs</strong><span>{fullAuthority.blastRadius.maxConcurrentAutonomyRuns}</span></div>
              <div className="approval-row"><strong>project drafts/day</strong><span>{fullAuthority.blastRadius.maxAutoProjectDraftsPerDay}</span></div>
              <div className="approval-row"><strong>dev patches/day</strong><span>{fullAuthority.blastRadius.maxAutoDevPatchesPerDay}</span></div>
              <div className="approval-row"><strong>medium actions/day</strong><span>{fullAuthority.blastRadius.maxMediumRiskAutoActionsPerDay}</span></div>
            </div>
          </div>

          <div className="card control-span-12">
            <div className="card-head"><div className="title">Protocol Gates</div><div className="sub">· hq-agent protocol gate + docs-agent verifier + after-action reporting</div></div>
            <div className="card-body control-approval-list">
              {fullAuthority.protocols.map((protocol) => (
                <div className="approval-row" key={protocol}>
                  <div><strong>{protocol}</strong><span>tests · rollback · HQ protocol gate · docs verifier · audit/trace/artifact links</span></div>
                  <RiskBadge risk="high" />
                </div>
              ))}
            </div>
          </div>

          <div className="card control-span-12">
            <div className="card-head"><div className="title">Policy Matrix</div><div className="sub">· exception-only owner approval model</div></div>
            <div className="card-body control-approval-list">
              {autonomy.policyMatrix.map((row) => (
                <div className="approval-row" key={row.risk}>
                  <RiskBadge risk={row.risk as never} />
                  <div><strong>{row.decision}</strong><span>{row.detail}</span></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
