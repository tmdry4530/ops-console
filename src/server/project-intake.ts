import type { RiskLevel } from "@prisma/client";
import { db } from "@/lib/db";
import { createAgentInstruction, type AgentInstructionActionType } from "./agent-instructions";
import { buildConversationMetadata } from "./project-conversations";

export type ProjectIntakeSource = "ops_console" | "discord_main_agent";

export type NormalizedProjectIntake = {
  name: string;
  slug: string;
  instruction: string;
  ownerAgentSlug: string;
  workstream: string;
  riskLevel: RiskLevel;
  actionType: AgentInstructionActionType;
  source: ProjectIntakeSource;
};

const riskLevels = new Set(["low", "medium", "high", "critical"]);
const actionTypes = new Set([
  "operator_instruction",
  "internal_sync",
  "deploy",
  "revenue_outreach",
  "bounty_submission",
  "wallet_kyc",
  "live_trading",
  "paid_action",
  "public_disclosure"
]);

export function slugifyProjectSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "new-project";
}

function textField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeProjectIntake(body: unknown, source: ProjectIntakeSource = "ops_console"): NormalizedProjectIntake {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const name = textField(record, "name") ?? textField(record, "projectName");
  const rawInstruction = textField(record, "instruction") ?? textField(record, "goal") ?? textField(record, "message");
  if (!name) throw new Error("project_name_required");
  if (!rawInstruction) throw new Error("instruction_required");

  const slug = slugifyProjectSlug(textField(record, "slug") ?? textField(record, "projectSlug") ?? name);
  const ownerAgentSlug = slugifyProjectSlug(textField(record, "ownerAgent") ?? textField(record, "ownerAgentSlug") ?? "hq-agent");
  const workstream = slugifyProjectSlug(textField(record, "workstream") ?? "project-intake");
  const requestedRisk = textField(record, "riskLevel") ?? "low";
  const requestedAction = textField(record, "actionType") ?? "operator_instruction";

  return {
    name,
    slug,
    instruction: rawInstruction,
    ownerAgentSlug,
    workstream,
    riskLevel: riskLevels.has(requestedRisk) ? (requestedRisk as RiskLevel) : "low",
    actionType: actionTypes.has(requestedAction) ? (requestedAction as AgentInstructionActionType) : "operator_instruction",
    source
  };
}

export function buildProjectRouterMetadata(input: NormalizedProjectIntake, actorEmail: string) {
  return {
    ...buildConversationMetadata({ projectSlug: input.slug, agentSlug: input.ownerAgentSlug, workstream: input.workstream }),
    source: input.source,
    ownerAgentSlug: input.ownerAgentSlug,
    projectSlug: input.slug,
    workstream: input.workstream,
    riskLevel: input.riskLevel,
    actionType: input.actionType,
    requestedBy: actorEmail,
    intakePolicy: "new_project_register_then_hq_distribute",
    externalRiskGate: "deploy/external/wallet/trading/paid/public/high-critical require approval"
  };
}

export async function createProjectIntake(body: unknown, actorEmail: string, source: ProjectIntakeSource = "ops_console") {
  const input = normalizeProjectIntake(body, source);

  const hqAgent = await db.agent.findUnique({ where: { slug: "hq-agent" }, select: { id: true, slug: true } });
  if (!hqAgent) throw new Error("hq_agent_missing");

  const existing = await db.project.findUnique({ where: { slug: input.slug }, select: { id: true } });
  if (existing) throw new Error("project_slug_exists");

  const metadata = buildProjectRouterMetadata(input, actorEmail);
  const project = await db.project.create({
    data: {
      slug: input.slug,
      name: input.name,
      status: "active",
      nextAction: "HQ 오케스트레이션이 역할 에이전트로 작업을 분배하고 산출물/진행 이벤트를 기록",
      metadata
    }
  });

  const event = await db.event.create({
    data: {
      type: source === "discord_main_agent" ? "project.intake.discord_registered" : "project.intake.registered",
      severity: "info",
      message: `Project intake registered: ${input.slug}`,
      projectId: project.id,
      agentId: hqAgent.id,
      metadata
    }
  });

  const instructionResult = await createAgentInstruction(
    hqAgent.id,
    {
      instruction: `[${input.name}] ${input.instruction}`,
      actionType: input.actionType,
      riskLevel: input.riskLevel,
      projectId: project.id
    },
    actorEmail
  );

  return { project, intakeEvent: event, instruction: instructionResult, router: metadata };
}
