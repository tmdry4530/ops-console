import type { RiskLevel, SystemScope } from "@prisma/client";

export type BoundaryDecision = { allowed: true; reason: string } | { allowed: false; reason: string };

const PROFILE_SCOPE: Record<string, SystemScope> = {
  company: "company",
  auth: "auth",
  "auth-manager": "auth",
  crypto: "crypto",
  "crypto-signal": "crypto",
  alpha: "alpha",
  "alpha-terminal": "alpha",
  "x-cdp": "crypto"
};

const CROSS_SCOPE_DENY = new Set<string>([
  "company:auth",
  "company:crypto",
  "company:alpha",
  "company:personal",
  "auth:company",
  "auth:crypto",
  "auth:alpha",
  "crypto:company",
  "crypto:auth",
  "crypto:alpha",
  "alpha:company",
  "alpha:auth",
  "alpha:crypto"
]);

const SECRET_PATH_PATTERNS = [
  /\.env(\.|$)/i,
  /secret/i,
  /token/i,
  /cookie/i,
  /browser storage/i,
  /local storage/i,
  /session storage/i,
  /login data/i,
  /keychain/i,
  /database\.url/i
];

export function scopeForProfile(profile: string): SystemScope {
  return PROFILE_SCOPE[profile] ?? "company";
}

export function isSecretLikePath(pathOrName: string): boolean {
  return SECRET_PATH_PATTERNS.some((pattern) => pattern.test(pathOrName));
}

export function enforceScopeBoundary(input: { actorScope: SystemScope; targetScope: SystemScope; operation: string; riskLevel?: RiskLevel; pathOrName?: string | null }): BoundaryDecision {
  if (input.pathOrName && isSecretLikePath(input.pathOrName)) {
    return { allowed: false, reason: "secret_like_path_blocked" };
  }
  if (CROSS_SCOPE_DENY.has(`${input.actorScope}:${input.targetScope}`)) {
    return { allowed: false, reason: `cross_scope_denied:${input.actorScope}->${input.targetScope}` };
  }
  if (input.actorScope === "infra") {
    return { allowed: true, reason: "infra_allowed" };
  }
  if (input.riskLevel === "critical") {
    return { allowed: false, reason: "critical_requires_manual_boundary_approval" };
  }
  return { allowed: true, reason: "scope_allowed" };
}

export function alphaReadOnlyDecision(input: { operation: string; riskLevel?: RiskLevel }): BoundaryDecision {
  const op = input.operation.toLowerCase();
  if (op.includes("write") || op.includes("deploy") || op.includes("delete") || op.includes("migrate") || op.includes("restart")) {
    return { allowed: false, reason: "alpha_read_only_boundary" };
  }
  return { allowed: true, reason: "alpha_read_only_safe" };
}

export function xCdpBoundaryDecision(input: { operation: string; requiresAccountSession?: boolean; pathOrName?: string | null }): BoundaryDecision {
  if (input.pathOrName && isSecretLikePath(input.pathOrName)) return { allowed: false, reason: "x_cdp_secret_or_storage_blocked" };
  if (input.requiresAccountSession) return { allowed: false, reason: "x_cdp_account_session_blocked" };
  return { allowed: true, reason: "x_cdp_public_collection_only" };
}
