import { notFound } from "next/navigation";
import { ApprovalActions } from "@/components/approval-actions";
import { ArtifactLink } from "@/components/artifact-link";
import { EventTimeline } from "@/components/event-timeline";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ApprovalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const approval = await db.approval.findUnique({
    where: { id },
    include: {
      project: { include: { artifacts: true, events: { orderBy: { createdAt: "desc" }, take: 20 } } },
      task: { include: { artifacts: true, events: { orderBy: { createdAt: "desc" }, take: 20 } } },
      events: { orderBy: { createdAt: "desc" }, take: 20 },
      commandQueues: { orderBy: { createdAt: "desc" } }
    }
  });
  if (!approval) notFound();

  const artifacts = [...(approval.project?.artifacts ?? []), ...(approval.task?.artifacts ?? [])].filter((artifact, index, list) => list.findIndex((item) => item.id === artifact.id) === index);
  const events = [...approval.events, ...(approval.project?.events ?? []), ...(approval.task?.events ?? [])].filter((event, index, list) => list.findIndex((item) => item.id === event.id) === index);

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent)]">{approval.type}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{approval.title}</h2>
          </div>
          <div className="flex gap-2"><RiskBadge risk={approval.riskLevel} /><StatusBadge label={approval.status} tone="neutral" /></div>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--muted)]">{approval.summary}</p>
        <dl className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--line)] p-4"><dt className="text-xs text-[var(--muted)]">Project</dt><dd className="mt-1">{approval.project?.name ?? "none"}</dd></div>
          <div className="rounded-2xl border border-[var(--line)] p-4"><dt className="text-xs text-[var(--muted)]">Task</dt><dd className="mt-1">{approval.task?.title ?? "none"}</dd></div>
          <div className="rounded-2xl border border-[var(--line)] p-4"><dt className="text-xs text-[var(--muted)]">Manual report</dt><dd className="mt-1">{approval.manualReportId ?? "not submitted"}</dd></div>
        </dl>
        <ApprovalActions approvalId={approval.id} />
      </div>
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
        <h3 className="text-xl font-semibold">Artifacts</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {artifacts.map((artifact) => <ArtifactLink key={artifact.id} path={artifact.path} restricted={artifact.restricted} title={`${artifact.type}: ${artifact.title}${artifact.commitSha ? ` @ ${artifact.commitSha}` : ""}`} />)}
        </div>
      </section>
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
        <h3 className="text-xl font-semibold">Command queue / handoff records</h3>
        <div className="mt-4 space-y-3">
          {approval.commandQueues.map((command) => <div className="rounded-2xl border border-[var(--line)] bg-[#07110f] p-4" key={command.id}>{command.actionType} · {command.status} · {command.riskLevel}</div>)}
        </div>
      </section>
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
        <h3 className="text-xl font-semibold">Timeline</h3>
        <div className="mt-4"><EventTimeline events={events} /></div>
      </section>
    </section>
  );
}
