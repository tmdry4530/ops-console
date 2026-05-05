import type { Route } from "next";
import Link from "next/link";
import { AgentStatusGrid } from "@/components/agent-status-grid";
import { ArtifactLink } from "@/components/artifact-link";
import { EventTimeline } from "@/components/event-timeline";
import { MetricCard } from "@/components/metric-card";
import { ProjectBoard } from "@/components/project-board";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
import { getDashboardSummary } from "@/server/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const summary = await getDashboardSummary();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-3xl border border-[var(--line)] bg-[var(--panel-strong)] p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-[var(--accent)]">Highest-priority next action</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{summary.highestPriorityNextAction}</h2>
        </div>
        <StatusBadge label={summary.criticalEvents.length > 0 ? "critical events" : "health ok"} tone={summary.criticalEvents.length > 0 ? "danger" : "ok"} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard detail="Current global status based on critical event count." label="Global health" value={summary.criticalEvents.length > 0 ? "RISK" : "OK"} />
        <MetricCard detail="Approvals requiring operator decision or follow-up." label="Pending approvals" value={String(summary.approvals.length)} />
        <MetricCard detail="Queued, running, waiting, or needs-change tasks." label="Active tasks" value={String(summary.activeTasks)} />
        <MetricCard detail="Failed task records from current data window." label="Failed jobs" value={String(summary.failedJobs)} />
      </div>
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-5">
        <h3 className="text-xl font-semibold">Pending approvals</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {summary.approvals.map((approval) => (
            <Link className="rounded-2xl border border-[var(--line)] bg-[#07110f] p-4 transition hover:border-[var(--accent)]" href={`/approvals/${approval.id}` as Route} key={approval.id}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{approval.title}</p>
                <RiskBadge risk={approval.riskLevel} />
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">{approval.status}</p>
            </Link>
          ))}
        </div>
      </section>
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-5">
        <h3 className="text-xl font-semibold">Agent status grid</h3>
        <div className="mt-4"><AgentStatusGrid agents={summary.agents} /></div>
      </section>
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-5">
        <h3 className="text-xl font-semibold">Projects</h3>
        <div className="mt-4"><ProjectBoard projects={summary.projects} /></div>
      </section>
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-5">
        <h3 className="text-xl font-semibold">Recent artifacts</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {summary.artifacts.map((artifact) => <ArtifactLink key={artifact.id} path={artifact.path} restricted={artifact.restricted} title={artifact.title} />)}
        </div>
      </section>
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-5">
        <h3 className="text-xl font-semibold">Recent critical/events</h3>
        <div className="mt-4"><EventTimeline events={summary.recentEvents} /></div>
      </section>
    </div>
  );
}
