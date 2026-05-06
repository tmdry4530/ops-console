import { AgentStatusGrid } from "@/components/agent-status-grid";
import { compareCompanyAgents, workAgentWhereClause } from "@/lib/agent-visibility";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const agents = (await db.agent.findMany({ where: workAgentWhereClause(), orderBy: { updatedAt: "desc" } })).sort(compareCompanyAgents);
  const healthy = agents.filter((a) => a.health === "ok").length;
  const degraded = agents.filter((a) => a.health !== "ok").length;

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>Company 에이전트</h1>
          <div className="sub">hq/dev/research 등 Company 작업 에이전트 {agents.length}개 · 정상 {healthy}개 · 주의 필요 {degraded}개</div>
        </div>
      </div>
      <AgentStatusGrid agents={agents} columns={3} />
    </>
  );
}
