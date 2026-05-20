import { describe, expect, it } from "vitest";
import { planHqOrchestration, selectDepartmentsForInstruction } from "./hq-orchestration";

describe("HQ orchestration planner", () => {
  it("routes broad Company instructions to all department agents", () => {
    const selected = selectDepartmentsForInstruction("컴퍼니 전체 에이전트로 새 제품 런칭 준비해줘");

    expect(selected.map((agent) => agent.slug)).toEqual([
      "main-agent",
      "research-agent",
      "projects-agent",
      "dev-agent",
      "content-agent",
      "design-agent",
      "docs-agent"
    ]);
  });

  it("routes Discord main-agent goals as auto-start orchestration work", () => {
    const plan = planHqOrchestration("Discord main-agent 목표: 프로젝트 워크스페이스 완전 자동화", "discord:main-agent", new Date("2026-05-21T00:10:00Z"));

    expect(plan.runId).toBe("hq-20260521001000");
    expect(plan.delegations.map((task) => task.agentSlug)).toEqual(["projects-agent", "dev-agent", "design-agent", "docs-agent"]);
    expect(plan.delegations.every((task) => task.status === "queued")).toBe(true);
    expect(plan.delegations[0].metadata).toMatchObject({ executionMode: "auto_multi_agent", requestedBy: "discord:main-agent" });
    expect(plan.discordReports[0].metadata).toMatchObject({ stage: "hq_started", orchestrationRunId: "hq-20260521001000" });
  });

  it("routes code/research instructions to matching agents and docs", () => {
    const plan = planHqOrchestration("SyncSpace 코드 분석하고 구현 개선안 검증해줘", "operator@example.invalid", new Date("2026-05-06T01:00:00Z"));

    expect(plan.runId).toBe("hq-20260506010000");
    expect(plan.delegations.map((task) => task.agentSlug)).toEqual(["research-agent", "dev-agent", "docs-agent"]);
    expect(plan.delegations.every((task) => task.status === "queued")).toBe(true);
    expect(plan.discordReports[0].channel).toBe("hq");
    expect(plan.discordReports.map((report) => report.channel)).toContain("research");
    expect(plan.discordReports.map((report) => report.channel)).toContain("dev");
    expect(plan.discordReports.map((report) => report.channel)).toContain("docs");
  });

  it("defaults ambiguous HQ work to research/dev/docs", () => {
    const plan = planHqOrchestration("새 아이디어 하나 진행해봐", "operator@example.invalid");

    expect(plan.delegations.map((task) => task.agentSlug)).toEqual(["research-agent", "dev-agent", "docs-agent"]);
  });
});
