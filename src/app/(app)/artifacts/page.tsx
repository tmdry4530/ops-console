import Link from "next/link";
import { db } from "@/lib/db";
import { artifactDigest, artifactPreview } from "@/server/task-observability";

export const dynamic = "force-dynamic";

export default async function ArtifactsPage() {
  const artifacts = await db.artifact.findMany({ orderBy: { updatedAt: "desc" }, take: 100, include: { task: { select: { id: true, summary: true } }, agent: { select: { slug: true } } } });
  const previews = new Map(await Promise.all(artifacts.slice(0, 25).map(async (artifact) => [artifact.id, await artifactPreview(artifact, 1800)] as const)));
  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>Artifact registry</h1>
          <div className="sub">Long output is linked, never inlined. Restricted bodies are hidden by policy.</div>
        </div>
      </div>
      <div className="card">
        <div className="card-body flush">
          <div className="tbl-wrap">
          <table className="tbl compact-paths">
            <thead>
              <tr>
                <th>Kind</th>
                <th>Title</th>
                <th className="path-col">Path</th>
                <th className="commit-col">Commit</th>
                <th className="date-col">Created</th>
              </tr>
            </thead>
            <tbody>
              {artifacts.map((art) => (
                <tr key={art.id}>
                  <td><span className="tag">{art.type}</span></td>
                  <td>
                    <div style={{ fontWeight: 500, color: "var(--text-0)" }}>{art.title}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>{art.agent?.slug ?? "unassigned"}</div>
                    {art.task?.id && <Link className="btn ghost sm" href={`/tasks/${art.task.id}`} style={{ marginTop: 6 }}>작업 상세</Link>}
                    {(art.task?.summary || previews.get(art.id)) && (
                      <pre className="codeblock" style={{ marginTop: 8, maxHeight: 220, whiteSpace: "pre-wrap" }}>
                        {art.task?.summary ?? artifactDigest(art, previews.get(art.id) ?? null, 900)}
                      </pre>
                    )}
                  </td>
                  <td className="path-col">
                    {art.restricted ? (
                      <span className="badge warn"><span className="dot" />restricted</span>
                    ) : (
                      <span className="mono" title={art.path ?? undefined} style={{ fontSize: 12, color: "var(--text-1)" }}>{art.path}</span>
                    )}
                  </td>
                  <td className="mono commit-col" style={{ fontSize: 12 }}>{art.commitSha?.slice(0, 7) ?? "—"}</td>
                  <td className="muted date-col">{new Date(art.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {artifacts.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">No artifacts.</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </>
  );
}
