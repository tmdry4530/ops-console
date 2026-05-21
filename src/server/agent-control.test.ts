import { describe, expect, it } from "vitest";
import { buildAgentControlPlan, isAgentControlAction } from "./agent-control";

const agent = { id: "agent_1", name: "Dev Agent", slug: "dev-agent" };

describe("agent control intervention plans", () => {
  it("queues safe intervention commands with audited agent_control action types", () => {
    for (const action of ["pause", "resume", "cancel", "reprioritize", "reassign", "scope_limit"] as const) {
      const plan = buildAgentControlPlan(action, agent);
      expect(plan.status).toBe("queued");
      expect(plan.commandActionType).toBe(`agent_control_${action}`);
    }
  });

  it("keeps rollback/restart/kill behind approval", () => {
    for (const action of ["rollback", "restart", "kill"] as const) {
      const plan = buildAgentControlPlan(action, agent);
      expect(plan.status).toBe("approval_required");
      expect(plan.riskLevel).toBe("high");
    }
  });

  it("validates supported intervention actions", () => {
    expect(isAgentControlAction("scope-limit")).toBe(true);
    expect(isAgentControlAction("scope_limit")).toBe(true);
    expect(isAgentControlAction("delete_everything")).toBe(false);
  });
});
