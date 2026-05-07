import { describe, expect, it } from "vitest";
import { buildHermesCompanyTaskPrompt, hermesBridgeDecision, hermesReportPathForTask } from "./hermes-bridge";

const task = {
  id: "task_1",
  title: "Research · 포트폴리오 레퍼런스 조사",
  summary: "Linear/Vercel 스타일 조사",
  riskLevel: "low" as const,
  projectId: "project_1",
  agent: { id: "agent_research", slug: "research-agent", name: "Research Agent" }
};

describe("hermes company execution bridge", () => {
  it("stays disabled unless the kill switch is explicitly enabled", () => {
    expect(hermesBridgeDecision(task, { OPS_AGENT_HERMES_EXEC_ENABLED: "false" })).toMatchObject({ enabled: false, reason: "disabled" });
  });

  it("allows safe department tasks when enabled", () => {
    expect(hermesBridgeDecision(task, { OPS_AGENT_HERMES_EXEC_ENABLED: "true" })).toMatchObject({ enabled: true, reason: "enabled" });
  });

  it("blocks high-risk tasks from the Hermes bridge", () => {
    expect(hermesBridgeDecision({ ...task, riskLevel: "high" }, { OPS_AGENT_HERMES_EXEC_ENABLED: "true" })).toMatchObject({ enabled: false, reason: "risk_not_allowed" });
  });

  it("builds a self-contained prompt with Ops Console task context and Discord reporting", () => {
    const prompt = buildHermesCompanyTaskPrompt(task, "/Users/domclaw/dom-company");
    expect(prompt).toContain("너는 Company research 에이전트다");
    expect(prompt).toContain("Task ID: task_1");
    expect(prompt).toContain("Linear/Vercel 스타일 조사");
    expect(prompt).toContain("Discord research 채널");
    expect(prompt).toContain(hermesReportPathForTask(task, "/Users/domclaw/dom-company"));
  });
});
