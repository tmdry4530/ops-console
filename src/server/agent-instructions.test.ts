import { describe, expect, it } from "vitest";
import { planAgentInstruction, type AgentInstructionInput } from "./agent-instructions";

const baseInput: AgentInstructionInput = {
  agentId: "agent_1",
  agentSlug: "crypto-signal",
  agentName: "Crypto Signal",
  instruction: "뉴스 소스 품질 점검하고 이상 항목 보고",
  actionType: "operator_instruction",
  riskLevel: "low"
};

describe("planAgentInstruction", () => {
  it("creates a pending approval plan for low-risk operator instructions", () => {
    const plan = planAgentInstruction(baseInput, "operator@example.invalid");

    expect(plan.task.status).toBe("waiting_approval");
    expect(plan.task.slug).toMatch(/^ops-crypto-signal-/);
    expect(plan.approval.status).toBe("pending");
    expect(plan.approval.type).toBe("other");
    expect(plan.approval.riskLevel).toBe("low");
    expect(plan.approval.summary).toContain("뉴스 소스 품질 점검");
    expect(plan.event.message).toContain("Operator instruction requested");
  });

  it("maps deployment instructions to deploy approvals", () => {
    const plan = planAgentInstruction({ ...baseInput, actionType: "deploy", riskLevel: "medium" }, "operator@example.invalid");

    expect(plan.approval.type).toBe("deploy");
    expect(plan.approval.riskLevel).toBe("medium");
  });

  it("forces wallet and high-risk instructions into visible approval gates", () => {
    const walletPlan = planAgentInstruction({ ...baseInput, actionType: "wallet_kyc", riskLevel: "medium" }, "operator@example.invalid");
    const highRiskPlan = planAgentInstruction({ ...baseInput, actionType: "operator_instruction", riskLevel: "high" }, "operator@example.invalid");

    expect(walletPlan.approval.type).toBe("wallet_kyc");
    expect(walletPlan.approval.status).toBe("pending");
    expect(highRiskPlan.approval.riskLevel).toBe("high");
    expect(highRiskPlan.approval.status).toBe("pending");
  });

  it("rejects blank instructions", () => {
    expect(() => planAgentInstruction({ ...baseInput, instruction: "   " }, "operator@example.invalid")).toThrow("instruction_required");
  });
});
