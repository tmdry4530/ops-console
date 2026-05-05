import { notFound } from "next/navigation";
import type { Route } from "next";
import Link from "next/link";
import { ArtifactLink } from "@/components/artifact-link";
import { EventTimeline } from "@/components/event-timeline";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    include: {
      approvals: true,
      artifacts: true,
      events: { orderBy: { createdAt: "desc" }, take: 20 }
    }
  });
  if (!project) notFound();

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <Link href="/projects" className="btn ghost sm">← Projects</Link>
            <StatusBadge label={project.status} />
          </div>
          <h1>{project.name}</h1>
          <div className="sub">{project.revenueType ?? project.slug}</div>
        </div>
      </div>

      {project.nextAction && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body">
            <div
              style={{
                borderLeft: "2px solid var(--accent)",
                paddingLeft: 12,
                background: "linear-gradient(90deg,var(--accent-soft),transparent 70%)",
                borderRadius: "0 6px 6px 0",
                padding: "6px 12px"
              }}
            >
              {project.nextAction}
            </div>
          </div>
        </div>
      )}

      <div className="grid-12">
        <div className="span-8 vstack" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head"><div className="title">Approvals & blockers</div></div>
            <div className="card-body flush">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Title</th>
                    <th>Risk</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {project.approvals.map((a) => (
                    <tr key={a.id}>
                      <td><span className="tag">{a.type}</span></td>
                      <td>
                        <Link href={`/approvals/${a.id}` as Route} style={{ fontWeight: 500, color: "var(--text-0)" }}>
                          {a.title}
                        </Link>
                      </td>
                      <td><RiskBadge risk={a.riskLevel} /></td>
                      <td><StatusBadge label={a.status} /></td>
                    </tr>
                  ))}
                  {project.approvals.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted" style={{ padding: 18 }}>No approvals.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><div className="title">Artifacts</div></div>
            <div className="card-body">
              <div className="vstack" style={{ gap: 8 }}>
                {project.artifacts.map((art) => (
                  <ArtifactLink
                    key={art.id}
                    title={art.title}
                    path={art.path}
                    restricted={art.restricted}
                    commitSha={art.commitSha}
                  />
                ))}
                {project.artifacts.length === 0 && <div className="muted">No artifacts.</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="span-4 vstack" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head"><div className="title">Summary</div></div>
            <div className="card-body">
              <div className="vstack" style={{ gap: 8, fontSize: 13 }}>
                <div className="between">
                  <span className="muted">Status</span>
                  <span>{project.status.replace(/_/g, " ")}</span>
                </div>
                {project.blocker && (
                  <div className="between">
                    <span className="muted">Blocker</span>
                    <span style={{ color: "var(--warn)" }}>{project.blocker}</span>
                  </div>
                )}
                <div className="between">
                  <span className="muted">Slug</span>
                  <span className="mono" style={{ fontSize: 11.5 }}>{project.slug}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><div className="title">Timeline</div></div>
            <div className="card-body">
              <EventTimeline events={project.events.slice(0, 8)} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
