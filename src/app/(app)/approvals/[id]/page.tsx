import { notFound } from "next/navigation";
import Link from "next/link";
import { ApprovalActions } from "@/components/approval-actions";
import { ArtifactLink } from "@/components/artifact-link";
import { EventTimeline } from "@/components/event-timeline";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";
import { labelForApprovalType } from "@/lib/korean-labels";

export const dynamic = "force-dynamic";

export default async function ApprovalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const approval = await db.approval.findUnique({
    where: { id },
    include: {
      project: { include: { artifacts: true, events: { orderBy: { createdAt: "desc" }, take: 20 } } },
      task: { include: { artifacts: true, events: { orderBy: { createdAt: "desc" }, take: 20 } } },
      events: { orderBy: { createdAt: "desc" }, take: 20 },
      commandQueues: { orderBy: { createdAt: "desc" } }
    }
  });
  if (!approval) notFound();

  const artifacts = [...(approval.project?.artifacts ?? []), ...(approval.task?.artifacts ?? [])].filter(
    (a, i, l) => l.findIndex((x) => x.id === a.id) === i
  );
  const events = [...approval.events, ...(approval.project?.events ?? []), ...(approval.task?.events ?? [])].filter(
    (e, i, l) => l.findIndex((x) => x.id === e.id) === i
  );

  const isResolved = ["completed", "rejected"].includes(approval.status);

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <Link href="/approvals" className="btn ghost sm">← 승인 목록</Link>
            <span className="tag">{labelForApprovalType(approval.type)}</span>
            <RiskBadge risk={approval.riskLevel} />
            <StatusBadge label={approval.status} />
          </div>
          <h1>{approval.title}</h1>
          <div className="sub">{approval.summary}</div>
        </div>
      </div>

      {!isResolved && (
        <ApprovalActions approvalId={approval.id} status={approval.status} manualReportId={approval.manualReportId} />
      )}

      <div className="decision-grid">
        <div className="dec-cell">
          <div className="label">프로젝트</div>
          <div className="value">{approval.project?.name ?? "—"}</div>
        </div>
        <div className="dec-cell">
          <div className="label">유형</div>
          <div className="value">{labelForApprovalType(approval.type)}</div>
        </div>
        <div className="dec-cell">
          <div className="label">위험도</div>
          <div className="value"><RiskBadge risk={approval.riskLevel} /></div>
        </div>
        <div className="dec-cell">
          <div className="label">외부 제출 ID</div>
          <div className="value">{approval.manualReportId ?? "—"}</div>
        </div>
      </div>

      <div className="grid-12">
        <div className="span-8 vstack" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <div className="title">산출물</div>
              <div className="sub">· {artifacts.length}개 연결됨</div>
            </div>
            <div className="card-body">
              <div className="vstack" style={{ gap: 8 }}>
                {artifacts.map((art) => (
                  <ArtifactLink
                    key={art.id}
                    title={art.title}
                    path={art.path}
                    restricted={art.restricted}
                    commitSha={art.commitSha}
                  />
                ))}
                {artifacts.length === 0 && <div className="muted">연결된 산출물이 없습니다.</div>}
              </div>
            </div>
          </div>

          {approval.commandQueues.length > 0 && (
            <div className="card">
              <div className="card-head">
                <div className="title">명령 큐 / 수동 처리 기록</div>
              </div>
              <div className="card-body flush">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>액션</th>
                      <th>상태</th>
                      <th>위험도</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approval.commandQueues.map((cmd) => (
                      <tr key={cmd.id}>
                        <td className="mono">{cmd.actionType}</td>
                        <td><StatusBadge label={cmd.status} /></td>
                        <td><RiskBadge risk={cmd.riskLevel} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-head">
              <div className="title">결정 기록</div>
            </div>
            <div className="card-body">
              <EventTimeline events={events} />
            </div>
          </div>
        </div>

        <div className="span-4 vstack" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <div className="title">위험도 프로필</div>
            </div>
            <div className="card-body">
              <div className="vstack" style={{ gap: 10 }}>
                <div className="between">
                  <span className="muted">위험도</span>
                  <RiskBadge risk={approval.riskLevel} />
                </div>
                <div className="between">
                  <span className="muted">상태</span>
                  <StatusBadge label={approval.status} />
                </div>
                <div className="between">
                  <span className="muted">제한 산출물</span>
                  <span>
                    {artifacts.filter((a) => a.restricted).length} / {artifacts.length}
                  </span>
                </div>
                <div className="between">
                  <span className="muted">자동 실행</span>
                  <span style={{ color: "var(--success)" }}>안전 큐 액션만 허용</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
