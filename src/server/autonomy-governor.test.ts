import { describe, expect, it } from "vitest";
import { decideAutonomy, AUTONOMY_LEVELS, type AutonomyDecisionInput } from "./autonomy-governor";

const baseInput: AutonomyDecisionInput = {
  systemScope: "Company",
  projectSlug: "ops-console",
  agentSlug: "docs-agent",
  actionType: "operator_instruction",
  riskLevel: "low",
  requestedTools: ["repo_read", "artifact_write"],
  capability: {
    capabilityKey: "docs.update_proposal",
    allowedTools: ["repo_read", "artifact_write"],
    maxRisk: "medium",
    requiresApproval: false
  },
  policy: { action: "allow", riskLevel: "low" },
  budget: { requestedUsd: 0.5, remainingUsd: 5 },
  approvalStatus: null,
  verifier: { required: true, available: true }
};

describe("decideAutonomy", () => {
  it("allows low-risk docs/research/projects internal work to auto-execute at L4", () => {
    const decision = decideAutonomy(baseInput);

    expect(decision.decision).toBe("allow_auto");
    expect(decision.autonomyLevel).toBe("L4");
    expect(decision.verifierRequired).toBe(true);
    expect(decision.reasons).toContain("low_medium_internal_auto_allowed");
  });

  it("allows dev code writes inside the dev role for low/medium Company-internal work", () => {
    const decision = decideAutonomy({
      ...baseInput,
      agentSlug: "dev-agent",
      actionType: "code_write",
      requestedTools: ["repo_write", "test_runner"],
      capability: { capabilityKey: "dev.implementation", allowedTools: ["repo_write", "test_runner"], maxRisk: "medium", requiresApproval: true },
      riskLevel: "medium"
    });

    expect(decision.decision).toBe("allow_auto");
    expect(decision.autonomyLevel).toBe("L4");
    expect(decision.reasons).toContain("dev_role_scoped_internal_patch_allowed_with_verifier");
  });

  it("blocks high and critical risk automatic execution even when policy says allow", () => {
    for (const riskLevel of ["high", "critical"] as const) {
      const decision = decideAutonomy({ ...baseInput, riskLevel, policy: { action: "allow", riskLevel } });

      expect(decision.decision).toBe("require_approval");
      expect(decision.autonomyLevel).toBe("L1");
      expect(decision.reasons).toContain("high_critical_requires_human_decision");
    }
  });

  it("forbids live trading/order/payment/wallet/secret actions", () => {
    for (const actionType of ["live_trading", "order_execution", "payment", "wallet_kyc", "secret_access"] as const) {
      const decision = decideAutonomy({ ...baseInput, actionType, riskLevel: "critical" });

      expect(["block", "require_manual_handoff"]).toContain(decision.decision);
      expect(decision.autonomyLevel).toBe("L6");
      expect(decision.reasons).toContain("forbidden_action_type");
    }
  });

  it("keeps alpha-terminal read-only and isolates auth/crypto/x-cdp from Company scope", () => {
    expect(decideAutonomy({ ...baseInput, projectSlug: "alpha-terminal", requestedTools: ["repo_write"] }).decision).toBe("block");
    expect(decideAutonomy({ ...baseInput, systemScope: "Crypto", projectSlug: "ops-console" }).decision).toBe("block");
    expect(decideAutonomy({ ...baseInput, systemScope: "Auth", projectSlug: "ops-console" }).decision).toBe("block");
  });

  it("pauses scope when budget is exhausted or verifier gate is missing", () => {
    expect(decideAutonomy({ ...baseInput, budget: { requestedUsd: 2, remainingUsd: 1 } }).decision).toBe("pause_scope");
    expect(decideAutonomy({ ...baseInput, verifier: { required: true, available: false } }).decision).toBe("allow_plan_only");
  });

  it("documents the seven autonomy levels", () => {
    expect(AUTONOMY_LEVELS.map((level) => level.level)).toEqual(["L0", "L1", "L2", "L3", "L4", "L5", "L6"]);
  });
});
