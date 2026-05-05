export const defaultPolicyActions = ["allow", "require_approval", "block", "require_manual_handoff"] as const;
export type PolicyDecision = (typeof defaultPolicyActions)[number];

export function defaultPolicyForAction(actionType: string): PolicyDecision {
  if (["wallet_kyc", "live_trading", "public_disclosure", "deploy", "bounty_submission", "paid_action"].includes(actionType)) {
    return "require_approval";
  }
  if (["wallet_signature", "two_factor", "immunefi_submit"].includes(actionType)) {
    return "require_manual_handoff";
  }
  return "allow";
}
