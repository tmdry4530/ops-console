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
  it("queues low-risk operator instructions without a second approval gate", () => {
    const plan = planAgentInstruction(baseInput, "operator@example.invalid");

    expect(plan.task.status).toBe("queued");
    expect(plan.task.slug).toMatch(/^ops-crypto-signal-/);
    expect(plan.approval).toBeNull();
    expect(plan.task.nextAction).toContain("승인 없이");
    expect(plan.event.message).toContain("Operator instruction requested");
    expect(plan.event.metadata).toMatchObject({
      projectSlug: "ops-console",
      agentSlug: "main-agent",
      workstream: "operator-instructions",
      threadKey: "ops-console/main-agent/operator-instructions",
      threadPolicy: "reuse_project_agent_thread",
      memoryOwner: "role_profile:main"
    });
  });

  it("maps deployment instructions to deploy approvals", () => {
    const plan = planAgentInstruction({ ...baseInput, actionType: "deploy", riskLevel: "medium" }, "operator@example.invalid");

    expect(plan.task.status).toBe("waiting_approval");
    expect(plan.approval?.status).toBe("pending");
    expect(plan.approval?.type).toBe("deploy");
    expect(plan.approval?.riskLevel).toBe("medium");
  });

  it("forces wallet and high-risk instructions into visible approval gates", () => {
    const walletPlan = planAgentInstruction({ ...baseInput, actionType: "wallet_kyc", riskLevel: "medium" }, "operator@example.invalid");
    const highRiskPlan = planAgentInstruction({ ...baseInput, actionType: "operator_instruction", riskLevel: "high" }, "operator@example.invalid");

    expect(walletPlan.approval?.type).toBe("wallet_kyc");
    expect(walletPlan.approval?.status).toBe("pending");
    expect(highRiskPlan.approval?.riskLevel).toBe("high");
    expect(highRiskPlan.approval?.status).toBe("pending");
  });

  it("rejects blank instructions", () => {
    expect(() => planAgentInstruction({ ...baseInput, instruction: "   " }, "operator@example.invalid")).toThrow("instruction_required");
  });
});
