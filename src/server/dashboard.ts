import { workAgentWhereClause } from "@/lib/agent-visibility";
import { db } from "@/lib/db";

const workAgentEventWhere = { OR: [{ agentId: null }, { agent: { is: workAgentWhereClause() } }] };

export async function getDashboardSummary() {
  const [agents, projects, tasks, approvals, artifacts, criticalEvents, recentEvents] = await Promise.all([
    db.agent.findMany({ where: workAgentWhereClause(), orderBy: { updatedAt: "desc" }, take: 12 }),
    db.project.findMany({ orderBy: { updatedAt: "desc" }, take: 12 }),
    db.task.findMany({ orderBy: { updatedAt: "desc" }, take: 12 }),
    db.approval.findMany({ where: { status: { in: ["pending", "approved_waiting_execution", "executing", "needs_changes", "manual_handoff"] } }, orderBy: { updatedAt: "desc" }, take: 12 }),
    db.artifact.findMany({ orderBy: { updatedAt: "desc" }, take: 12 }),
    db.event.findMany({ where: { AND: [{ severity: "critical" }, workAgentEventWhere] }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.event.findMany({ where: workAgentEventWhere, orderBy: { createdAt: "desc" }, take: 8 })
  ]);

  const failedJobs = tasks.filter((task) => task.status === "failed").length;
  const activeTasks = tasks.filter((task) => ["queued", "running", "waiting_approval", "needs_changes"].includes(task.status)).length;
  const highestPriorityNextAction = approvals[0]?.title ?? projects.find((project) => project.nextAction)?.nextAction ?? "No action queued";

  return { agents, projects, tasks, approvals, artifacts, criticalEvents, recentEvents, failedJobs, activeTasks, highestPriorityNextAction };
}
