import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatDateTimeKo } from "@/lib/korean-labels";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

function safeJson(value: unknown) { return JSON.stringify(value ?? {}, null, 2).slice(0, 2000); }

export default async function TraceDetailPage({ params }: { params: Promise<{ traceId: string }> }) {
  const { traceId } = await params;
  const [events, tasks, approvals, commands, runs, verifications] = await Promise.all([
    db.event.findMany({ where: { traceId }, orderBy: { createdAt: "asc" }, include: { agent: true, task: true, approval: true, commandQueue: true } }),
    db.task.findMany({ where: { traceId }, orderBy: { createdAt: "asc" }, include: { agent: true, project: true } }),
    db.approval.findMany({ where: { traceId }, orderBy: { createdAt: "asc" } }),
    db.commandQueue.findMany({ where: { traceId }, orderBy: { createdAt: "asc" } }),
    db.run.findMany({ where: { traceId }, orderBy: { startedAt: "asc" }, include: { steps: { include: { modelCalls: true, toolCalls: true }, orderBy: { index: "asc" } } } }),
    db.verification.findMany({ where: { traceId }, orderBy: { createdAt: "asc" } })
  ]);
  if (events.length + tasks.length + approvals.length + commands.length + runs.length + verifications.length === 0) notFound();
  const modelCalls = runs.flatMap((run) => run.steps.flatMap((step) => step.modelCalls));
  const toolCalls = runs.flatMap((run) => run.steps.flatMap((step) => step.toolCalls));
  const totalCost = modelCalls.reduce((sum, call) => sum + call.costUsd, 0);
  const totalTokens = modelCalls.reduce((sum, call) => sum + call.inputTokens + call.outputTokens + call.cacheTokens, 0);
  const avgLatency = Math.round(modelCalls.reduce((sum, call) => sum + call.latencyMs, 0) / Math.max(1, modelCalls.length));

  return <>
    <div className="page-head"><div className="titles"><Link href="/control" className="btn ghost sm">← Control</Link><h1>Trace {traceId}</h1><div className="sub">events/tasks/commands/model/tool calls actual timeline</div></div></div>
    <div className="grid-12" style={{ marginBottom: 20 }}>
      <div className="span-3 card"><div className="card-body"><div className="muted">Events</div><h2>{events.length}</h2></div></div>
      <div className="span-3 card"><div className="card-body"><div className="muted">Commands</div><h2>{commands.length}</h2></div></div>
      <div className="span-3 card"><div className="card-body"><div className="muted">Model cost/tokens</div><h2>${totalCost.toFixed(4)} · {totalTokens}</h2></div></div>
      <div className="span-3 card"><div className="card-body"><div className="muted">Avg latency</div><h2>{avgLatency}ms</h2></div></div>
    </div>
    <div className="grid-12">
      <div className="span-8 card"><div className="card-head"><div className="title">Timeline</div></div><div className="card-body flush"><table className="tbl"><thead><tr><th>Time</th><th>Kind</th><th>Message</th><th>Status</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{formatDateTimeKo(event.createdAt)}</td><td>{event.type}</td><td>{event.message}<div className="muted">{[event.agent?.name, event.task?.title, event.approval?.title].filter(Boolean).join(" · ")}</div></td><td><StatusBadge label={event.severity} /></td></tr>)}</tbody></table></div></div>
      <div className="span-4 vstack" style={{ gap: 16 }}>
        <div className="card"><div className="card-head"><div className="title">Commands</div></div><div className="card-body vstack" style={{ gap: 8 }}>{commands.map((cmd) => <div className="path" key={cmd.id}><span className="sev ok" /><span>{cmd.actionType}<div className="muted">{cmd.status} · {cmd.riskLevel}</div></span></div>)}{commands.length === 0 && <div className="empty">command 없음</div>}</div></div>
        <div className="card"><div className="card-head"><div className="title">Model / Tool Calls</div></div><div className="card-body"><div className="muted">modelCalls {modelCalls.length} · toolCalls {toolCalls.length}</div><pre className="codeblock">{safeJson({ modelCalls: modelCalls.slice(0, 10), toolCalls: toolCalls.slice(0, 10) })}</pre></div></div>
        <div className="card"><div className="card-head"><div className="title">Verifications</div></div><div className="card-body vstack" style={{ gap: 8 }}>{verifications.map((v) => <div key={v.id}>{v.verifier} · <StatusBadge label={v.status} /><pre className="codeblock">{safeJson(v.evidence)}</pre></div>)}{verifications.length === 0 && <div className="empty">verification 없음</div>}</div></div>
      </div>
    </div>
  </>;
}
