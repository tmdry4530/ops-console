import { describe, expect, it } from "vitest";
import { planDepartmentAdapterRun, type DepartmentAdapterTask } from "./department-adapters";

const baseTask: DepartmentAdapterTask = {
  id: "task_1",
  title: "운영 문서 업데이트",
  summary: "System-Feedback.md 기준으로 docs/INDEX.md와 log.md 업데이트 proposal 작성",
  riskLevel: "low",
  projectId: null,
  agent: { id: "agent_docs", slug: "docs-agent", name: "Docs Agent" }
};

describe("department adapter v1", () => {
  it("creates an artifact plan for safe docs-agent work", () => {
    const plan = planDepartmentAdapterRun(baseTask, new Date("2026-05-06T00:00:00.000Z"));

    expect(plan.kind).toBe("artifact_only_execution");
    expect(plan.capabilityKey).toBe("docs.update_proposal");
    expect(plan.artifact).toMatchObject({
      type: "report",
      title: "Docs Agent adapter output · docs.update_proposal",
      path: "artifacts/agents/docs-agent/task_1-docs.update_proposal.md",
      restricted: false
    });
    expect(plan.artifact?.content).toContain("## Adapter Output");
    expect(plan.artifact?.content).toContain("docs/INDEX.md");
    expect(plan.events.map((event) => event.type)).toEqual([
      "agent.adapter.started",
      "agent.adapter.artifact_created",
      "agent.adapter.completed",
      "discord.report.queued"
    ]);
  });

  it("keeps high-risk adapter work behind Ops Console approval", () => {
    const plan = planDepartmentAdapterRun({ ...baseTask, riskLevel: "high", title: "외부 제출 자동화" }, new Date("2026-05-06T00:00:00.000Z"));

    expect(plan.kind).toBe("requires_approval");
    expect(plan.artifact).toBeUndefined();
    expect(plan.events.map((event) => event.type)).toEqual(["agent.adapter.approval_required", "discord.report.queued"]);
    expect(plan.events[0].metadata).toMatchObject({ policyDecision: "require_approval", riskLevel: "high" });
  });

  it("uses specialized adapter content for research and dev agents", () => {
    const research = planDepartmentAdapterRun({
      ...baseTask,
      agent: { id: "agent_research", slug: "research-agent", name: "Research Agent" },
      title: "경쟁사 시장 조사",
      summary: "경쟁사 시장 조사와 citation 정리"
    });
    const dev = planDepartmentAdapterRun({
      ...baseTask,
      agent: { id: "agent_dev", slug: "dev-agent", name: "Dev Agent" },
      title: "테스트 실패 분석",
      summary: "lint typecheck test 실패 로그 요약"
    });

    expect(research.capabilityKey).toBe("research.source_brief");
    expect(research.artifact?.content).toContain("Citation Requirements");
    expect(dev.capabilityKey).toBe("dev.validation_proposal");
    expect(dev.artifact?.content).toContain("Validation Commands");
  });

  it("supports trading alt-candidate scoring as internal signal-only work", () => {
    const plan = planDepartmentAdapterRun({
      ...baseTask,
      id: "task_trading",
      title: "Trading · 오를만한 알트 후보 선별",
      summary: "거래소 데이터의 가격, 거래량, OI, 펀딩비, 롱숏, BTC 상대강도를 기준으로 알트 후보를 점수화한다. 실거래/주문은 하지 않는다.",
      agent: { id: "agent_trading", slug: "trading-agent", name: "Trading Agent" }
    }, new Date("2026-05-08T00:00:00.000Z"));

    expect(plan.kind).toBe("artifact_only_execution");
    expect(plan.capabilityKey).toBe("trading.alt_signal_scoring");
    expect(plan.artifact).toMatchObject({
      type: "report",
      path: "artifacts/agents/trading-agent/task_trading-trading.alt_signal_scoring.md",
      restricted: false
    });
    expect(plan.artifact?.content).toContain("OI");
    expect(plan.artifact?.content).toContain("펀딩비");
    expect(plan.artifact?.content).toContain("실거래/주문 금지");
    expect(plan.events.map((event) => event.type)).toContain("agent.adapter.completed");
  });
});
