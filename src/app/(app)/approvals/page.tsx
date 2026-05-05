import type { Route } from "next";
import Link from "next/link";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const approvals = await db.approval.findMany({ orderBy: { updatedAt: "desc" }, include: { project: true, task: true } });
  return (
    <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent)]">Audited decisions</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Approvals</h2>
        </div>
        <StatusBadge label={`${approvals.length} total`} tone="neutral" />
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {approvals.map((approval) => (
          <Link className="rounded-2xl border border-[var(--line)] bg-[#07110f] p-4 transition hover:border-[var(--accent)]" href={`/approvals/${approval.id}` as Route} key={approval.id}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{approval.title}</p>
              <RiskBadge risk={approval.riskLevel} />
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">{approval.status} · {approval.project?.name ?? "No project"}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">{approval.summary}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
