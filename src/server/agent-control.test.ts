import { describe, expect, it } from "vitest";
import { buildAgentControlPlan } from "./agent-control";

describe("agent control actions", () => {
  it("gates destructive runtime controls through Ops Console approval", () => {
    expect(buildAgentControlPlan("kill", { id: "a1", name: "Dev Agent", slug: "dev-agent" })).toMatchObject({
      status: "approval_required",
      riskLevel: "high",
      approvalTitle: "에이전트 제어 승인 필요 · Dev Agent",
      eventType: "agent.control.requested"
    });
  });

  it("allows safe retry requests as audited low-risk control commands", () => {
    expect(buildAgentControlPlan("retry", { id: "a1", name: "Dev Agent", slug: "dev-agent" })).toMatchObject({
      status: "queued",
      riskLevel: "medium",
      commandActionType: "agent_retry"
    });
  });
});
