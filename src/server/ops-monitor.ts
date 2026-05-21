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

function slugStamp(now: Date) {
  return now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 17);
}

function isTerminalTaskStatus(status: TaskStatus) {
  return status === "completed" || status === "failed";
}

export type HqAggregationRuntime = {
  id: string;
  status: TaskStatus;
  verifierPassed: boolean;
} | null;

export type HqOrchestrationRuntimeTransition = {
  parentTask: { status: TaskStatus; blocker: null; nextAction: string };
  parentAgent: { status: AgentStatus; currentTask: string | null };
  eventMetadata: {
    mode: "orchestration_parent";
    currentStep: "awaiting_child_results" | "aggregation_pending" | "awaiting_verifier" | "final_completed";
    statusReason: "delegation_completed" | "children_terminal" | "verifier_pending" | "aggregation_verified";
    childTaskIds: string[];
    childTaskCount: number;
    terminalChildTaskCount: number;
    aggregationTaskId?: string;
  };
  createAggregationTask: boolean;
  aggregationTask?: {
    slugSuffix: string;
    title: string;
    status: TaskStatus;
    riskLevel: "low";
    summary: string;
    nextAction: string;
  };
  completeParent: boolean;
};

export function hqOrchestrationStatusFromChildren(childStatuses: TaskStatus[]): TaskStatus {
  if (childStatuses.length === 0) return "completed";
  // TaskStatus has no waiting_children/planned enum today. Use queued as the
  // non-running delegated-equivalent, with nextAction/event metadata carrying
  // currentStep=statusReason for the operator UI.
  return "queued";
}

