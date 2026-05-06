import type { NextRequest } from "next/server";

export const manualHandoffActionTypes = ["immunefi_submit", "revenue_outreach", "kyc", "wallet_signature", "two_factor", "kakao_send", "instagram_send", "line_send"] as const;

export type ManualHandoffActionType = (typeof manualHandoffActionTypes)[number];

export type OperatorIdentity = {
  email: string;
  source: "local-dev" | "private-header";
};

export function requiresManualHandoff(actionType: string, riskLevel: string) {
  return manualHandoffActionTypes.includes(actionType as ManualHandoffActionType) || riskLevel === "high" || riskLevel === "critical";
}

export function readOperatorIdentity(request: NextRequest): OperatorIdentity | null {
  const headerEmail = request.headers.get("x-ops-operator-email");
  if (headerEmail) {
    return { email: headerEmail, source: "private-header" };
  }

  if (process.env.AUTH_BYPASS_LOCAL === "true" && process.env.NODE_ENV !== "production") {
    return { email: process.env.OPERATOR_BOOTSTRAP_EMAIL ?? "operator@example.invalid", source: "local-dev" };
  }

  return null;
}
