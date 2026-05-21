import { describe, expect, it } from "vitest";
import { compileGlobalCommand } from "./command-compiler";

describe("compileGlobalCommand", () => {
  it("compiles safe agent intervention commands into audited CommandQueue plans", () => {
    const plan = compileGlobalCommand("/pause dev-agent --reason overload");

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.kind).toBe("agent_intervention");
    expect(plan.action).toBe("pause");
    expect(plan.targetAgentSlug).toBe("dev-agent");
    expect(plan.riskLevel).toBe("low");
    expect(plan.requiresApproval).toBe(false);
    expect(plan.commandQueuePayload).toMatchObject({ action: "pause", targetAgentSlug: "dev-agent", reason: "overload" });
  });

  it("blocks forbidden or high-risk command text before execution", () => {
    const plan = compileGlobalCommand("/run live order wallet transfer");

    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.reason).toContain("forbidden");
  });

  it("requires approval for rollback/restart/kill actions", () => {
    const plan = compileGlobalCommand("/rollback main-agent --reason bad deploy");

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.requiresApproval).toBe(true);
    expect(plan.riskLevel).toBe("high");
  });
});
