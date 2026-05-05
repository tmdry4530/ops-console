import { AgentStatusGrid } from "@/components/agent-status-grid";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const agents = await db.agent.findMany({ orderBy: { updatedAt: "desc" } });
  const healthy = agents.filter((a) => a.health === "ok").length;
  const degraded = agents.filter((a) => a.health !== "ok").length;

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>Agents</h1>
          <div className="sub">{agents.length} agents · {healthy} healthy · {degraded} degraded</div>
        </div>
      </div>
      <AgentStatusGrid agents={agents} columns={3} />
    </>
  );
}
