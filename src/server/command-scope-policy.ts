import type { RiskLevel, SystemScope } from "@prisma/client";
import { enforceScopeBoundary, type BoundaryDecision } from "./scope-boundary";

export type CommandScopeInput = {
  actionType: string;
  riskLevel: string;
  actorScope?: SystemScope | null;
  systemScope?: SystemScope | null;
  payload: unknown;
};

function asScope(value: unknown): SystemScope | null {
  return (["company", "crypto", "auth", "alpha", "personal", "infra"] as const).find((scope) => scope === value) ?? null;
}

function asRisk(value: string): RiskLevel | undefined {
  return (["low", "medium", "high", "critical"] as const).find((risk) => risk === value);
}

function payloadRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
}

export function commandScopeDecision(input: CommandScopeInput): BoundaryDecision {
  const payload = payloadRecord(input.payload);
  const actorScope = input.actorScope ?? input.systemScope ?? "company";
  const targetScope = asScope(payload.targetScope) ?? asScope(payload.systemScope) ?? input.systemScope ?? "company";
  const pathOrName = typeof payload.path === "string"
    ? payload.path
    : typeof payload.filePath === "string"
      ? payload.filePath
      : typeof payload.pathOrName === "string"
        ? payload.pathOrName
        : null;

  return enforceScopeBoundary({
    actorScope,
    targetScope,
    operation: input.actionType,
    riskLevel: asRisk(input.riskLevel),
    pathOrName
  });
}
