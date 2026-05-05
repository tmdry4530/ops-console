import { notFound } from "next/navigation";
import Link from "next/link";
import { ApprovalActions } from "@/components/approval-actions";
import { ArtifactLink } from "@/components/artifact-link";
import { EventTimeline } from "@/components/event-timeline";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";

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
            <Link href="/approvals" className="btn ghost sm">← Approvals</Link>
            <span className="tag">{approval.type}</span>
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
          <div className="label">Project</div>
          <div className="value">{approval.project?.name ?? "—"}</div>
        </div>
        <div className="dec-cell">
          <div className="label">Type</div>
          <div className="value">{approval.type}</div>
        </div>
        <div className="dec-cell">
          <div className="label">Risk</div>
          <div className="value"><RiskBadge risk={approval.riskLevel} /></div>
        </div>
        <div className="dec-cell">
          <div className="label">Manual report</div>
          <div className="value">{approval.manualReportId ?? "—"}</div>
        </div>
      </div>

      <div className="grid-12">
        <div className="span-8 vstack" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <div className="title">Artifacts</div>
              <div className="sub">· {artifacts.length} attached</div>
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
                {artifacts.length === 0 && <div className="muted">No artifacts attached.</div>}
              </div>
            </div>
          </div>

          {approval.commandQueues.length > 0 && (
            <div className="card">
              <div className="card-head">
                <div className="title">Command queue / handoff records</div>
              </div>
              <div className="card-body flush">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Status</th>
                      <th>Risk</th>
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
              <div className="title">Decision history</div>
            </div>
            <div className="card-body">
              <EventTimeline events={events} />
            </div>
          </div>
        </div>

        <div className="span-4 vstack" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <div className="title">Risk profile</div>
            </div>
            <div className="card-body">
              <div className="vstack" style={{ gap: 10 }}>
                <div className="between">
                  <span className="muted">Risk level</span>
                  <RiskBadge risk={approval.riskLevel} />
                </div>
                <div className="between">
                  <span className="muted">Status</span>
                  <StatusBadge label={approval.status} />
                </div>
                <div className="between">
                  <span className="muted">Restricted artifacts</span>
                  <span>
                    {artifacts.filter((a) => a.restricted).length} / {artifacts.length}
                  </span>
                </div>
                <div className="between">
                  <span className="muted">Auto-execute</span>
                  <span style={{ color: "var(--danger)" }}>Blocked by policy</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
