import { db } from "@/lib/db";
import type { AgentStatus, ApprovalStatus, ApprovalType, EventSeverity, RiskLevel, TaskStatus } from "@prisma/client";

export const AUTONOMOUS_WORK_AGENT_SLUGS = [
  "main-agent",
  "research-agent",
  "projects-agent",
  "dev-agent",
  "content-agent",
  "trading-agent",
  "docs-agent"
] as const;

export type AutonomousTaskRecord = {
  id: string;
  title: string;
  summary: string | null;
  riskLevel: RiskLevel;
  projectId?: string | null;
  agent: {
    id: string;
    slug: string;
    name: string;
  } | null;
};

type AutonomousEventPlan = {
  type: string;
  severity: EventSeverity;
  message: string;
  metadata: Record<string, string | number | boolean | null>;
};

type AutonomousApprovalPlan = {
  type: ApprovalType;
  status: ApprovalStatus;
  riskLevel: RiskLevel;
  title: string;
  summary: string;
  requestedBy: string;
};

export type AutonomousTaskRunPlan = {
  kind: "execute_safe_task" | "request_console_approval" | "skip";
  taskStatus?: TaskStatus;
  agentStatus?: AgentStatus;
  taskNextAction?: string;
  approval?: AutonomousApprovalPlan;
  events: AutonomousEventPlan[];
};

export type AutonomousTaskRunResult = {
  status: "completed" | "waiting_approval" | "skipped";
  reason?: string;
  taskId?: string;
  agentSlug?: string;
  completedParentTaskIds?: string[];
};

export function shouldCompleteHqParent(childStatuses: TaskStatus[]): boolean {
  return childStatuses.length > 0 && childStatuses.every((status) => status === "completed" || status === "failed");
}

function isSafeAutonomousRisk(riskLevel: RiskLevel): boolean {
  return riskLevel === "low" || riskLevel === "medium";
}

function timestamp(now: Date): string {
  return now.toISOString();
}

export function planAutonomousTaskRun(task: AutonomousTaskRecord, now = new Date()): AutonomousTaskRunPlan {
  if (!task.agent || !AUTONOMOUS_WORK_AGENT_SLUGS.includes(task.agent.slug as (typeof AUTONOMOUS_WORK_AGENT_SLUGS)[number])) {
    return { kind: "skip", events: [] };
  }

  const executedAt = timestamp(now);
  const baseMetadata = {
    taskId: task.id,
    agentSlug: task.agent.slug,
    mode: "autonomous_agent_worker",
    executedAt
  };

  if (!isSafeAutonomousRisk(task.riskLevel)) {
    return {
      kind: "request_console_approval",
      taskStatus: "waiting_approval",
      agentStatus: "waiting_approval",
      taskNextAction: "Ops Console 승인 대기 · Discord는 결과/상태 보고만 수행",
      approval: {
        type: "other",
        status: "pending",
        riskLevel: task.riskLevel,
        title: `자율 작업 승인 필요 · ${task.agent.name}`,
        summary: `자율 에이전트가 고위험 작업을 감지해 콘솔 승인을 요청했습니다.\n\n작업: ${task.title}\n요약: ${task.summary ?? "없음"}`,
        requestedBy: "autonomous-agent-worker"
      },
      events: [
        {
          type: "agent.autonomy.approval_requested",
          severity: "warning",
          message: `Autonomous agent requested Ops Console approval: ${task.agent.slug}`,
          metadata: { ...baseMetadata, riskLevel: task.riskLevel, approvalTarget: "ops_console" }
        },
        {
          type: "discord.report.queued",
          severity: "info",
          message: `Discord status report queued: ${task.agent.slug}`,
          metadata: { ...baseMetadata, purpose: "status_report", approvalRequest: false, consoleApprovalId: "pending" }
        }
      ]
    };
  }

  return {
    kind: "execute_safe_task",
    taskStatus: "completed",
    agentStatus: "idle",
    taskNextAction: `자율 작업 완료: ${executedAt}`,
    events: [
      {
        type: "agent.autonomy.started",
        severity: "info",
        message: `Autonomous agent started task: ${task.agent.slug}`,
        metadata: { ...baseMetadata, riskLevel: task.riskLevel }
      },
      {
        type: "agent.autonomy.completed",
        severity: "info",
        message: `Autonomous agent completed task: ${task.agent.slug}`,
        metadata: { ...baseMetadata, riskLevel: task.riskLevel }
      },
      {
        type: "discord.report.queued",
        severity: "info",
        message: `Discord result report queued: ${task.agent.slug}`,
        metadata: { ...baseMetadata, purpose: "result_report", approvalRequest: false }
      }
    ]
  };
}

