import type { RiskLevel, SystemScope } from "@prisma/client";

export type HarnessOutput = Record<string, unknown>;
export type AgentHarnessSpec = {
  agentSlug: string;
  harnessVersion: string;
  capabilityKey: string;
  systemScope: SystemScope | string;
  allowedTools: string[];
  forbiddenTools: string[];
  maxRisk: RiskLevel;
  requiresApprovalFor: RiskLevel[];
  outputSchemaPath: string;
  inputSchemaPath?: string;
  verifierPath?: string;
  rollbackSupported?: boolean;
};
export type HarnessCheckResult = { ok: true; reason?: string } | { ok: false; reason: string; failureClass: string };
export type HarnessPreflightInput = { agentSlug: string; taskId: string; title: string; summary?: string | null; riskLevel: RiskLevel; systemScope: SystemScope; requestedTools?: string[]; approvalStatus?: string | null };
export type HarnessRunResult = { agentSlug: string; harnessVersion: string; score: number; pass: boolean; failureClass?: string; checks: string[] };
