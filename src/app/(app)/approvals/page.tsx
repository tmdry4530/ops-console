import type { Route } from "next";
import Link from "next/link";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
import { approvalWhereForCompletionFilter, normalizeApprovalCompletionFilter } from "@/lib/approval-filters";
import { db } from "@/lib/db";
import { labelForApprovalType } from "@/lib/korean-labels";

export const dynamic = "force-dynamic";

type ApprovalsPageProps = {
  searchParams?: Promise<{ filter?: string }>;
};

export default async function ApprovalsPage({ searchParams }: ApprovalsPageProps) {
  const params = await searchParams;
  const activeFilter = normalizeApprovalCompletionFilter(params?.filter);
  const approvals = await db.approval.findMany({
    where: approvalWhereForCompletionFilter(activeFilter),
    orderBy: { updatedAt: "desc" },
    include: { project: true }
  });

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>승인</h1>
          <div className="sub">운영자 결정 · 기본은 미완료만 표시하고 완료된 승인요청은 숨깁니다.</div>
        </div>
        <div className="actions" style={{ gap: 8 }}>
          <Link className={`btn sm ${activeFilter === "incomplete" ? "" : "ghost"}`} href="/approvals">
            미완료
          </Link>
          <Link className={`btn sm ${activeFilter === "completed" ? "" : "ghost"}`} href="/approvals?filter=completed">
            완료
          </Link>
          <Link className={`btn sm ${activeFilter === "all" ? "" : "ghost"}`} href="/approvals?filter=all">
            전체
          </Link>
        </div>
      </div>

      <div className="vstack" style={{ gap: 10 }}>
        {approvals.map((a) => (
          <Link
            key={a.id}
            href={`/approvals/${a.id}` as Route}
            className="card"
            style={{ textDecoration: "none", display: "block", cursor: "pointer" }}
          >
            <div className="card-body" style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div
                style={{
                  width: 4,
                  alignSelf: "stretch",
                  marginLeft: -20,
                  marginRight: 0,
                  borderRadius: "3px 0 0 3px",
                  background:
                    a.riskLevel === "critical" || a.riskLevel === "high"
                      ? "var(--danger)"
                      : a.riskLevel === "medium"
                        ? "var(--warn)"
                        : "var(--ok)"
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                  <span className="tag">{labelForApprovalType(a.type)}</span>
                  <RiskBadge risk={a.riskLevel} />
                  <StatusBadge label={a.status} />
                </div>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-0)", marginBottom: 2 }}>{a.title}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>{a.summary}</div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
                  <span className="mono">{a.project?.name ?? a.project?.slug ?? "—"}</span>
                </div>
              </div>
              <span className="btn ghost sm">
                열기 <span style={{ width: 12, height: 12, display: "inline-flex" }}>&rarr;</span>
              </span>
            </div>
          </Link>
        ))}
        {approvals.length === 0 && (
          <div className="card">
            <div className="card-body" style={{ minHeight: 180, display: "grid", placeItems: "center", textAlign: "center" }}>
              <div>
                <div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>
                <div style={{ fontWeight: 700, color: "var(--text-0)", marginBottom: 6 }}>
                  {activeFilter === "completed" ? "완료된 승인 요청이 없습니다" : activeFilter === "all" ? "승인 요청이 없습니다" : "미완료 승인 요청이 없습니다"}
                </div>
                <div className="muted" style={{ fontSize: 12.5, maxWidth: 420 }}>
                  {activeFilter === "incomplete" ? "완료된 요청은 상단의 완료/전체 필터에서 확인할 수 있습니다." : "필터를 바꾸면 다른 상태의 승인 요청을 확인할 수 있습니다."}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