export async function completeFinishedHqParents(childTaskId: string, now = new Date()): Promise<string[]> {
  const delegationEvents = await db.event.findMany({
    where: { type: "hq.delegation.created", taskId: childTaskId },
    select: { metadata: true }
  });
  const parentTaskIds: string[] = Array.from(new Set<string>(delegationEvents
    .map((event) => event.metadata as Record<string, unknown>)
    .map((metadata) => metadata.parentTaskId)
    .filter((parentTaskId): parentTaskId is string => typeof parentTaskId === "string")));

  const completedParentTaskIds: string[] = [];
  for (const parentTaskId of parentTaskIds) {
    const siblingEvents = await db.event.findMany({
      where: { type: "hq.delegation.created" },
      select: { metadata: true }
    });
    const childTaskIds = siblingEvents
      .map((event) => event.metadata as Record<string, unknown>)
      .filter((metadata) => metadata.parentTaskId === parentTaskId && typeof metadata.childTaskId === "string")
      .map((metadata) => metadata.childTaskId as string);
    const childTasks = await db.task.findMany({ where: { id: { in: childTaskIds } }, select: { status: true } });
    if (!shouldCompleteHqParent(childTasks.map((task) => task.status))) continue;

    await db.task.update({
      where: { id: parentTaskId },
      data: { status: "completed", blocker: null, nextAction: `HQ delegated work completed at ${now.toISOString()}` }
    });
    await db.event.create({
      data: {
        type: "hq.orchestration.completed",
        severity: "info",
        message: "HQ orchestration completed",
        taskId: parentTaskId,
        metadata: { completedAt: now.toISOString(), childTaskCount: childTaskIds.length }
      }
    });
    completedParentTaskIds.push(parentTaskId);
  }

  return completedParentTaskIds;
}

export async function processAutonomousTask(task: AutonomousTaskRecord, now = new Date()): Promise<AutonomousTaskRunResult> {
  const plan = planAutonomousTaskRun(task, now);
  if (plan.kind === "skip" || !task.agent) {
    return { status: "skipped", reason: "not_autonomous_work_agent", taskId: task.id, agentSlug: task.agent?.slug };
  }

  if (plan.kind === "request_console_approval" && plan.approval) {
    const existingApproval = await db.approval.findFirst({
      where: { taskId: task.id, status: { in: ["pending", "approved_waiting_execution", "executing"] } },
      select: { id: true }
    });
    const approval = existingApproval ?? await db.approval.create({
      data: {
        ...plan.approval,
        taskId: task.id,
        projectId: task.projectId ?? undefined
      },
      select: { id: true }
    });

    await db.$transaction([
      db.task.update({ where: { id: task.id }, data: { status: plan.taskStatus, nextAction: plan.taskNextAction } }),
      db.agent.update({ where: { id: task.agent.id }, data: { status: plan.agentStatus, currentTask: task.title } }),
      ...plan.events.map((event) => db.event.create({
        data: {
          ...event,
          metadata: { ...event.metadata, consoleApprovalId: approval.id },
          agentId: task.agent!.id,
          projectId: task.projectId ?? undefined,
          taskId: task.id,
          approvalId: approval.id
        }
      }))
    ]);
    return { status: "waiting_approval", taskId: task.id, agentSlug: task.agent.slug };
  }

  await db.$transaction([
    db.agent.update({ where: { id: task.agent.id }, data: { status: "running", currentTask: task.title } }),
    ...plan.events.slice(0, 1).map((event) => db.event.create({
      data: { ...event, agentId: task.agent!.id, projectId: task.projectId ?? undefined, taskId: task.id }
    })),
    db.task.update({ where: { id: task.id }, data: { status: plan.taskStatus, blocker: null, nextAction: plan.taskNextAction } }),
    db.agent.update({ where: { id: task.agent.id }, data: { status: plan.agentStatus, currentTask: null } }),
    ...plan.events.slice(1).map((event) => db.event.create({
      data: { ...event, agentId: task.agent!.id, projectId: task.projectId ?? undefined, taskId: task.id }
    }))
  ]);

  const completedParentTaskIds = await completeFinishedHqParents(task.id, now);

  return { status: "completed", taskId: task.id, agentSlug: task.agent.slug, completedParentTaskIds };
}

export async function processNextAutonomousTask(now = new Date()): Promise<AutonomousTaskRunResult> {
  const task = await db.task.findFirst({
    where: {
      status: "running",
      agent: { slug: { in: [...AUTONOMOUS_WORK_AGENT_SLUGS] } }
    },
    orderBy: { updatedAt: "asc" },
    select: {
      id: true,
      title: true,
      summary: true,
      riskLevel: true,
      projectId: true,
      agent: { select: { id: true, slug: true, name: true } }
    }
  });

  if (!task) {
    return { status: "skipped", reason: "no_running_autonomous_tasks" };
  }

  return processAutonomousTask(task, now);
}
