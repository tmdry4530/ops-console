import { db } from "@/lib/db";
import { requiresManualHandoff } from "@/lib/auth";
import { evaluateExternalSendPermission } from "./external-send-policy";
import type { ProjectStatus } from "@prisma/client";

export type CommandExecutionStatus = "completed" | "failed" | "skipped";

export type CommandExecutionResult = {
  status: CommandExecutionStatus;
  reason?: string;
  executedAt: string;
  mode?: "ops_console_worker" | "external_send_dry_run";
};

export type QueuedCommandRecord = {
  id: string;
  actionType: string;
  riskLevel: string;
  approvalId: string | null;
  payload: unknown;
};

export type CommandExecutionEvent = {
  type: string;
  severity: "info" | "warning" | "critical";
  message: string;
  commandQueueId: string;
  approvalId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

export type CommandExecutionPort = {
  markCommandRunning(id: string): Promise<void>;
  markApprovalExecuting(id: string): Promise<void>;
  completeCommand(id: string, result: CommandExecutionResult): Promise<void>;
  failCommand(id: string, result: CommandExecutionResult): Promise<void>;
  completeApproval(id: string, result: CommandExecutionResult): Promise<void>;
  completeTask(id: string, result: CommandExecutionResult): Promise<void>;
  updateProjectAfterCommand(id: string, actionType: string, result: CommandExecutionResult): Promise<void>;
  activateHqDelegations(parentTaskId: string, result: CommandExecutionResult): Promise<number>;
  createCommandEvent(event: CommandExecutionEvent): Promise<void>;
};

type CommandPayload = {
  projectId?: string | null;
  taskId?: string | null;
  agentId?: string | null;
  action?: string | null;
};

function readPayload(payload: unknown): CommandPayload {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    return {
      projectId: typeof record.projectId === "string" ? record.projectId : null,
      taskId: typeof record.taskId === "string" ? record.taskId : null,
      agentId: typeof record.agentId === "string" ? record.agentId : null,
      action: typeof record.action === "string" ? record.action : null
    };
  }
  return { projectId: null, taskId: null };
}

function result(status: CommandExecutionStatus, reason?: string, mode: CommandExecutionResult["mode"] = "ops_console_worker"): CommandExecutionResult {
  return { status, reason, executedAt: new Date().toISOString(), mode };
}

function isMetadataRecord(metadata: unknown): metadata is Record<string, unknown> {
  return Boolean(metadata) && typeof metadata === "object" && !Array.isArray(metadata);
}

