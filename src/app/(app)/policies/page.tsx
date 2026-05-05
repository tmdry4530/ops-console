import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  const policies = await db.policy.findMany({ orderBy: { actionType: "asc" } });
  return <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6"><h2 className="text-2xl font-semibold">Policies</h2><div className="mt-5 grid gap-3 md:grid-cols-2">{policies.map((policy) => <div className="rounded-2xl border border-[var(--line)] bg-[#07110f] p-4" key={policy.id}><div className="flex items-center justify-between"><p className="font-semibold">{policy.actionType}</p><StatusBadge label={policy.action} tone={policy.action === "block" ? "danger" : policy.action === "require_manual_handoff" ? "warning" : "neutral"} /></div><p className="mt-2 text-sm text-[var(--muted)]">{policy.description}</p></div>)}</div></section>;
}
