import type { Route } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { EventTimeline } from "@/components/event-timeline";
import { MetricCard } from "@/components/metric-card";
import { ProjectBoard } from "@/components/project-board";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
import { Icons } from "@/components/icons";
import { labelForApprovalType, labelForHealth, labelForRisk } from "@/lib/korean-labels";
import { getDashboardSummary } from "@/server/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const summary = await getDashboardSummary();
  const pending = summary.approvals;
  const critical = pending.find((a) => a.riskLevel === "critical");
  const activeAgents = summary.opsMonitor.totals.processLive + summary.opsMonitor.totals.workflowRunning;
  const restrictedArtifacts = summary.artifacts.filter((a) => a.restricted).length;

  return (
    <>
      <AutoRefresh intervalMs={10000} />
      <div className="page-head">
        <div className="titles">
          <h1>운영 현황</h1>
          <div className="sub">프라이빗 컨트롤 플레인 · 방금 동기화됨</div>
        </div>
        <div className="actions">
          <button className="btn ghost sm">스냅샷 내보내기</button>
          <button className="btn sm" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 13, height: 13, display: "inline-flex" }}>{Icons.refresh}</span> 새로고침
          </button>
        </div>
      </div>

      {critical && (
        <div
          className="card"
          style={{
            marginBottom: 20,
            borderColor: "color-mix(in oklab, var(--danger) 40%, transparent)",
            background: "linear-gradient(90deg, var(--danger-soft), transparent 60%), var(--bg-1)"
          }}
        >
          <div className="card-body" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "var(--danger-soft)",
                color: "var(--danger)",
                display: "grid",
                placeItems: "center"
              }}
            >
              {Icons.warn}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-0)" }}>
                최우선 확인: {critical.title}
              </div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                {critical.summary} · 위험도 <strong style={{ color: "var(--danger)" }}>{labelForRisk(critical.riskLevel)}</strong>
              </div>
            </div>
            <Link href={`/approvals/${critical.id}` as Route} className="btn primary">
              결정 열기 <span style={{ width: 13, height: 13, display: "inline-flex" }}>{Icons.arrow}</span>
            </Link>
          </div>
        </div>
      )}

      <div className="grid-12">
        <div className="span-3">
          <MetricCard
            label="승인 대기"
            value={String(pending.length)}
            alert={pending.length > 0}
            delta={`에이전트 ${summary.agents.length}개 추적 중`}
          />
        </div>
        <div className="span-3">
          <MetricCard
            label="실행 중인 에이전트"
            value={`${activeAgents}/${summary.agents.length}`}
            delta={`${summary.opsMonitor.totals.processLive} live · ${summary.opsMonitor.totals.workflowRunning} workflow`}
            trend="up"
          />
        </div>
        <div className="span-3">
          <MetricCard
            label="실패 작업"
            value={String(summary.failedJobs)}
            delta={summary.failedJobs > 0 ? "조치 필요" : "이상 없음"}
            trend={summary.failedJobs > 0 ? "down" : undefined}
          />
        </div>
        <div className="span-3">
          <MetricCard
            label="산출물"
            value={String(summary.artifacts.length)}
            delta={`제한됨 ${restrictedArtifacts}개`}
          />
        </div>
      </div>

      <div className="grid-12" style={{ marginTop: 20 }}>
        <div className="span-12">
          <div className="card">
            <div className="card-head">
              <div className="title">실시간 Company 관제 요약</div>
              <div className="sub">· 10초 자동 갱신 · 작업/승인/보고 대기 통합</div>
              <div className="right">
                <Link href="/agents" className="btn ghost sm">관제센터 열기</Link>
              </div>
            </div>
            <div className="card-body">
              <div className="grid-12">
                <div className="span-3 muted">프로세스 live: <strong style={{ color: "var(--text-0)" }}>{summary.opsMonitor.totals.processLive}</strong></div>
                <div className="span-3 muted">워크플로 실행: <strong style={{ color: "var(--text-0)" }}>{summary.opsMonitor.totals.workflowRunning}</strong></div>
                <div className="span-3 muted">활성 작업: <strong style={{ color: "var(--text-0)" }}>{summary.opsMonitor.totals.activeTasks}</strong></div>
                <div className="span-3 muted">보고 대기: <strong style={{ color: "var(--text-0)" }}>{summary.opsMonitor.totals.queuedReports}</strong></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-12" style={{ marginTop: 20 }}>
        <div className="span-8 vstack" style={{ gap: 20 }}>
          <div className="card">
            <div className="card-head">
              <div className="title">승인 대기열</div>
              <div className="sub">· 대기 {pending.length}건</div>
              <div className="right">
                <Link href="/approvals" className="btn ghost sm">
                  전체 보기 <span style={{ width: 12, height: 12, display: "inline-flex" }}>{Icons.arrow}</span>
                </Link>
              </div>
            </div>
            <div className="card-body flush">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>유형</th>
                    <th>제목</th>
                    <th>위험도</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.approvals.slice(0, 5).map((a) => (
                    <tr key={a.id}>
                      <td>
                        <span className="tag">{labelForApprovalType(a.type)}</span>
                      </td>
                      <td>
                        <Link href={`/approvals/${a.id}` as Route} style={{ fontWeight: 500, color: "var(--text-0)" }}>
                          {a.title}
                        </Link>
                      </td>
                      <td>
                        <RiskBadge risk={a.riskLevel} />
                      </td>
                      <td>
                        <StatusBadge label={a.status} />
                      </td>
                    </tr>
                  ))}
                  {summary.approvals.length === 0 && (
                    <tr>
                      <td colSpan={4} className="empty">
                        승인 대기 건 없음
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="title">프로젝트 보드</div>
              <div className="right">
                <Link href="/projects" className="btn ghost sm">
                  전체 보기 <span style={{ width: 12, height: 12, display: "inline-flex" }}>{Icons.arrow}</span>
                </Link>
              </div>
            </div>
            <div className="card-body">
              <ProjectBoard projects={summary.projects.slice(0, 4)} />
            </div>
          </div>
        </div>

        <div className="span-4 vstack" style={{ gap: 20 }}>
          <div className="card">
            <div className="card-head">
              <div className="title">에이전트 현황</div>
              <div className="sub">· {summary.agents.length}개</div>
              <div className="right">
                <Link href="/agents" className="btn ghost sm">
                  열기 <span style={{ width: 12, height: 12, display: "inline-flex" }}>{Icons.arrow}</span>
                </Link>
              </div>
            </div>
            <div className="card-body" style={{ padding: "8px 0" }}>
              <ul className="bare">
                {summary.agents.slice(0, 5).map((a) => (
                  <li key={a.id} style={{ padding: "6px 16px" }}>
                    <span className={`sev ${a.health === "ok" ? "ok" : "warn"}`} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                      <div className="muted" style={{ fontSize: 11.5 }}>상태: {labelForHealth(a.health)} · {a.currentTask ?? "현재 작업 없음"}</div>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="title">최근 이벤트</div>
              <div className="right">
                <Link href="/events" className="btn ghost sm">
                  스트림 <span style={{ width: 12, height: 12, display: "inline-flex" }}>{Icons.arrow}</span>
                </Link>
              </div>
            </div>
            <div className="card-body">
              <EventTimeline events={summary.recentEvents} />
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="title">최근 산출물</div>
              <div className="right">
                <Link href="/artifacts" className="btn ghost sm">
                  저장소 <span style={{ width: 12, height: 12, display: "inline-flex" }}>{Icons.arrow}</span>
                </Link>
              </div>
            </div>
            <div className="card-body" style={{ padding: "8px 0" }}>
              <ul className="bare">
                {summary.artifacts.slice(0, 5).map((art) => (
                  <li key={art.id} style={{ padding: "6px 16px" }}>
                    <span className="sev ok" />
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <span className="mono" style={{ fontSize: 12 }}>{art.path?.split("/").pop() ?? art.title}</span>
                    </span>
                    {art.restricted ? <span className="tag" style={{ color: "var(--warn)" }}>제한됨</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