export async function processCommand(command: QueuedCommandRecord, port: CommandExecutionPort): Promise<CommandExecutionResult> {
  const payload = readPayload(command.payload);

  if (command.actionType.startsWith("agent_control_")) {
    if (!payload.agentId || !payload.action) {
      const failed = result("failed", "missing_agent_control_payload");
      await port.failCommand(command.id, failed);
      return failed;
    }
    await port.markCommandRunning(command.id);
    const target = payload.action === "pause"
      ? { status: "blocked" as const, currentTask: "operator paused" }
      : payload.action === "resume"
        ? { status: "idle" as const, currentTask: null }
        : { status: "running" as const, currentTask: "operator retry requested" };
    await db.agent.update({ where: { id: payload.agentId }, data: target });
    const completed = result("completed", "agent_control_state_recorded");
    await port.completeCommand(command.id, completed);
    await port.createCommandEvent({
      type: "agent.control.completed",
      severity: "info",
      message: `Agent control completed: ${payload.action}`,
      commandQueueId: command.id,
      metadata: { actionType: command.actionType, riskLevel: command.riskLevel, agentId: payload.agentId, action: payload.action }
    });
    return completed;
  }

  if (command.actionType === "revenue_outreach" && !requiresManualHandoff(command.actionType, command.riskLevel)) {
    const externalSend = evaluateExternalSendPermission({ actionType: command.actionType, riskLevel: command.riskLevel, payload: command.payload });
    if (!externalSend.allowed) {
      const failed = result("failed", externalSend.reason);
      await port.failCommand(command.id, failed);
      await port.createCommandEvent({
        type: "external_send.blocked",
        severity: "warning",
        message: `External send blocked: ${externalSend.reason}`,
        commandQueueId: command.id,
        approvalId: command.approvalId,
        projectId: payload.projectId,
        taskId: payload.taskId,
        metadata: { actionType: command.actionType, riskLevel: command.riskLevel, reason: failed.reason ?? null }
      });
      return failed;
    }

    await port.markCommandRunning(command.id);
    if (command.approvalId) {
      await port.markApprovalExecuting(command.approvalId);
    }
    await port.createCommandEvent({
      type: externalSend.mode === "dry_run" ? "external_send.dry_run_started" : "external_send.started",
      severity: "info",
      message: `External send started: ${externalSend.channel}/${externalSend.recipientBatchId}`,
      commandQueueId: command.id,
      approvalId: command.approvalId,
      projectId: payload.projectId,
      taskId: payload.taskId,
      metadata: {
        actionType: command.actionType,
        riskLevel: command.riskLevel,
        channel: externalSend.channel,
        recipientBatchId: externalSend.recipientBatchId,
        draftArtifactId: externalSend.draftArtifactId,
        idempotencyKey: externalSend.idempotencyKey,
        dryRun: externalSend.mode === "dry_run"
      }
    });

    const completed = result("completed", externalSend.mode === "dry_run" ? "dry_run_no_external_message_sent" : undefined, externalSend.mode === "dry_run" ? "external_send_dry_run" : "ops_console_worker");
    await port.completeCommand(command.id, completed);
    if (command.approvalId) {
      await port.completeApproval(command.approvalId, completed);
    }
    if (payload.taskId) {
      await port.completeTask(payload.taskId, completed);
    }
    if (payload.projectId) {
      await port.updateProjectAfterCommand(payload.projectId, command.actionType, completed);
    }
    await port.createCommandEvent({
      type: externalSend.mode === "dry_run" ? "external_send.dry_run_completed" : "external_send.completed",
      severity: "info",
      message: `External send completed: ${externalSend.channel}/${externalSend.recipientBatchId}`,
      commandQueueId: command.id,
      approvalId: command.approvalId,
      projectId: payload.projectId,
      taskId: payload.taskId,
      metadata: {
        actionType: command.actionType,
        riskLevel: command.riskLevel,
        channel: externalSend.channel,
        recipientBatchId: externalSend.recipientBatchId,
        idempotencyKey: externalSend.idempotencyKey,
        dryRun: externalSend.mode === "dry_run",
        mode: completed.mode ?? null
      }
    });
    return completed;
  }

  if (requiresManualHandoff(command.actionType, command.riskLevel)) {
    const failed = result("failed", "manual_handoff_required");
    await port.failCommand(command.id, failed);
    await port.createCommandEvent({
      type: "command.blocked_manual_handoff",
      severity: "warning",
      message: `Command blocked by manual handoff policy: ${command.actionType}`,
      commandQueueId: command.id,
      approvalId: command.approvalId,
      projectId: payload.projectId,
      taskId: payload.taskId,
      metadata: { actionType: command.actionType, riskLevel: command.riskLevel, reason: failed.reason ?? null }
    });
    return failed;
  }

  await port.markCommandRunning(command.id);
  if (command.approvalId) {
    await port.markApprovalExecuting(command.approvalId);
  }
  await port.createCommandEvent({
    type: "command.started",
    severity: "info",
    message: `Command execution started: ${command.actionType}`,
    commandQueueId: command.id,
    approvalId: command.approvalId,
    projectId: payload.projectId,
    taskId: payload.taskId,
    metadata: { actionType: command.actionType, riskLevel: command.riskLevel }
  });

  const completed = result("completed");
  await port.completeCommand(command.id, completed);
  if (command.approvalId) {
    await port.completeApproval(command.approvalId, completed);
  }
  if (payload.taskId) {
    await port.completeTask(payload.taskId, completed);
    const activatedDelegations = await port.activateHqDelegations(payload.taskId, completed);
    if (activatedDelegations > 0) {
      await port.createCommandEvent({
        type: "hq.delegation.activated",
        severity: "info",
        message: `HQ delegated tasks activated: ${activatedDelegations}`,
        commandQueueId: command.id,
        approvalId: command.approvalId,
        projectId: payload.projectId,
        taskId: payload.taskId,
        metadata: { activatedDelegations }
      });
    }
  }
  if (payload.projectId) {
    await port.updateProjectAfterCommand(payload.projectId, command.actionType, completed);
  }
  await port.createCommandEvent({
    type: "command.completed",
    severity: "info",
    message: `Command execution completed: ${command.actionType}`,
    commandQueueId: command.id,
    approvalId: command.approvalId,
    projectId: payload.projectId,
    taskId: payload.taskId,
    metadata: { actionType: command.actionType, riskLevel: command.riskLevel, mode: completed.mode ?? null }
  });

  return completed;
}

