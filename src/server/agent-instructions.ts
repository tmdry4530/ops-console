import { db } from "@/lib/db";
import { planHqOrchestration } from "./hq-orchestration";
import type { ApprovalType, RiskLevel } from "@prisma/client";

export type AgentInstructionActionType =
  | "operator_instruction"
  | "internal_sync"
  | "deploy"
  | "revenue_outreach"
  | "bounty_submission"
  | "wallet_kyc"
  | "live_trading"
  | "paid_action"
  | "public_disclosure";

export type AgentInstructionInput = {
  agentId: string;
  agentSlug: string;
  agentName: string;
  instruction: string;
  actionType: AgentInstructionActionType;
  riskLevel: RiskLevel;
  projectId?: string | null;
};

type PlannedTask = {
  slug: string;
  title: string;
  status: "waiting_approval";
  riskLevel: RiskLevel;
  summary: string;
  nextAction: string;
  agentId: string;
  projectId?: string | null;
};

type PlannedApproval = {
  externalKey: string;
  type: ApprovalType;
  status: "pending";
  riskLevel: RiskLevel;
  title: string;
  summary: string;
  requestedBy: string;
  projectId?: string | null;
};

type PlannedEvent = {
  type: "instruction.requested";
  severity: "info" | "warning";
  message: string;
  metadata: Record<string, string>;
  agentId: string;
  projectId?: string | null;
};

export type AgentInstructionPlan = {
  task: PlannedTask;
  approval: PlannedApproval;
  event: PlannedEvent;
};

function approvalTypeForAction(actionType: AgentInstructionActionType): ApprovalType {
  if (actionType === "deploy") return "deploy";
  if (actionType === "revenue_outreach") return "revenue_outreach";
  if (actionType === "bounty_submission") return "bounty_submission";
  if (actionType === "wallet_kyc") return "wallet_kyc";
  if (actionType === "live_trading") return "live_trading";
  if (actionType === "paid_action") return "paid_action";
  if (actionType === "public_disclosure") return "public_disclosure";
  return "other";
}

function slugPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "instruction";
}

export function planAgentInstruction(input: AgentInstructionInput, actorEmail: string, now = new Date()): AgentInstructionPlan {
  const instruction = input.instruction.trim();
  if (!instruction) throw new Error("instruction_required");

  const stamp = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const slug = `ops-${slugPart(input.agentSlug)}-${stamp}`;
  const summary = `운영자 지시: ${instruction}`;
  const approvalType = approvalTypeForAction(input.actionType);
  const severity = input.riskLevel === "high" || input.riskLevel === "critical" ? "warning" : "info";

  return {
    task: {
      slug,
      title: `콘솔 지시 · ${input.agentName}`,
      status: "waiting_approval",
      riskLevel: input.riskLevel,
      summary,
      nextAction: "운영자 승인 후 안전 큐 또는 수동 게이트로 진행",
      agentId: input.agentId,
      projectId: input.projectId ?? null
    },
    approval: {
      externalKey: `${slug}-approval`,
      type: approvalType,
      status: "pending",
      riskLevel: input.riskLevel,
      title: `지시 승인 · ${input.agentName}`,
      summary,
      requestedBy: actorEmail,
      projectId: input.projectId ?? null
    },
    event: {
      type: "instruction.requested",
      severity,
      message: `Operator instruction requested: ${input.agentSlug}`,
      metadata: { actorEmail, actionType: input.actionType, riskLevel: input.riskLevel, instruction },
      agentId: input.agentId,
      projectId: input.projectId ?? null
    }
  };
}

export async function createAgentInstruction(agentId: string, body: unknown, actorEmail: string, traceId?: string) {
  const agent = await db.agent.findUniqueOrThrow({ where: { id: agentId } });
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const actionType = typeof record.actionType === "string" ? (record.actionType as AgentInstructionActionType) : "operator_instruction";
  const riskLevel = typeof record.riskLevel === "string" ? (record.riskLevel as RiskLevel) : "low";
  const projectId = typeof record.projectId === "string" && record.projectId.trim() ? record.projectId.trim() : null;
  const instruction = typeof record.instruction === "string" ? record.instruction : "";

  const plan = planAgentInstruction({ agentId: agent.id, agentSlug: agent.slug, agentName: agent.name, instruction, actionType, riskLevel, projectId }, actorEmail);
  const hqPlan = agent.slug === "hq-agent" ? planHqOrchestration(instruction, actorEmail) : null;

  return db.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: hqPlan
        ? {
            ...plan.task,
            summary: hqPlan.parentSummary
          }
        : plan.task
    });
    const approval = await tx.approval.create({ data: { ...plan.approval, taskId: task.id } });
    const event = await tx.event.create({ data: { ...plan.event, traceId, taskId: task.id, approvalId: approval.id } });

    if (!hqPlan) return { task, approval, event, delegations: [], discordReports: [] };

    const targetAgents = await tx.agent.findMany({
      where: { slug: { in: hqPlan.delegations.map((delegation) => delegation.agentSlug) } },
      select: { id: true, slug: true }
    });
    const agentIdBySlug = new Map(targetAgents.map((target) => [target.slug, target.id]));

    const delegations = [];
    for (const delegation of hqPlan.delegations) {
      const targetAgentId = agentIdBySlug.get(delegation.agentSlug);
      if (!targetAgentId) continue;
      const childSlug = `${hqPlan.runId}-${delegation.department}`;
      const childTask = await tx.task.create({
        data: {
          slug: childSlug,
          title: delegation.title,
          status: delegation.status,
          riskLevel: delegation.riskLevel,
          summary: delegation.summary,
          nextAction: delegation.nextAction,
          agentId: targetAgentId,
          projectId
        }
      });
      await tx.event.create({
        data: {
          type: "hq.delegation.created",
          severity: "info",
          message: `HQ delegation created: ${delegation.department}`,
          traceId,
          metadata: { orchestrationRunId: hqPlan.runId, parentTaskId: task.id, childTaskId: childTask.id, department: delegation.department },
          agentId: targetAgentId,
          projectId,
          taskId: childTask.id
        }
      });
      delegations.push(childTask);
    }

    const discordReports = [];
    for (const report of hqPlan.discordReports) {
      const reportEvent = await tx.event.create({
        data: {
          type: "discord.report.queued",
          severity: "info",
          message: `Discord report queued: ${report.channel}`,
          traceId,
          metadata: { ...report.metadata, channel: report.channel, message: report.message },
          agentId: agent.id,
          projectId,
          taskId: task.id
        }
      });
      discordReports.push(reportEvent);
    }

    return { task, approval, event, delegations, discordReports };
  });
}
