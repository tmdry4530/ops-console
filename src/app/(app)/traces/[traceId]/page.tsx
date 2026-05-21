import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";
import { formatDateTimeKo } from "@/lib/korean-labels";
import { buildTraceLineage } from "@/server/trace-lineage";

export const dynamic = "force-dynamic";

function metadataHasTrace(metadata: unknown, traceId: string) {
  return Boolean(metadata && typeof metadata === "object" && !Array.isArray(metadata) && (metadata as Record<string, unknown>).traceId === traceId);
}

function safeText(value: unknown) {
  if (value == null) return "-";
  if (value instanceof Date) return formatDateTimeKo(value);
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

export default async function TraceDetailPage({ params }: { params: Promise<{ traceId: string }> }) {
  const { traceId } = await params;
  const [events, commands, tasks, artifacts] = await Promise.all([
    db.event.findMany({
      where: { OR: [{ id: traceId }, { taskId: traceId }, { agentId: traceId }] },
      orderBy: { createdAt: "asc" },
      take: 120
    }),
    db.commandQueue.findMany({ orderBy: { createdAt: "asc" }, take: 120 }),
    db.task.findMany({ include: { agent: true, artifacts: true }, orderBy: { updatedAt: "desc" }, take: 160 }),
    db.artifact.findMany({ orderBy: { updatedAt: "desc" }, take: 80 })
  ]);

  const broadEvents = events.length > 0 ? events : await db.event.findMany({ orderBy: { createdAt: "desc" }, take: 220 });
  const traceEvents = broadEvents.filter((event) => event.id === traceId || event.taskId === traceId || event.agentId === traceId || metadataHasTrace(event.metadata, traceId));
  const relatedTaskIds = new Set(traceEvents.map((event) => event.taskId).filter(Boolean) as string[]);
  const relatedArtifactIds = new Set(traceEvents.map((event) => event.artifactId).filter(Boolean) as string[]);
  const traceCommands = commands.filter((command) => command.id === traceId || metadataHasTrace(command.payload, traceId));
  const traceTasks = tasks.filter((task) => task.id === traceId || relatedTaskIds.has(task.id) || task.artifacts.some((artifact) => relatedArtifactIds.has(artifact.id)) || task.slug.includes(traceId));
  const traceArtifacts = artifacts.filter((artifact) => relatedArtifactIds.has(artifact.id) || traceTasks.some((task) => task.id === artifact.taskId));

  if (traceEvents.length === 0 && traceCommands.length === 0 && traceTasks.length === 0 && traceArtifacts.length === 0) notFound();

  const lineage = buildTraceLineage({
    traceId,
    events: traceEvents.map((event) => ({ id: event.id, type: event.type, message: event.message, severity: event.severity, createdAt: event.createdAt, metadata: event.metadata as Record<string, unknown> })),
    commands: traceCommands.map((command) => ({ id: command.id, actionType: command.actionType, status: command.status, riskLevel: command.riskLevel, payload: command.payload as Record<string, unknown>, createdAt: command.createdAt, updatedAt: command.updatedAt })),
    tasks: traceTasks.map((task) => ({ id: task.id, title: task.title, status: task.status, summary: task.summary, nextAction: task.nextAction, createdAt: task.createdAt, updatedAt: task.updatedAt, agent: task.agent ? { slug: task.agent.slug, name: task.agent.name } : null, artifacts: task.artifacts.map((artifact) => ({ id: artifact.id, title: artifact.title, path: artifact.path, restricted: artifact.restricted })) })),
    artifacts: traceArtifacts.map((artifact) => ({ id: artifact.id, title: artifact.title, path: artifact.path, restricted: artifact.restricted, createdAt: artifact.createdAt, updatedAt: artifact.updatedAt }))
  });

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <Link href="/control" className="btn ghost sm">← Control</Link>
            <StatusBadge label="trace_lineage" kind="info" />
          </div>
          <h1>Trace Lineage</h1>
          <div className="sub mono">{traceId}</div>
        </div>
      </div>

      <div className="grid-12" style={{ marginBottom: 16 }}>
        <div className="span-3"><div className="card"><div className="card-body"><div className="muted">Events</div><strong>{lineage.eventCount}</strong></div></div></div>
        <div className="span-3"><div className="card"><div className="card-body"><div className="muted">Commands</div><strong>{lineage.commandCount}</strong></div></div></div>
        <div className="span-3"><div className="card"><div className="card-body"><div className="muted">Tasks</div><strong>{lineage.parentTasks.length + lineage.childTasks.length}</strong></div></div></div>
        <div className="span-3"><div className="card"><div className="card-body"><div className="muted">Artifacts</div><strong>{lineage.artifactCount}</strong></div></div></div>
      </div>

      <div className="vstack" style={{ gap: 14 }}>
        {lineage.stages.map((stage, index) => (
          <section key={stage.key} className="card trace-lineage-stage">
            <div className="card-head">
              <div className="title">{index + 1}. {stage.title}</div>
              <div className="right"><StatusBadge label={stage.status} kind={stage.status === "pending" || stage.status === "not_recorded" ? "warn" : "ok"} /></div>
            </div>
            <div className="card-body vstack" style={{ gap: 8 }}>
              {stage.items.map((item: Record<string, unknown>, itemIndex: number) => (
                <div key={`${stage.key}-${itemIndex}`} className="lineage-item">
                  {Object.entries(item).map(([key, value]) => (
                    <div key={key}><span className="muted">{key}</span><code>{safeText(value)}</code></div>
                  ))}
                </div>
              ))}
              {stage.items.length === 0 && <div className="empty">이 단계의 DB 증거 없음</div>}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
