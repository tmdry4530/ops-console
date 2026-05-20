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
  it("queues low-risk internal operator instructions without a redundant approval", () => {
    const plan = planAgentInstruction(baseInput, "operator@example.invalid");

    expect(plan.task.status).toBe("queued");
    expect(plan.task.slug).toMatch(/^ops-crypto-signal-/);
    expect(plan.approval).toBeNull();
    expect(plan.task.nextAction).toContain("자동 작업 큐");
    expect(plan.event.message).toContain("Operator instruction requested");
  });

  it("maps deployment instructions to deploy approvals", () => {
    const plan = planAgentInstruction({ ...baseInput, actionType: "deploy", riskLevel: "medium" }, "operator@example.invalid");

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

  it("auto-starts main-agent orchestration plans from Discord goals", () => {
    const plan = planAgentInstruction({ ...baseInput, agentId: "agent_main", agentSlug: "main-agent", agentName: "Main Agent", instruction: "프로젝트 워크스페이스 완전 자동화", riskLevel: "medium" }, "discord:main-agent");

    expect(plan.task.status).toBe("running");
    expect(plan.approval).toBeNull();
    expect(plan.task.nextAction).toContain("하위 에이전트 자동 분배");
    expect(plan.event.metadata).toMatchObject({ actionType: "operator_instruction", executionMode: "auto_multi_agent" });
  });
});
