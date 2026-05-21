import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { StatusBadge } from "@/components/status-badge";
import { loadNewsDashboardSummary } from "@/server/news-dashboard";

export const dynamic = "force-dynamic";

type BadgeKind = "ok" | "warn" | "danger" | "info" | "muted" | undefined;

function statusKind(status: string): BadgeKind {
  if (status === "configured" || status === "active") return "ok";
  if (status === "blocked") return "danger";
  if (status === "pending_config" || status === "configured_no_daily_issue") return "warn";
  return "muted";
}

function priorityKind(priority: string): BadgeKind {
  if (priority === "critical") return "danger";
  if (priority === "high") return "warn";
  return "info";
}

export default async function NewsPage() {
  const news = loadNewsDashboardSummary();
  const cardsCapacity = news.domains.reduce((sum, domain) => sum + domain.maxCards, 0);

  return (
    <>
      <AutoRefresh intervalMs={30000} />
      <div className="control-shell">
        <section className="control-hero">
          <div>
            <div className="eyebrow">News · Card Dashboard</div>
            <h1>오늘의 카드 뉴스</h1>
            <p>research-agent Domain Config를 읽어 `/news` 대시보드 상태를 표시한다. 도메인은 코드에 고정하지 않고 Vault config에서만 가져온다.</p>
          </div>
          <div className="control-hero-actions">
            <div className="live-pill"><span /> 08:00 KST · {news.issue.runKey}</div>
            <Link href={"/observe" as never} className="btn ghost sm">Observe</Link>
          </div>
        </section>

        <section className="control-metrics" aria-label="News Summary">
          <div className={`control-metric ${news.status === "blocked" ? "alert" : ""}`}><span>Config status</span><strong>{news.status}</strong><em>{news.domains.length} active domains</em></div>
          <div className="control-metric"><span>Sources</span><strong>{news.sourceCount}</strong><em>Vault source registry</em></div>
          <div className="control-metric"><span>Cards today</span><strong>{news.issue.cardCount}</strong><em>capacity {cardsCapacity}</em></div>
          <div className="control-metric"><span>Issue state</span><strong>{news.issue.state}</strong><em>collector not run yet</em></div>
        </section>

        <section className="control-grid">
          <div className="card control-span-8">
            <div className="card-head"><div className="title">오늘의 카드</div><div className="sub">· internal dashboard · source-backed only</div></div>
            <div className="card-body">
              {news.status === "pending_config" && (
                <div className="empty">
                  뉴스 도메인 설정 대기 중. research-agent Domain Config가 없어서 카드 생성을 보류했다.
                </div>
              )}
              {news.status === "blocked" && (
                <div className="empty">
                  Domain Config 참조 오류가 있어 collector를 막았다. missing source refs를 먼저 수정해야 한다.
                </div>
              )}
              {news.status === "configured" && (
                <div className="empty">
                  Domain Config는 준비됨. 아직 daily collector/card generation은 실행되지 않아 오늘 카드가 없다. 다음 단계는 source collector와 evidence pack 생성이다.
                </div>
              )}
            </div>
          </div>

          <div className="card control-span-4">
            <div className="card-head"><div className="title">Domain Config Status</div><div className="sub">· Vault driven</div></div>
            <div className="card-body control-health-list">
              <div className="health-row"><div><strong>Status</strong><span>{news.nextAction}</span></div><StatusBadge label={news.status} kind={statusKind(news.status)} /></div>
              <div className="health-row"><div><strong>Config hash</strong><span className="mono tiny">{news.configHash?.slice(0, 16) ?? "none"}</span></div><StatusBadge label="audit" kind="info" /></div>
              <div className="health-row"><div><strong>External publish</strong><span>newsletter/SNS/share requires approval</span></div><StatusBadge label="approval required" kind="warn" /></div>
            </div>
          </div>

          <div className="card control-span-12">
            <div className="card-head"><div className="title">도메인별 필터</div><div className="sub">· generated from active-domains.md</div></div>
            <div className="card-body flush control-table-wrap">
              <table className="tbl control-table">
                <thead><tr><th>Domain</th><th>Priority</th><th>Sources</th><th>Freshness</th><th>Max cards</th><th>Confidence rule</th><th>Language</th></tr></thead>
                <tbody>
                  {news.domains.map((domain) => (
                    <tr key={domain.slug}>
                      <td><strong>{domain.displayName}</strong><div className="mono tiny">{domain.slug}</div></td>
                      <td><StatusBadge label={domain.priority} kind={priorityKind(domain.priority)} /></td>
                      <td>{domain.sourceIds.length}{domain.missingSourceIds.length > 0 ? ` · missing ${domain.missingSourceIds.length}` : ""}</td>
                      <td>{domain.freshnessWindow}</td>
                      <td>{domain.maxCards}</td>
                      <td>{domain.scoringProfile}</td>
                      <td>{domain.languageRegionPreference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {news.domains.length === 0 && <div className="empty">active domain 없음</div>}
            </div>
          </div>

          <div className="card control-span-6">
            <div className="card-head"><div className="title">Why it matters / Source links</div><div className="sub">· card contract</div></div>
            <div className="card-body">
              <ul className="control-list">
                <li>각 카드는 `why_it_matters`, confidence, source links, freshness label을 가져야 한다.</li>
                <li>source URL/time/evidence 없는 claim은 카드 후보에서 제외한다.</li>
                <li>외부 발행은 approval 없이는 실행하지 않는다.</li>
              </ul>
            </div>
          </div>

          <div className="card control-span-6">
            <div className="card-head"><div className="title">Issue Archive / Create Product Idea</div><div className="sub">· next implementation hooks</div></div>
            <div className="card-body">
              <div className="empty">Archive는 daily issue가 생성되면 표시된다. `Create Product Idea`는 카드 evidence를 내부 project idea draft로 넘기는 버튼으로 연결한다.</div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
