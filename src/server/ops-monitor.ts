import { compareCompanyAgents, workAgentWhereClause } from "@/lib/agent-visibility";
import { db } from "@/lib/db";
import type { Agent, AgentStatus, Artifact, Event, Task, TaskStatus } from "@prisma/client";

export type HeartbeatState = "live" | "stale" | "not_reported";
export type AgentRuntimeState = "process_live" | "workflow_running" | "waiting" | "idle" | "failed_or_blocked";

export type AgentOpsInput = {
  slug: string;
  status: AgentStatus;
  currentTask: string | null;
  heartbeatAt: Date | null;
};

export function heartbeatState(heartbeatAt: Date | null, now = new Date(), staleAfterMs = 3 * 60 * 1000): HeartbeatState {
  if (!heartbeatAt) return "not_reported";
  return now.getTime() - heartbeatAt.getTime() <= staleAfterMs ? "live" : "stale";
}

export function hqOrchestrationStatusFromChildren(childStatuses: TaskStatus[]): TaskStatus {
  if (childStatuses.length === 0) return "completed";
  return childStatuses.every((status) => status === "completed" || status === "failed") ? "completed" : "running";
}

export function summarizeAgentOps(agent: AgentOpsInput, now = new Date()) {
  const heartbeat = heartbeatState(agent.heartbeatAt, now);
  const runtime: AgentRuntimeState = agent.status === "blocked" || agent.status === "failed" || agent.status === "offline"
    ? "failed_or_blocked"
    : agent.status === "waiting_approval"
      ? "waiting"
      : heartbeat === "live" && agent.status === "running"
        ? "process_live"
        : agent.status === "running"
          ? "workflow_running"
          : "idle";
  const operatorAction = runtime === "failed_or_blocked"
    ? "승인/오류 확인"
    : runtime === "workflow_running"
      ? "작업 진행 확인"
      : runtime === "waiting"
        ? "승인/게이트 확인"
        : runtime === "process_live"
          ? "모니터링 유지"
          : "대기";
  return { slug: agent.slug, runtime, heartbeat, operatorAction };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export type AgentOpsMonitorItem = {
  agent: Agent;
  runtime: ReturnType<typeof summarizeAgentOps>;
  activeTasks: Task[];
  recentTasks: Task[];
  recentEvents: Event[];
  recentArtifacts: Artifact[];
  taskCounts: Record<"queued" | "running" | "waiting_approval" | "needs_changes" | "completed" | "failed", number>;
};

export type CompanyOpsMonitor = {
  generatedAt: Date;
  agents: AgentOpsMonitorItem[];
  totals: {
    agents: number;
    processLive: number;
    workflowRunning: number;
    waiting: number;
    failedOrBlocked: number;
    staleHeartbeat: number;
    activeTasks: number;
    queuedReports: number;
    pendingApprovals: number;
  };
};

const ACTIVE_TASK_STATUSES: TaskStatus[] = ["queued", "running", "waiting_approval", "needs_changes"];

function countTasks(tasks: Task[]): AgentOpsMonitorItem["taskCounts"] {
  return tasks.reduce<AgentOpsMonitorItem["taskCounts"]>((counts, task) => {
    counts[task.status] += 1;
    return counts;
  }, { queued: 0, running: 0, waiting_approval: 0, needs_changes: 0, completed: 0, failed: 0 });
}

export async function getCompanyOpsMonitor(now = new Date()): Promise<CompanyOpsMonitor> {
  const [agentsRaw, queuedReportEvents, pendingApprovals] = await Promise.all([
    db.agent.findMany({
      where: workAgentWhereClause(),
      orderBy: { updatedAt: "desc" },
      include: {
        tasks: { orderBy: { updatedAt: "desc" }, take: 20 },
        events: { orderBy: { createdAt: "desc" }, take: 8 },
        artifacts: { orderBy: { updatedAt: "desc" }, take: 6 }
      }
    }),
    db.event.findMany({ where: { type: "discord.report.queued" }, select: { metadata: true } }),
    db.approval.count({ where: { status: { in: ["pending", "approved_waiting_execution", "executing", "needs_changes", "manual_handoff"] } } })
  ]);

  const agents = agentsRaw.sort(compareCompanyAgents).map((agent) => {
    const activeTasks = agent.tasks.filter((task) => ACTIVE_TASK_STATUSES.includes(task.status));
    return {
      agent,
      runtime: summarizeAgentOps(agent, now),
      activeTasks,
      recentTasks: agent.tasks,
      recentEvents: agent.events,
      recentArtifacts: agent.artifacts,
      taskCounts: countTasks(agent.tasks)
    };
  });

  const queuedReports = queuedReportEvents.filter((event) => {
    const metadata = event.metadata as unknown;
    return !isRecord(metadata) || !metadata.deliveredAt;
  }).length;

  return {
    generatedAt: now,
    agents,
    totals: {
      agents: agents.length,
      processLive: agents.filter((item) => item.runtime.runtime === "process_live").length,
      workflowRunning: agents.filter((item) => item.runtime.runtime === "workflow_running").length,
      waiting: agents.filter((item) => item.runtime.runtime === "waiting").length,
      failedOrBlocked: agents.filter((item) => item.runtime.runtime === "failed_or_blocked").length,
      staleHeartbeat: agents.filter((item) => item.runtime.heartbeat === "stale").length,
      activeTasks: agents.reduce((total, item) => total + item.activeTasks.length, 0),
      queuedReports,
      pendingApprovals
    }
  };
}

export async function syncHqOrchestrationRuntime(now = new Date()): Promise<{ reconciled: number; runningParents: number; completedParents: number }> {
  const parents = await db.task.findMany({
    where: { agent: { slug: "hq-agent" }, summary: { startsWith: "HQ 오케스트레이션:" } },
    select: { id: true, status: true, agentId: true }
  });

  let reconciled = 0;
  let runningParents = 0;
  let completedParents = 0;
  for (const parent of parents) {
    const delegationEvents = await db.event.findMany({ where: { type: "hq.delegation.created" }, select: { metadata: true } });
    const childTaskIds = delegationEvents
      .map((event) => event.metadata as unknown)
      .filter(isRecord)
      .filter((metadata) => metadata.parentTaskId === parent.id && typeof metadata.childTaskId === "string")
      .map((metadata) => metadata.childTaskId as string);
    if (childTaskIds.length === 0) continue;

    const children = await db.task.findMany({ where: { id: { in: childTaskIds } }, select: { status: true } });
    const targetStatus = hqOrchestrationStatusFromChildren(children.map((child) => child.status));
    if (targetStatus === "running") runningParents += 1;
    if (targetStatus === "completed") completedParents += 1;
    if (parent.status === targetStatus) continue;

    await db.task.update({
      where: { id: parent.id },
      data: {
        status: targetStatus,
        blocker: null,
        nextAction: targetStatus === "running" ? "하위 에이전트 작업 진행 중" : `HQ delegated work completed at ${now.toISOString()}`
      }
    });
    if (parent.agentId) {
      await db.agent.update({
        where: { id: parent.agentId },
        data: targetStatus === "running" ? { status: "running", currentTask: "HQ 오케스트레이션 진행 중" } : { status: "idle", currentTask: null }
      });
    }
    await db.event.create({
      data: {
        type: "ops.runtime.reconciled",
        severity: "info",
        message: `HQ orchestration runtime reconciled: ${targetStatus}`,
        taskId: parent.id,
        agentId: parent.agentId ?? undefined,
        metadata: { targetStatus, childTaskCount: childTaskIds.length, reconciledAt: now.toISOString() }
      }
    });
    reconciled += 1;
  }
  return { reconciled, runningParents, completedParents };
}
