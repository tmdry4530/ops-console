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
          <table className="tbl">
            <thead>
              <tr>
                <th>Kind</th>
                <th>Title</th>
                <th>Path</th>
                <th>Commit</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {artifacts.map((art) => (
                <tr key={art.id}>
                  <td><span className="tag">{art.type}</span></td>
                  <td>
                    <div style={{ fontWeight: 500, color: "var(--text-0)" }}>{art.title}</div>
                  </td>
                  <td>
                    {art.restricted ? (
                      <span className="badge warn"><span className="dot" />restricted</span>
                    ) : (
                      <span className="mono" style={{ fontSize: 12, color: "var(--text-1)" }}>{art.path}</span>
                    )}
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>{art.commitSha?.slice(0, 7) ?? "—"}</td>
                  <td className="muted">{new Date(art.createdAt).toLocaleDateString()}</td>
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
    </>
  );
}
