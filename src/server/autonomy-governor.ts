import type { PolicyAction, RiskLevel } from "@prisma/client";
import { isBlockedAutonomousAction, isCompanyInternalProject } from "./agent-organization-policy";

export const AUTONOMY_LEVELS = [
  { level: "L0", label: "Manual Only" },
  { level: "L1", label: "Suggest Only" },
  { level: "L2", label: "Auto-Plan" },
  { level: "L3", label: "Auto-Execute Low Risk" },
  { level: "L4", label: "Auto-Execute Medium Internal" },
  { level: "L5", label: "Fully Autonomous Within Scope" },
  { level: "L6", label: "Forbidden" }
] as const;

export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number]["level"];
export type AutonomyGovernorDecision =
  | "allow_auto"
  | "allow_plan_only"
  | "require_approval"
  | "require_manual_handoff"
  | "block"
  | "pause_scope"
  | "escalate_hq";

export type AutonomyDecisionInput = {
  systemScope: string;
  projectSlug: string;
  agentSlug: string;
  actionType: string;
  riskLevel: RiskLevel;
  requestedTools: string[];
  capability: {
    capabilityKey: string;
    allowedTools: string[];
    maxRisk: RiskLevel;
    requiresApproval: boolean;
  } | null;
  policy?: { action: PolicyAction | "allow_auto" | "allow_plan_only" | "require_approval" | "require_manual_handoff" | "block"; riskLevel?: RiskLevel } | null;
  budget?: { requestedUsd: number; remainingUsd: number } | null;
  approvalStatus?: string | null;
  verifier?: { required: boolean; available: boolean } | null;
};

export type AutonomyDecisionResult = {
  decision: AutonomyGovernorDecision;
  autonomyLevel: AutonomyLevel;
  verifierRequired: boolean;
  reasons: string[];
};

const riskWeight: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };
const lowMediumInternalAgents = new Set(["docs-agent", "research-agent", "projects-agent", "design-agent", "main-agent", "hq-agent", "dev-agent", "crypto-signal"]);
const separatedScopes = new Set(["Auth", "Crypto", "X-CDP"]);
const forbiddenActions = new Set(["live_trading", "order_execution", "payment", "paid_action", "wallet_kyc", "secret_access", "browser_storage", "cookie_access"]);
const manualActions = new Set(["deploy", "public_disclosure", "revenue_outreach", "bounty_submission"]);

export const DEFAULT_POLICY_MATRIX = [
  { scope: "docs/research/projects", agent: "docs/research/projects", autonomyLevel: "L4", decision: "allow_auto", rule: "low/medium internal only; verifier required" },
  { scope: "design", agent: "design-agent", autonomyLevel: "L3/L4", decision: "allow_auto", rule: "low/medium internal design work" },
  { scope: "dev", agent: "dev-agent", autonomyLevel: "L4", decision: "allow_auto", rule: "low/medium internal code write/repo_write within dev role; verifier required" },
  { scope: "content", agent: "content-agent", autonomyLevel: "L2", decision: "allow_plan_only", rule: "factual/evidence-based draft only" },
  { scope: "alpha-terminal", agent: "alpha-terminal", autonomyLevel: "L1", decision: "allow_plan_only", rule: "read-only only; write tools blocked" },
  { scope: "crypto-signal", agent: "crypto-signal", autonomyLevel: "L3/L4", decision: "allow_auto", rule: "Company service/project agent; monitoring/reports only; trading/order/secret blocked" },
  { scope: "auth", agent: "auth-manager", autonomyLevel: "L2", decision: "allow_plan_only", rule: "capability provider only; no general task execution" },
  { scope: "x-cdp", agent: "isolated", autonomyLevel: "L6", decision: "block", rule: "separated from Company scope" },
  { scope: "wallet/payment/trading/secrets", agent: "all", autonomyLevel: "L6", decision: "block", rule: "forbidden or manual-only" }
] as const;

function isWriteTool(tool: string) {
  return /write|deploy|send|order|wallet|secret|payment|browser_storage|cookie/i.test(tool);
}

function approved(status?: string | null) {
  return status === "approved" || status === "approved_waiting_execution" || status === "executing";
}

