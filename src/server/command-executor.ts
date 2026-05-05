import { db } from "@/lib/db";
import { requiresManualHandoff } from "@/lib/auth";

export type CommandExecutionStatus = "completed" | "failed" | "skipped";

export type CommandExecutionResult = {
  status: CommandExecutionStatus;
  reason?: string;
  executedAt: string;
  mode?: "ops_console_worker";
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
  updateProjectAfterCommand(id: string, result: CommandExecutionResult): Promise<void>;
  createCommandEvent(event: CommandExecutionEvent): Promise<void>;
};

type CommandPayload = {
  projectId?: string | null;
  taskId?: string | null;
};

function readPayload(payload: unknown): CommandPayload {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    return {
      projectId: typeof record.projectId === "string" ? record.projectId : null,
      taskId: typeof record.taskId === "string" ? record.taskId : null
    };
  }
  return { projectId: null, taskId: null };
}

function result(status: CommandExecutionStatus, reason?: string): CommandExecutionResult {
  return { status, reason, executedAt: new Date().toISOString(), mode: "ops_console_worker" };
}

export async function processCommand(command: QueuedCommandRecord, port: CommandExecutionPort): Promise<CommandExecutionResult> {
  const payload = readPayload(command.payload);

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
  }
  if (payload.projectId) {
    await port.updateProjectAfterCommand(payload.projectId, completed);
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
  async updateProjectAfterCommand(id, executionResult) {
    await db.project.update({ where: { id }, data: { status: "submitted", blocker: null, nextAction: `Command executed at ${executionResult.executedAt}` } });
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
