import { db } from "@/lib/db";
import { defaultPolicyForAction, type PolicyDecision } from "./policies";
import type { PolicyAction, RiskLevel, SystemScope } from "@prisma/client";

const ACTION_TO_DECISION: Record<PolicyAction, PolicyDecision> = {
  allow: "allow",
  require_approval: "require_approval",
  block: "block",
  require_manual_handoff: "require_manual_handoff"
};

const RISK_WEIGHT: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };

export type PolicyEnforcementResult = {
  decision: PolicyDecision;
  source: "policy_table" | "default_policy" | "risk_override";
  policyId?: string;
  reason: string;
};

export async function enforcePolicyForAction(input: { actionType: string; riskLevel: RiskLevel; systemScope?: SystemScope }): Promise<PolicyEnforcementResult> {
  const policy = await db.policy.findUnique({ where: { actionType: input.actionType } }).catch(() => null);
  const baseDecision = policy ? ACTION_TO_DECISION[policy.action] : defaultPolicyForAction(input.actionType);
  const source = policy ? "policy_table" : "default_policy";

  if (policy && RISK_WEIGHT[input.riskLevel] > RISK_WEIGHT[policy.riskLevel] && baseDecision === "allow") {
    return { decision: "require_approval", source: "risk_override", policyId: policy.id, reason: `risk_exceeds_policy_baseline:${policy.riskLevel}->${input.riskLevel}` };
  }
  if ((input.riskLevel === "high" || input.riskLevel === "critical") && baseDecision === "allow") {
    return { decision: "require_approval", source: "risk_override", policyId: policy?.id, reason: "high_critical_requires_approval" };
  }
  return { decision: baseDecision, source, policyId: policy?.id, reason: policy?.description ?? `default:${baseDecision}` };
}

export function policyAllowsQueue(decision: PolicyDecision) {
  return decision === "allow" || decision === "require_approval";
}
