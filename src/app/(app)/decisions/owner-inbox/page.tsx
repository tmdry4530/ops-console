import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
import { getOwnerInbox } from "@/server/autonomous-company-mode-store";
import { redactSecretLikeText } from "@/server/autonomous-company-mode";

export const dynamic = "force-dynamic";

export default async function OwnerInboxPage() {
  const items = await getOwnerInbox();
  const highCritical = items.filter((item: any) => ["high", "critical"].includes(item.riskLevel)).length;
  return (
    <div className="control-shell">
      <AutoRefresh intervalMs={10000} />
      <section className="control-hero">
        <div>
          <div className="eyebrow">Decisions · exception-only 오너함</div>
          <h1>오너 결정함</h1>
          <p>Full Authority 구현 이후 오너함은 예외 처리 전용이다: Constitution 변경, raw secret, 권한 확대, 정책 우회, missing protocol evidence만 escalates.</p>
        </div>
        <Link href={"/control/autonomy" as never} className="btn ghost sm">Control</Link>
      </section>
      <section className="control-metrics">
        <div className="control-metric alert"><span>Exception packets</span><strong>{items.length}</strong><em>open</em></div>
        <div className="control-metric alert"><span>High/Critical</span><strong>{highCritical}</strong><em>auto-blocked or protocol-missing</em></div>
      </section>
      <section className="control-grid">
        <div className="card control-span-12">
          <div className="card-head"><div className="title">Exception Stack</div><div className="sub">· raw secret values never rendered</div></div>
          <div className="card-body control-approval-list">
            {items.map((item: any) => (
              <div className="approval-row" key={item.id}>
                <div>
                  <strong>{redactSecretLikeText(String(item.title ?? ""))}</strong>
                  <span>{redactSecretLikeText(String(item.ownerQuestion ?? item.contextSummary ?? ""))}</span>
                  <div className="tiny">requested by {redactSecretLikeText(String(item.requestedByAgent ?? ""))} · trace {redactSecretLikeText(String(item.traceId ?? ""))} · 비밀값 표시 안 함</div>
                  <div className="tiny">allowed responses: approve · reject · request changes · manual handoff</div>
                </div>
                <RiskBadge risk={item.riskLevel} />
                <StatusBadge label={item.status} kind="warn" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
