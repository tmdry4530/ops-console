import { notFound } from "next/navigation";
import { ArtifactLink } from "@/components/artifact-link";
import { EventTimeline } from "@/components/event-timeline";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await db.agent.findUnique({ where: { id }, include: { tasks: true, artifacts: true, events: { orderBy: { createdAt: "desc" }, take: 25 } } });
  if (!agent) notFound();

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.28em] text-[var(--accent)]">{agent.slug}</p><h2 className="mt-2 text-2xl font-semibold">{agent.name}</h2></div><div className="flex gap-2"><StatusBadge label={agent.status} tone="neutral" /><StatusBadge label={agent.health} tone={agent.health === "ok" ? "ok" : "warning"} /></div></div>
        <dl className="mt-5 grid gap-3 md:grid-cols-3"><div className="rounded-2xl border border-[var(--line)] p-4"><dt className="text-xs text-[var(--muted)]">Heartbeat</dt><dd>{agent.heartbeatAt?.toISOString() ?? "not reported"}</dd></div><div className="rounded-2xl border border-[var(--line)] p-4"><dt className="text-xs text-[var(--muted)]">Current task</dt><dd>{agent.currentTask ?? "none"}</dd></div><div className="rounded-2xl border border-[var(--line)] p-4"><dt className="text-xs text-[var(--muted)]">Permissions</dt><dd>policy-governed placeholder</dd></div></dl>
      </div>
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6"><h3 className="text-xl font-semibold">Tasks</h3><div className="mt-4 space-y-3">{agent.tasks.map((task) => <div className="rounded-2xl border border-[var(--line)] bg-[#07110f] p-4" key={task.id}>{task.title} · {task.status}</div>)}</div></section>
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6"><h3 className="text-xl font-semibold">Artifacts</h3><div className="mt-4 grid gap-3 md:grid-cols-2">{agent.artifacts.map((artifact) => <ArtifactLink key={artifact.id} path={artifact.path} restricted={artifact.restricted} title={artifact.title} />)}</div></section>
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6"><h3 className="text-xl font-semibold">Logs placeholder</h3><p className="mt-2 text-sm text-[var(--muted)]">Raw logs are intentionally not pasted into chat/UI; future log adapters should link to artifacts or restricted log stores.</p></section>
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6"><h3 className="text-xl font-semibold">Timeline</h3><div className="mt-4"><EventTimeline events={agent.events} /></div></section>
    </section>
  );
}
