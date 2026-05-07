import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ArtifactsPage() {
  const artifacts = await db.artifact.findMany({ orderBy: { updatedAt: "desc" }, take: 100 });
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
