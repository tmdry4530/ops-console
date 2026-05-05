import { db } from "@/lib/db";
import { StatusBadge } from "@/components/status-badge";
import type { StatusKind } from "@/components/status-badge";

export const dynamic = "force-dynamic";

function ruleKind(rule: string): StatusKind {
  if (rule === "allow") return "ok";
  if (rule === "block") return "danger";
  return "warn";
}

export default async function PoliciesPage() {
  const policies = await db.policy.findMany({ orderBy: { actionType: "asc" } });
  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>Safety policies</h1>
          <div className="sub">Server-enforced. UI never re-implements these rules — it reads them.</div>
        </div>
      </div>
      <div className="card">
        <div className="card-body flush">
          <table className="tbl">
            <thead>
              <tr>
                <th>Action</th>
                <th>Rule</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id}>
                  <td className="mono" style={{ fontSize: 12.5, color: "var(--text-0)" }}>{p.actionType}</td>
                  <td>
                    <StatusBadge label={p.action.replace(/_/g, " ")} kind={ruleKind(p.action)} />
                  </td>
                  <td className="muted">{p.description}</td>
                </tr>
              ))}
              {policies.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty">No policies defined.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
