import type { Route } from "next";
import Link from "next/link";
import { EventTimeline } from "@/components/event-timeline";
import { MetricCard } from "@/components/metric-card";
import { ProjectBoard } from "@/components/project-board";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
import { Icons } from "@/components/icons";
import { getDashboardSummary } from "@/server/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const summary = await getDashboardSummary();
  const pending = summary.approvals;
  const critical = pending.find((a) => a.riskLevel === "critical");
  const activeAgents = summary.agents.filter((a) => a.status === "running").length;
  const restrictedArtifacts = summary.artifacts.filter((a) => a.restricted).length;

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>Operations overview</h1>
          <div className="sub">Private control plane · last sync just now</div>
        </div>
        <div className="actions">
          <button className="btn ghost sm">Export snapshot</button>
          <button className="btn sm" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 13, height: 13, display: "inline-flex" }}>{Icons.refresh}</span> Refresh
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
                Highest-priority: {critical.title}
              </div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                {critical.summary} · risk <strong style={{ color: "var(--danger)" }}>{critical.riskLevel}</strong>
              </div>
            </div>
            <Link href={`/approvals/${critical.id}` as Route} className="btn primary">
              Open decision <span style={{ width: 13, height: 13, display: "inline-flex" }}>{Icons.arrow}</span>
            </Link>
          </div>
        </div>
      )}

      <div className="grid-12">
        <div className="span-3">
          <MetricCard
            label="Pending approvals"
            value={String(pending.length)}
            alert={pending.length > 0}
            delta={`${summary.agents.length} agents tracked`}
          />
        </div>
        <div className="span-3">
          <MetricCard
            label="Active agents"
            value={`${activeAgents}/${summary.agents.length}`}
            delta="monitoring"
            trend="up"
          />
        </div>
        <div className="span-3">
          <MetricCard
            label="Failed jobs"
            value={String(summary.failedJobs)}
            delta={summary.failedJobs > 0 ? "action needed" : "all clear"}
            trend={summary.failedJobs > 0 ? "down" : undefined}
          />
        </div>
        <div className="span-3">
          <MetricCard
            label="Artifacts"
            value={String(summary.artifacts.length)}
            delta={`${restrictedArtifacts} restricted`}
          />
        </div>
      </div>

      <div className="grid-12" style={{ marginTop: 20 }}>
        <div className="span-8 vstack" style={{ gap: 20 }}>
          <div className="card">
            <div className="card-head">
              <div className="title">Approvals queue</div>
              <div className="sub">· {pending.length} pending</div>
              <div className="right">
                <Link href="/approvals" className="btn ghost sm">
                  View all <span style={{ width: 12, height: 12, display: "inline-flex" }}>{Icons.arrow}</span>
                </Link>
              </div>
            </div>
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
                  {summary.approvals.slice(0, 5).map((a) => (
                    <tr key={a.id}>
                      <td>
                        <span className="tag">{a.type}</span>
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
                        No pending approvals.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="title">Project board</div>
              <div className="right">
                <Link href="/projects" className="btn ghost sm">
                  View all <span style={{ width: 12, height: 12, display: "inline-flex" }}>{Icons.arrow}</span>
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
              <div className="title">Agent fleet</div>
              <div className="sub">· {summary.agents.length} agents</div>
              <div className="right">
                <Link href="/agents" className="btn ghost sm">
                  Open <span style={{ width: 12, height: 12, display: "inline-flex" }}>{Icons.arrow}</span>
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
                      <div className="muted" style={{ fontSize: 11.5 }}>{a.currentTask ?? "—"}</div>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="title">Recent events</div>
              <div className="right">
                <Link href="/events" className="btn ghost sm">
                  Stream <span style={{ width: 12, height: 12, display: "inline-flex" }}>{Icons.arrow}</span>
                </Link>
              </div>
            </div>
            <div className="card-body">
              <EventTimeline events={summary.recentEvents} />
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="title">Recent artifacts</div>
              <div className="right">
                <Link href="/artifacts" className="btn ghost sm">
                  Registry <span style={{ width: 12, height: 12, display: "inline-flex" }}>{Icons.arrow}</span>
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
                    {art.restricted ? <span className="tag" style={{ color: "var(--warn)" }}>restricted</span> : null}
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