export function decideAutonomy(input: AutonomyDecisionInput): AutonomyDecisionResult {
  const reasons: string[] = [];
  const verifierRequired = input.verifier?.required ?? true;

  if (separatedScopes.has(input.systemScope) && input.projectSlug !== input.systemScope.toLowerCase()) {
    return { decision: "block", autonomyLevel: "L6", verifierRequired, reasons: ["scope_isolated_from_company"] };
  }

  if (input.projectSlug === "alpha-terminal" && input.requestedTools.some(isWriteTool)) {
    return { decision: "block", autonomyLevel: "L6", verifierRequired, reasons: ["alpha_terminal_read_only"] };
  }

  if (forbiddenActions.has(input.actionType) || isBlockedAutonomousAction(input.actionType)) {
    return { decision: input.actionType === "wallet_kyc" ? "require_manual_handoff" : "block", autonomyLevel: "L6", verifierRequired, reasons: ["forbidden_action_type"] };
  }

  if (input.budget && input.budget.requestedUsd > input.budget.remainingUsd) {
    return { decision: "pause_scope", autonomyLevel: "L0", verifierRequired, reasons: ["budget_exhausted"] };
  }

  if (verifierRequired && input.verifier?.available === false) {
    return { decision: "allow_plan_only", autonomyLevel: "L2", verifierRequired, reasons: ["verifier_gate_missing"] };
  }

  if (!input.capability) {
    return { decision: "escalate_hq", autonomyLevel: "L1", verifierRequired, reasons: ["capability_missing"] };
  }

  if (input.requestedTools.some((tool) => !input.capability!.allowedTools.includes(tool))) {
    return { decision: "require_approval", autonomyLevel: "L2", verifierRequired, reasons: ["requested_tool_outside_capability"] };
  }

  if (input.riskLevel === "high" || input.riskLevel === "critical") {
    return { decision: "require_approval", autonomyLevel: "L1", verifierRequired, reasons: ["high_critical_requires_human_decision"] };
  }

  if (riskWeight[input.riskLevel] > riskWeight[input.capability.maxRisk]) {
    return { decision: "require_approval", autonomyLevel: "L1", verifierRequired, reasons: ["risk_exceeds_capability"] };
  }

  if (manualActions.has(input.actionType)) {
    return { decision: approved(input.approvalStatus) ? "allow_plan_only" : "require_manual_handoff", autonomyLevel: "L0", verifierRequired, reasons: ["manual_action_type"] };
  }

  if (input.agentSlug === "content-agent") {
    return { decision: "allow_plan_only", autonomyLevel: "L2", verifierRequired, reasons: ["content_evidence_draft_only"] };
  }

  if (input.agentSlug === "dev-agent" && (input.actionType === "code_write" || input.requestedTools.some((tool) => tool === "repo_write"))) {
    if ((input.riskLevel === "low" || input.riskLevel === "medium") && isCompanyInternalProject(input.projectSlug)) {
      return { decision: "allow_auto", autonomyLevel: "L4", verifierRequired, reasons: ["dev_role_scoped_internal_patch_allowed_with_verifier"] };
    }
    return approved(input.approvalStatus)
      ? { decision: "allow_auto", autonomyLevel: "L3", verifierRequired, reasons: ["dev_code_write_approved"] }
      : { decision: "require_approval", autonomyLevel: "L2", verifierRequired, reasons: ["dev_code_write_requires_approval"] };
  }

  if (input.capability.requiresApproval && !approved(input.approvalStatus)) {
    return { decision: "require_approval", autonomyLevel: "L2", verifierRequired, reasons: ["capability_requires_approval"] };
  }

  if ((input.riskLevel === "low" || input.riskLevel === "medium") && lowMediumInternalAgents.has(input.agentSlug) && (isCompanyInternalProject(input.projectSlug) || input.systemScope === "Company")) {
    reasons.push("low_medium_internal_auto_allowed");
    return { decision: "allow_auto", autonomyLevel: input.riskLevel === "medium" ? "L4" : "L4", verifierRequired, reasons };
  }

  return { decision: "allow_plan_only", autonomyLevel: "L2", verifierRequired, reasons: ["default_plan_only"] };
}
