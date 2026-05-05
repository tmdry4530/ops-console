import { db } from "@/lib/db";
import { canQueueCommand } from "./commands";

export type ApprovalOutcome = "approved_waiting_execution" | "manual_handoff";

export function determineApprovalOutcome(actionType: string, riskLevel: string): ApprovalOutcome {
  return canQueueCommand(actionType, riskLevel) ? "approved_waiting_execution" : "manual_handoff";
}

export async function approveApproval(id: string, note: string | undefined, actorEmail: string) {
  const approval = await db.approval.findUniqueOrThrow({ include: { project: true, task: true }, where: { id } });
  const actionType = approval.type === "bounty_submission" ? "immunefi_submit" : approval.type;
  const outcome = determineApprovalOutcome(actionType, approval.riskLevel);

  const updated = await db.approval.update({
    where: { id },
    data: { status: outcome, decisionNote: note }
  });

  if (outcome === "approved_waiting_execution") {
    const command = await db.commandQueue.create({
      data: {
        actionType,
        status: "queued",
        riskLevel: approval.riskLevel,
        approvalId: approval.id,
        payload: { approvalId: approval.id, projectId: approval.projectId, taskId: approval.taskId }
      }
    });
    await db.event.create({
      data: { type: "command.queued", severity: "info", message: `Command queued for ${approval.title}`, approvalId: approval.id, commandQueueId: command.id, projectId: approval.projectId, taskId: approval.taskId, metadata: { actorEmail } }
    });
  } else {
    await db.commandQueue.create({
      data: {
        actionType,
        status: "waiting_manual_handoff",
        riskLevel: approval.riskLevel,
        approvalId: approval.id,
        payload: { approvalId: approval.id, manualHandoff: true, reason: "manual handoff or high-risk action" }
      }
    });
  }

  await db.event.create({
    data: { type: "approval.approved", severity: outcome === "manual_handoff" ? "warning" : "info", message: `Approval accepted: ${approval.title}`, approvalId: approval.id, projectId: approval.projectId, taskId: approval.taskId, metadata: { actorEmail, note, outcome } }
  });

  return updated;
}

export async function rejectApproval(id: string, note: string | undefined, actorEmail: string) {
  const approval = await db.approval.update({ where: { id }, data: { status: "rejected", decisionNote: note } });
  await db.event.create({ data: { type: "approval.rejected", severity: "warning", message: `Approval rejected: ${approval.title}`, approvalId: approval.id, projectId: approval.projectId, taskId: approval.taskId, metadata: { actorEmail, note } } });
  return approval;
}

export async function requestApprovalChanges(id: string, note: string | undefined, actorEmail: string) {
  const approval = await db.approval.update({ where: { id }, data: { status: "needs_changes", decisionNote: note } });
  if (approval.taskId) {
    await db.task.update({ where: { id: approval.taskId }, data: { status: "needs_changes", blocker: note ?? "Operator requested changes" } });
  }
  await db.event.create({ data: { type: "approval.needs_changes", severity: "warning", message: `Changes requested: ${approval.title}`, approvalId: approval.id, projectId: approval.projectId, taskId: approval.taskId, metadata: { actorEmail, note } } });
  return approval;
}

export async function markManualSubmitted(id: string, manualReportId: string, note: string | undefined, actorEmail: string) {
  const approval = await db.approval.update({ where: { id }, data: { status: "completed", manualReportId, decisionNote: note } });
  if (approval.projectId) {
    await db.project.update({ where: { id: approval.projectId }, data: { status: "submitted", nextAction: `Track manual submission report ${manualReportId}`, blocker: null } });
  }
  if (approval.taskId) {
    const task = await db.task.update({
      where: { id: approval.taskId },
      data: { status: "completed", nextAction: `Monitor report ${manualReportId}`, blocker: null },
      select: { agentId: true }
    });
    if (task.agentId) {
      await db.agent.update({
        where: { id: task.agentId },
        data: { status: "idle", currentTask: null }
      });
    }
  }
  await db.event.create({ data: { type: "approval.manual_submitted", severity: "info", message: `Manual submission recorded: ${manualReportId}`, approvalId: approval.id, projectId: approval.projectId, taskId: approval.taskId, metadata: { actorEmail, note, manualReportId } } });
  return approval;
}
