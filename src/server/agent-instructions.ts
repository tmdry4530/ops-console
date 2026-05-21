import { db } from "@/lib/db";
import { planHqOrchestration } from "./hq-orchestration";
import { parentDelegationStateAfterDispatch } from "./autonomy-orchestration";
import { buildConversationMetadata } from "./project-conversations";
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
  projectSlug?: string | null;
};

type PlannedTask = {
  slug: string;
  title: string;
  status: "queued" | "waiting_approval";
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
  approval: PlannedApproval | null;
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

function requiresInstructionApproval(actionType: AgentInstructionActionType, riskLevel: RiskLevel) {
  if (riskLevel === "high" || riskLevel === "critical") return true;
  return ["deploy", "revenue_outreach", "bounty_submission", "wallet_kyc", "live_trading", "paid_action", "public_disclosure"].includes(actionType);
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

  const stamp = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 17);
  const slug = `ops-${slugPart(input.agentSlug)}-${stamp}`;
  const summary = `운영자 지시: ${instruction}`;
  const approvalType = approvalTypeForAction(input.actionType);
  const needsApproval = requiresInstructionApproval(input.actionType, input.riskLevel);
  const severity = input.riskLevel === "high" || input.riskLevel === "critical" ? "warning" : "info";
  const conversationMetadata = buildConversationMetadata({
    projectSlug: input.projectSlug ?? "ops-console",
    agentSlug: input.agentSlug,
    workstream: "operator-instructions"
  });

  return {
    task: {
      slug,
      title: `콘솔 지시 · ${input.agentName}`,
      status: needsApproval ? "waiting_approval" : "queued",
      riskLevel: input.riskLevel,
      summary,
      nextAction: needsApproval ? "위험/외부 영향 작업은 운영자 승인 후 안전 큐 또는 수동 게이트로 진행" : "운영자 직접 지시로 승인 없이 에이전트 큐에서 진행",
      agentId: input.agentId,
      projectId: input.projectId ?? null
    },
    approval: needsApproval
      ? {
          externalKey: `${slug}-approval`,
          type: approvalType,
          status: "pending",
          riskLevel: input.riskLevel,
          title: `지시 승인 · ${input.agentName}`,
          summary,
          requestedBy: actorEmail,
          projectId: input.projectId ?? null
        }
      : null,
    event: {
      type: "instruction.requested",
      severity,
      message: `Operator instruction requested: ${input.agentSlug}`,
      metadata: { actorEmail, actionType: input.actionType, riskLevel: input.riskLevel, instruction, ...conversationMetadata },
      agentId: input.agentId,
      projectId: input.projectId ?? null
    }
  };
}

export async function createAgentInstruction(agentId: string, body: unknown, actorEmail: string) {
  const agent = await db.agent.findUniqueOrThrow({ where: { id: agentId } });
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const actionType = typeof record.actionType === "string" ? (record.actionType as AgentInstructionActionType) : "operator_instruction";
  const riskLevel = typeof record.riskLevel === "string" ? (record.riskLevel as RiskLevel) : "low";
  const projectId = typeof record.projectId === "string" && record.projectId.trim() ? record.projectId.trim() : null;
  const instruction = typeof record.instruction === "string" ? record.instruction : "";
  const project = projectId ? await db.project.findUnique({ where: { id: projectId }, select: { slug: true } }) : null;

  const plan = planAgentInstruction({ agentId: agent.id, agentSlug: agent.slug, agentName: agent.name, instruction, actionType, riskLevel, projectId, projectSlug: project?.slug }, actorEmail);
  const hqPlan = agent.slug === "hq-agent" && !plan.approval ? planHqOrchestration(instruction, actorEmail, undefined, project?.slug ?? undefined) : null;
  const dispatchedAt = new Date().toISOString();

  return db.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: hqPlan
        ? {
            ...plan.task,
            status: "running",
            summary: hqPlan.parentSummary,
            nextAction: "HQ가 역할 에이전트 child task를 생성했고 worker가 안전 큐를 처리"
          }
        : plan.task
    });
    const approval = plan.approval ? await tx.approval.create({ data: { ...plan.approval, taskId: task.id } }) : null;
    const event = await tx.event.create({ data: { ...plan.event, taskId: task.id, approvalId: approval?.id } });

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
          metadata: { ...delegation.metadata, orchestrationRunId: hqPlan.runId, parentTaskId: task.id, childTaskId: childTask.id, department: delegation.department },
          agentId: targetAgentId,
          projectId,
          taskId: childTask.id
        }
      });
      delegations.push(childTask);
    }

    const dispatchState = hqPlan ? parentDelegationStateAfterDispatch(delegations.length, dispatchedAt) : null;
    if (dispatchState) {
      await tx.task.update({ where: { id: task.id }, data: dispatchState.parentTask });
      await tx.agent.update({ where: { id: agent.id }, data: dispatchState.mainAgent });
      await tx.event.create({
        data: {
          type: "hq.delegation.dispatched",
          severity: "info",
          message: `HQ delegation dispatched: ${delegations.length} child tasks`,
          metadata: { ...dispatchState.parentEventMetadata, orchestrationRunId: hqPlan.runId, parentTaskId: task.id },
          agentId: agent.id,
          projectId,
          taskId: task.id
        }
      });
    }

    const discordReports = [];
    for (const report of hqPlan.discordReports) {
      const reportEvent = await tx.event.create({
        data: {
          type: "discord.report.queued",
          severity: "info",
          message: `Discord report queued: ${report.channel}`,
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
