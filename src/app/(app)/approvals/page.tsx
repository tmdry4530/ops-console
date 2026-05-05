import type { Route } from "next";
import Link from "next/link";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";
import { labelForApprovalType } from "@/lib/korean-labels";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const approvals = await db.approval.findMany({ orderBy: { updatedAt: "desc" }, include: { project: true } });

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>승인</h1>
          <div className="sub">운영자 결정 · 안전 큐 실행과 수동 처리 액션을 분리합니다.</div>
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
            <div className="empty">승인 항목이 없습니다.</div>
          </div>
        )}
      </div>
    </>
  );
}
