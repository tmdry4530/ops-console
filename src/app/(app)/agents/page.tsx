import type { Route } from "next";
import Link from "next/link";
import { AgentStatusGrid } from "@/components/agent-status-grid";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const agents = await db.agent.findMany({ orderBy: { updatedAt: "desc" } });
  return <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6"><h2 className="text-2xl font-semibold">Agents</h2><div className="mt-5"><AgentStatusGrid agents={agents} /></div><div className="mt-5 flex flex-wrap gap-2">{agents.map((agent) => <Link className="rounded-full border border-[var(--line)] px-3 py-2 text-sm hover:border-[var(--accent)]" href={`/agents/${agent.id}` as Route} key={agent.id}>Open {agent.slug}</Link>)}</div></section>;
}
