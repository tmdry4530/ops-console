import type { RiskLevel } from "@prisma/client";
import { db } from "@/lib/db";
import { loadAgentHarness } from "./loadAgentHarness";
import type { HarnessCheckResult, HarnessPreflightInput } from "./types";

const RISK_ORDER: RiskLevel[] = ["low", "medium", "high", "critical"];
function riskGt(a: RiskLevel, b: RiskLevel): boolean { return RISK_ORDER.indexOf(a) > RISK_ORDER.indexOf(b); }
function jsonStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function checkCapability(input: HarnessPreflightInput): Promise<HarnessCheckResult> {
  const harness = await loadAgentHarness(input.agentSlug);
  if (input.systemScope !== "company") return { ok: false, reason: `scope_not_allowed:${input.systemScope}`, failureClass: "SCOPE_VIOLATION" };

  const dbCapability = await db.agentCapability.findFirst({
    where: { agent: { slug: input.agentSlug }, capabilityKey: harness.capabilityKey },
    select: { allowedTools: true, maxRisk: true, requiresApproval: true }
  }).catch(() => null);
  const maxRisk = dbCapability?.maxRisk ?? harness.maxRisk;
  const allowedTools = dbCapability ? jsonStringArray(dbCapability.allowedTools) : harness.allowedTools;

  if (riskGt(input.riskLevel, maxRisk) && input.approvalStatus !== "approved") return { ok: false, reason: `risk_exceeds_capability:${input.riskLevel}>${maxRisk}`, failureClass: "RISK_MISCLASSIFICATION" };
  if (((input.riskLevel === "high" || input.riskLevel === "critical") || dbCapability?.requiresApproval) && input.approvalStatus !== "approved") return { ok: false, reason: `approval_required:${input.riskLevel}`, failureClass: "APPROVAL_BYPASS" };
  for (const tool of input.requestedTools ?? []) {
    if (!allowedTools.includes(tool)) return { ok: false, reason: `tool_not_allowed:${tool}`, failureClass: "TOOL_NOT_ALLOWED" };
  }
  return { ok: true, reason: dbCapability ? "agent_capability_allowed" : "harness_capability_allowed" };
}
