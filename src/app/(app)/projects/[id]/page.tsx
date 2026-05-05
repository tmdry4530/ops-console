import { notFound } from "next/navigation";
import { ArtifactLink } from "@/components/artifact-link";
import { EventTimeline } from "@/components/event-timeline";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await db.project.findUnique({ where: { id }, include: { tasks: true, approvals: true, artifacts: true, events: { orderBy: { createdAt: "desc" }, take: 25 } } });
  if (!project) notFound();

  const revenue = project.revenueType ? "Revenue board: manual outreach path" : "Revenue board: no active revenue pipeline";
  const bounty = project.slug.includes("bounty") ? "Bounty board: submission and report tracking" : "Bounty board: no active bounty item";
  const crypto = project.slug.includes("crypto") ? "Crypto signal board: active" : "Crypto signal board: no active signal";

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.28em] text-[var(--accent)]">{project.slug}</p><h2 className="mt-2 text-2xl font-semibold">{project.name}</h2></div><StatusBadge label={project.status} tone={project.status === "blocked" ? "danger" : "neutral"} /></div><p className="mt-4 text-sm text-[var(--muted)]">Next: {project.nextAction ?? "none"}</p>{project.blocker ? <p className="mt-2 text-sm text-[var(--warning)]">Blocker: {project.blocker}</p> : null}</div>
      <div className="grid gap-3 md:grid-cols-3">{[revenue, bounty, crypto].map((item) => <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4" key={item}>{item}</div>)}</div>
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6"><h3 className="text-xl font-semibold">Approvals and blockers</h3><div className="mt-4 space-y-3">{project.approvals.map((approval) => <div className="rounded-2xl border border-[var(--line)] bg-[#07110f] p-4" key={approval.id}>{approval.title} · {approval.status}</div>)}</div></section>
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6"><h3 className="text-xl font-semibold">Tasks</h3><div className="mt-4 space-y-3">{project.tasks.map((task) => <div className="rounded-2xl border border-[var(--line)] bg-[#07110f] p-4" key={task.id}>{task.title} · {task.status}</div>)}</div></section>
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6"><h3 className="text-xl font-semibold">Artifacts</h3><div className="mt-4 grid gap-3 md:grid-cols-2">{project.artifacts.map((artifact) => <ArtifactLink key={artifact.id} path={artifact.path} restricted={artifact.restricted} title={artifact.title} />)}</div></section>
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6"><h3 className="text-xl font-semibold">Timeline</h3><div className="mt-4"><EventTimeline events={project.events} /></div></section>
    </section>
  );
}
