import type { RiskLevel } from "@prisma/client";

export type CompiledGlobalCommand =
  | {
      ok: true;
      kind: "agent_intervention" | "route" | "approval" | "search";
      raw: string;
      action: string;
      targetAgentSlug: string | null;
      riskLevel: RiskLevel;
      requiresApproval: boolean;
      verifierRequired: boolean;
      commandQueuePayload: Record<string, string | boolean | null>;
      operatorSummary: string;
    }
  | { ok: false; raw: string; reason: string; blockedTerms: string[] };

const forbiddenTerms = ["wallet", "secret", "token", "cookie", "browser storage", "live order", "payment", "private key", "db url"];
const highRiskActions = new Set(["rollback", "restart", "kill"]);
const safeInterventions = new Set(["pause", "resume", "cancel", "reprioritize", "reassign", "scope-limit", "scope_limit"]);

function words(input: string) {
  return input.trim().split(/\s+/).filter(Boolean);
}

function readFlag(tokens: string[], flag: string) {
  const index = tokens.indexOf(flag);
  if (index === -1) return null;
  const values: string[] = [];
  for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
    if (tokens[cursor].startsWith("--")) break;
    values.push(tokens[cursor]);
  }
  return values.join(" ") || null;
}

export function compileGlobalCommand(raw: string): CompiledGlobalCommand {
  const normalized = raw.trim();
  const lowered = normalized.toLowerCase();
  const blockedTerms = forbiddenTerms.filter((term) => lowered.includes(term));
  if (blockedTerms.length > 0) {
    return { ok: false, raw, reason: `forbidden command terms detected: ${blockedTerms.join(", ")}`, blockedTerms };
  }

  const tokens = words(normalized);
  const command = (tokens[0] ?? "").replace(/^\//, "").toLowerCase();
  const targetAgentSlug = tokens.find((token, index) => index > 0 && /-agent$/.test(token)) ?? null;
  const reason = readFlag(tokens, "--reason");
  const scopeLimit = readFlag(tokens, "--scope") ?? readFlag(tokens, "--scope-limit");
  const action = command === "scope-limit" ? "scope_limit" : command;
  const isHighRisk = highRiskActions.has(action);
  const isSafeIntervention = safeInterventions.has(action) || isHighRisk;

  if (isSafeIntervention) {
    return {
      ok: true,
      kind: "agent_intervention",
      raw,
      action,
      targetAgentSlug,
      riskLevel: isHighRisk ? "high" : "low",
      requiresApproval: isHighRisk,
      verifierRequired: true,
      commandQueuePayload: {
        action,
        targetAgentSlug,
        reason,
        scopeLimit,
        compiledFrom: "global-command-bar",
        approvalRequired: isHighRisk
      },
      operatorSummary: `${action} ${targetAgentSlug ?? "selected agent"}${reason ? ` · ${reason}` : ""}`
    };
  }

  if (command === "route" || command === "approve" || command === "search") {
    return {
      ok: true,
      kind: command === "approve" ? "approval" : command,
      raw,
      action: command,
      targetAgentSlug,
      riskLevel: "low",
      requiresApproval: command === "approve",
      verifierRequired: true,
      commandQueuePayload: { action: command, targetAgentSlug, reason, scopeLimit, compiledFrom: "global-command-bar" },
      operatorSummary: `${command} ${targetAgentSlug ?? "ops-console"}`
    };
  }

  return {
    ok: true,
    kind: "search",
    raw,
    action: "search",
    targetAgentSlug,
    riskLevel: "low",
    requiresApproval: false,
    verifierRequired: false,
    commandQueuePayload: { action: "search", targetAgentSlug, reason: normalized, scopeLimit: null, compiledFrom: "global-command-bar" },
    operatorSummary: `search: ${normalized}`
  };
}