export async function processNextQueuedCommand(port: CommandExecutionPort = prismaCommandExecutionPort): Promise<CommandExecutionResult> {
  const command = await db.commandQueue.findFirst({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
    select: { id: true, actionType: true, riskLevel: true, approvalId: true, payload: true }
  });

  if (!command) {
    return result("skipped", "no_queued_commands");
  }

  return processCommand(command, port);
}

export function projectUpdateForCommand(actionType: string, executionResult: CommandExecutionResult): { status: ProjectStatus; blocker: null; nextAction: string } {
  if (["revenue_outreach", "bounty_submission", "deploy", "public_disclosure"].includes(actionType)) {
    return { status: "submitted", blocker: null, nextAction: `Command executed at ${executionResult.executedAt}` };
  }

  return { status: "active", blocker: null, nextAction: `Operator instruction completed at ${executionResult.executedAt}` };
}

export const prismaCommandExecutionPort: CommandExecutionPort = {
  async markCommandRunning(id) {
    await db.commandQueue.update({ where: { id }, data: { status: "running" } });
  },
  async markApprovalExecuting(id) {
    await db.approval.update({ where: { id }, data: { status: "executing" } });
  },
  async completeCommand(id, executionResult) {
    await db.commandQueue.update({ where: { id }, data: { status: "completed", result: executionResult } });
  },
  async failCommand(id, executionResult) {
    await db.commandQueue.update({ where: { id }, data: { status: "failed", result: executionResult } });
  },
  async completeApproval(id, executionResult) {
    await db.approval.update({ where: { id }, data: { status: "completed", decisionNote: `Executed by Ops Console worker at ${executionResult.executedAt}` } });
  },
  async completeTask(id, executionResult) {
    await db.task.update({ where: { id }, data: { status: "completed", blocker: null, nextAction: `Command executed at ${executionResult.executedAt}` } });
  },
  async updateProjectAfterCommand(id, actionType, result) {
    await db.project.update({ where: { id }, data: projectUpdateForCommand(actionType, result) });
  },
  async activateHqDelegations(parentTaskId, executionResult) {
    const parentTask = await db.task.findUnique({
      where: { id: parentTaskId },
      select: { id: true, agentId: true, agent: { select: { slug: true } }, summary: true }
    });
    if (parentTask?.agent?.slug !== "hq-agent" || !parentTask.summary?.startsWith("HQ 오케스트레이션:")) {
      return 0;
    }

    const delegationEvents = await db.event.findMany({
      where: { type: "hq.delegation.created" },
      select: { metadata: true }
    });
    const childTaskIds = delegationEvents
      .map((event) => event.metadata as unknown)
      .filter(isMetadataRecord)
      .filter((metadata) => metadata.parentTaskId === parentTaskId && typeof metadata.childTaskId === "string")
      .map((metadata) => metadata.childTaskId as string);

    if (childTaskIds.length === 0) {
      return 0;
    }

    const childTasks = await db.task.findMany({
      where: { id: { in: childTaskIds } },
      select: { id: true, title: true, agentId: true }
    });

    await db.$transaction([
      db.task.update({
        where: { id: parentTaskId },
        data: { status: "running", blocker: null, nextAction: `HQ delegated ${childTasks.length} subtasks at ${executionResult.executedAt}` }
      }),
      ...(parentTask.agentId
        ? [db.agent.update({
            where: { id: parentTask.agentId },
            data: { status: "running", currentTask: "HQ 오케스트레이션 진행 중" }
          })]
        : []),
      db.task.updateMany({
        where: { id: { in: childTaskIds }, status: "queued" },
        data: { status: "running", blocker: null, nextAction: "하위 에이전트 실행 어댑터/산출물 보고 대기" }
      }),
      ...childTasks
        .filter((task) => task.agentId)
        .map((task) => db.agent.update({
          where: { id: task.agentId! },
          data: { status: "running", currentTask: task.title }
        })),
      ...childTasks.map((task) => db.event.create({
        data: {
          type: "hq.delegation.started",
          severity: "info",
          message: `HQ delegated task started: ${task.title}`,
          taskId: task.id,
          agentId: task.agentId ?? undefined,
          metadata: { parentTaskId, executedAt: executionResult.executedAt }
        }
      }))
    ]);

    return childTasks.length;
  },
  async createCommandEvent(event) {
    await db.event.create({
      data: {
        type: event.type,
        severity: event.severity,
        message: event.message,
        commandQueueId: event.commandQueueId,
        approvalId: event.approvalId ?? undefined,
        projectId: event.projectId ?? undefined,
        taskId: event.taskId ?? undefined,
        metadata: event.metadata ?? {}
      }
    });
  }
};
