import { notFound } from "next/navigation";
import Link from "next/link";
import { ArtifactLink } from "@/components/artifact-link";
import { EventTimeline } from "@/components/event-timeline";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await db.agent.findUnique({
    where: { id },
    include: { tasks: true, artifacts: true, events: { orderBy: { createdAt: "desc" }, take: 25 } }
  });
  if (!agent) notFound();

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <Link href="/agents" className="btn ghost sm">← Agents</Link>
            <StatusBadge label={agent.status} />
            <StatusBadge label={agent.health} kind={agent.health === "ok" ? "ok" : "warn"} />
          </div>
          <h1>{agent.name}</h1>
          <div className="sub">{agent.slug} · {agent.currentTask ?? "idle"}</div>
        </div>
        <div className="actions">
          <button className="btn ghost sm">Pause</button>
          <button className="btn sm">Restart</button>
        </div>
      </div>

      <div className="grid-12" style={{ marginBottom: 20 }}>
        <div className="span-3"><MetricCard label="Health" value={agent.health.toUpperCase()} /></div>
        <div className="span-3"><MetricCard label="Tasks (total)" value={String(agent.tasks.length)} /></div>
        <div className="span-3"><MetricCard label="Artifacts" value={String(agent.artifacts.length)} /></div>
        <div className="span-3"><MetricCard label="Events" value={String(agent.events.length)} /></div>
      </div>

      <div className="grid-12">
        <div className="span-8 vstack" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head"><div className="title">Current task</div></div>
            <div className="card-body">
              <div style={{ fontSize: 14, fontWeight: 500 }}>{agent.currentTask ?? "Idle"}</div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                Last heartbeat: {agent.heartbeatAt ? new Date(agent.heartbeatAt).toLocaleString() : "not reported"}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><div className="title">Artifacts</div></div>
            <div className="card-body">
              <div className="vstack" style={{ gap: 8 }}>
                {agent.artifacts.map((art) => (
                  <ArtifactLink
                    key={art.id}
                    title={art.title}
                    path={art.path}
                    restricted={art.restricted}
                    commitSha={art.commitSha}
                  />
                ))}
                {agent.artifacts.length === 0 && <div className="muted">No artifacts.</div>}
              </div>
            </div>
          </div>
        </div>
        <div className="span-4 vstack" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head"><div className="title">Permissions</div></div>
            <div className="card-body">
              <ul className="bare" style={{ fontSize: 12.5 }}>
                <li><span className="sev ok" /> network.outbound (allowlist)</li>
                <li><span className="sev ok" /> repo.read</li>
                <li><span className="sev warn" /> artifact.write</li>
                <li><span className="sev danger" /> wallet.* — blocked</li>
              </ul>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><div className="title">Timeline</div></div>
            <div className="card-body">
              <EventTimeline events={agent.events.slice(0, 8)} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