export function planHqOrchestrationRuntimeTransition(input: {
  childStatuses: TaskStatus[];
  childTaskIds: string[];
  aggregationTask: HqAggregationRuntime;
  now: Date;
}): HqOrchestrationRuntimeTransition {
  const terminalChildTaskCount = input.childStatuses.filter(isTerminalTaskStatus).length;
  const childTaskCount = input.childStatuses.length;
  const baseMetadata = {
    mode: "orchestration_parent" as const,
    childTaskIds: input.childTaskIds,
    childTaskCount,
    terminalChildTaskCount
  };

  if (input.aggregationTask?.status === "completed" && input.aggregationTask.verifierPassed) {
    return {
      parentTask: {
        status: "completed",
        blocker: null,
        nextAction: `final_completed · aggregation verified at ${input.now.toISOString()}`
      },
      parentAgent: { status: "idle", currentTask: null },
      eventMetadata: {
        ...baseMetadata,
        currentStep: "final_completed",
        statusReason: "aggregation_verified",
        aggregationTaskId: input.aggregationTask.id
      },
      createAggregationTask: false,
      completeParent: true
    };
  }

  if (input.aggregationTask?.status === "completed") {
    return {
      parentTask: {
        status: "queued",
        blocker: null,
        nextAction: "aggregation_completed · verifier pending · completed 전 verifier gate 유지"
      },
      parentAgent: { status: "idle", currentTask: null },
      eventMetadata: {
        ...baseMetadata,
        currentStep: "awaiting_verifier",
        statusReason: "verifier_pending",
        aggregationTaskId: input.aggregationTask.id
      },
      createAggregationTask: false,
      completeParent: false
    };
  }

  if (input.aggregationTask) {
    return {
      parentTask: {
        status: "queued",
        blocker: null,
        nextAction: `aggregation_pending · ${terminalChildTaskCount}/${childTaskCount} child tasks terminal · aggregation task ${input.aggregationTask.status}`
      },
      parentAgent: { status: "idle", currentTask: null },
      eventMetadata: {
        ...baseMetadata,
        currentStep: "aggregation_pending",
        statusReason: "children_terminal",
        aggregationTaskId: input.aggregationTask.id
      },
      createAggregationTask: false,
      completeParent: false
    };
  }

  if (childTaskCount > 0 && terminalChildTaskCount === childTaskCount) {
    return {
      parentTask: {
        status: "queued",
        blocker: null,
        nextAction: `aggregation_pending · ${terminalChildTaskCount}/${childTaskCount} child tasks terminal · verifier gate required before completion`
      },
      parentAgent: { status: "idle", currentTask: null },
      eventMetadata: {
        ...baseMetadata,
        currentStep: "aggregation_pending",
        statusReason: "children_terminal"
      },
      createAggregationTask: true,
      aggregationTask: {
        slugSuffix: `aggregation-${slugStamp(input.now)}`,
        title: "HQ aggregation · child task terminal review",
        status: "queued",
        riskLevel: "low",
        summary: "Aggregate child terminal outputs for parent orchestration task",
        nextAction: "main-agent aggregation queued · verifier evidence required before parent completion"
      },
      completeParent: false
    };
  }

  return {
    parentTask: {
      status: hqOrchestrationStatusFromChildren(input.childStatuses),
      blocker: null,
      nextAction: `waiting_children · ${terminalChildTaskCount}/${childTaskCount} child tasks terminal · currentStep=awaiting_child_results · statusReason=delegation_completed`
    },
    parentAgent: { status: "idle", currentTask: null },
    eventMetadata: {
      ...baseMetadata,
      currentStep: "awaiting_child_results",
      statusReason: "delegation_completed"
    },
    createAggregationTask: false,
    completeParent: false
  };
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
    where: { agent: { slug: { in: ["hq-agent", "main-agent"] } }, summary: { startsWith: "HQ 오케스트레이션:" } },
    select: { id: true, slug: true, title: true, status: true, nextAction: true, agentId: true, projectId: true }
  });

  let reconciled = 0;
  let runningParents = 0;
  let completedParents = 0;
  for (const parent of parents) {
    const delegationEvents = await db.event.findMany({
      where: { type: "hq.delegation.created" },
      select: { metadata: true }
    });
    const childTaskIds = delegationEvents
      .map((event) => event.metadata as unknown)
      .filter(isRecord)
      .filter((metadata) => metadata.parentTaskId === parent.id && typeof metadata.childTaskId === "string")
      .map((metadata) => metadata.childTaskId as string);
    if (childTaskIds.length === 0) continue;

    const children = await db.task.findMany({ where: { id: { in: childTaskIds } }, select: { status: true } });
    const aggregationEvents = await db.event.findMany({
      where: { type: "hq.aggregation.created" },
      select: { metadata: true },
      orderBy: { createdAt: "desc" },
      take: 20
    });
    const aggregationTaskId = aggregationEvents
      .map((event) => event.metadata as unknown)
      .filter(isRecord)
      .filter((metadata) => metadata.parentTaskId === parent.id)
      .map((metadata) => metadata.aggregationTaskId)
      .find((value): value is string => typeof value === "string") ?? null;
    const aggregationRow = aggregationTaskId
      ? await db.task.findUnique({
          where: { id: aggregationTaskId },
          select: {
            id: true,
            status: true,
            events: { select: { type: true, message: true, metadata: true }, orderBy: { createdAt: "desc" }, take: 20 }
          }
        })
      : null;
    const verifierPassed = Boolean(aggregationRow?.events.some((event) => /verification|verifier/i.test(`${event.type} ${event.message}`) && /passed|complete|ok|success/i.test(`${event.type} ${event.message} ${JSON.stringify(event.metadata)}`)));
    const transition = planHqOrchestrationRuntimeTransition({
      childStatuses: children.map((child) => child.status),
      childTaskIds,
      aggregationTask: aggregationRow ? { id: aggregationRow.id, status: aggregationRow.status, verifierPassed } : null,
      now
    });

    if (transition.parentTask.status === "running") runningParents += 1;
    if (transition.parentTask.status === "completed") completedParents += 1;

    let createdAggregationTaskId: string | null = null;
    if (transition.createAggregationTask && transition.aggregationTask) {
      const mainAgent = await db.agent.findUnique({ where: { slug: "main-agent" }, select: { id: true } });
      const aggregation = await db.task.create({
        data: {
          slug: `${parent.slug}-${transition.aggregationTask.slugSuffix}`,
          title: transition.aggregationTask.title,
          status: transition.aggregationTask.status,
          riskLevel: transition.aggregationTask.riskLevel,
          summary: `${transition.aggregationTask.summary}: ${parent.id}`,
          nextAction: transition.aggregationTask.nextAction,
          agentId: mainAgent?.id ?? parent.agentId ?? undefined,
          projectId: parent.projectId ?? undefined
        },
        select: { id: true, slug: true }
      });
      createdAggregationTaskId = aggregation.id;
      await db.event.create({
        data: {
          type: "hq.aggregation.created",
          severity: "info",
          message: `HQ aggregation task queued: ${aggregation.slug}`,
          taskId: parent.id,
          agentId: mainAgent?.id ?? parent.agentId ?? undefined,
          metadata: {
            ...transition.eventMetadata,
            parentTaskId: parent.id,
            aggregationTaskId: aggregation.id,
            aggregationTaskSlug: aggregation.slug,
            stage: "aggregation_pending"
          }
        }
      });
    }

    const shouldUpdateParent = parent.status !== transition.parentTask.status || parent.nextAction !== transition.parentTask.nextAction;
    if (shouldUpdateParent) {
      await db.task.update({
        where: { id: parent.id },
        data: transition.parentTask
      });
    }
    if (parent.agentId) {
      await db.agent.update({
        where: { id: parent.agentId },
        data: transition.parentAgent
      });
    }
    if (shouldUpdateParent || createdAggregationTaskId) {
      await db.event.create({
        data: {
          type: transition.completeParent ? "final_completed" : "ops.runtime.reconciled",
          severity: "info",
          message: transition.completeParent ? "HQ orchestration final completed after verifier" : `HQ orchestration runtime reconciled: ${transition.eventMetadata.currentStep}`,
          taskId: parent.id,
          agentId: parent.agentId ?? undefined,
          metadata: {
            ...transition.eventMetadata,
            aggregationTaskId: createdAggregationTaskId ?? transition.eventMetadata.aggregationTaskId,
            targetStatus: transition.parentTask.status,
            reconciledAt: now.toISOString()
          }
        }
      });
      reconciled += 1;
    }
  }
  return { reconciled, runningParents, completedParents };
}
