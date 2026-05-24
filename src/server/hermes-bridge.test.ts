import { describe, expect, it } from "vitest";
import { buildHermesCompanyTaskPrompt, companyKanbanPayloadForTask, hermesBridgeDecision, hermesPromptPathForTask, hermesReportPathForTask, shouldPublishCompanyReport } from "./hermes-bridge";

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

  it("builds a self-contained prompt with Ops Console task context and external reporting disabled", () => {
    const prompt = buildHermesCompanyTaskPrompt(task, "/Users/domclaw/dom-company");
    expect(prompt).toContain("너는 Company research 에이전트다");
    expect(prompt).toContain("Task ID: task_1");
    expect(prompt).toContain("Kanban Task ID: ops-console-task_1");
    expect(prompt).toContain("Kanban Reviewer: project");
    expect(prompt).toContain("worker는 Kanban 작업을 완료 처리하지 않는다");
    expect(prompt).toContain("Linear/Vercel 스타일 조사");
    expect(prompt).toContain("외부 채널로 직접 보고하지 않는다");
    expect(prompt).toContain("## 핵심 결과");
    expect(prompt).toContain("operator가 GitHub에서 바로 볼 수 있게");
    expect(prompt).toContain(hermesReportPathForTask(task, "/Users/domclaw/dom-company"));
  });

  it("uses Company worker handoff paths and rejects removed trading worker", () => {
    const designTask = { ...task, id: "task/design 1", agent: { id: "agent_design", slug: "design-agent", name: "Design Agent" } };
    expect(hermesReportPathForTask(designTask, "/Users/domclaw/dom-company")).toBe("/Users/domclaw/dom-company/design/ops-console-runs/task-design-1.md");
    expect(hermesPromptPathForTask(designTask, "/Users/domclaw/dom-company")).toBe("/Users/domclaw/dom-company/projects/task-cards/ops-console-task-design-1.md");
    expect(hermesBridgeDecision(designTask, { OPS_AGENT_HERMES_EXEC_ENABLED: "true" })).toMatchObject({ enabled: true, reason: "enabled" });
    expect(hermesBridgeDecision({ ...task, agent: { id: "agent_hq", slug: "hq-agent", name: "HQ Agent" } }, { OPS_AGENT_HERMES_EXEC_ENABLED: "true" })).toMatchObject({ enabled: false, reason: "disabled" });
    expect(hermesBridgeDecision({ ...task, agent: { id: "agent_main", slug: "main-agent", name: "Main Agent" } }, { OPS_AGENT_HERMES_EXEC_ENABLED: "true" })).toMatchObject({ enabled: false, reason: "disabled" });
    expect(hermesBridgeDecision({ ...task, agent: { id: "agent_trading", slug: "trading-agent", name: "Trading Agent" } }, { OPS_AGENT_HERMES_EXEC_ENABLED: "true" })).toMatchObject({ enabled: false, reason: "unsupported_agent" });
  });

  it("builds a Kanban payload that maps Ops Console tasks to Company review flow", () => {
    const payload = companyKanbanPayloadForTask(task, "ready", "/Users/domclaw/dom-company");
    expect(payload).toMatchObject({
      task_id: "ops-console-task_1",
      owner: "research",
      reviewer: "project",
      status: "ready",
      priority: "P3",
      risk_level: "low",
      ops_console_task_id: "task_1"
    });
    expect(payload.prompt_path).toBe("/Users/domclaw/dom-company/projects/task-cards/ops-console-task_1.md");
    expect(payload.report_path).toBe("/Users/domclaw/dom-company/research/ops-console-runs/task_1.md");
    expect(payload.acceptance_criteria.join("\n")).toContain("Worker report includes");
  });

  it("publishes report files to the Company repo unless explicitly disabled", () => {
    expect(shouldPublishCompanyReport({})).toBe(true);
    expect(shouldPublishCompanyReport({ OPS_AGENT_COMPANY_GIT_PUBLISH_ENABLED: "false" })).toBe(false);
  });
});
