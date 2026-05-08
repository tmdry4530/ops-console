import { describe, expect, it } from "vitest";
import { planIdleCompanyWork, standingWorkRunSlug } from "./idle-work-planner";

describe("idle company work planner", () => {
  it("creates a safe standing-work run when Company has no active autonomous work", () => {
    const now = new Date("2026-05-08T00:30:00.000Z");
    const plan = planIdleCompanyWork({ activeAutonomousTasks: 0, existingRunSlugs: [] }, now);

    expect(plan?.runSlug).toBe("company-standing-work-20260508-00");
    expect(plan?.parentTask).toMatchObject({
      slug: "company-standing-work-20260508-00",
      title: "Company 자동 업무 생성 · 2026-05-08 00:00Z",
      status: "running",
      riskLevel: "low",
      nextAction: "자동 생성된 부서별 내부 업무 진행 중"
    });
    expect(plan?.childTasks.map((task) => task.agentSlug)).toEqual([
      "main-agent",
      "research-agent",
      "projects-agent",
      "dev-agent",
      "content-agent",
      "trading-agent",
      "docs-agent"
    ]);
    expect(plan?.childTasks.every((task) => task.status === "running" && task.riskLevel === "low")).toBe(true);
    expect(plan?.childTasks.find((task) => task.agentSlug === "content-agent")?.summary).toContain("외부 발송은 하지 않는다");
    expect(plan?.childTasks.find((task) => task.agentSlug === "trading-agent")?.summary).toContain("제출/거래는 하지 않는다");
  });

  it("does not create duplicate standing work for an already-created slot", () => {
    const now = new Date("2026-05-08T05:59:00.000Z");
    const runSlug = standingWorkRunSlug(now);

    expect(planIdleCompanyWork({ activeAutonomousTasks: 0, existingRunSlugs: [runSlug] }, now)).toBeNull();
  });

  it("does not create extra work while autonomous work is already active", () => {
    const plan = planIdleCompanyWork({ activeAutonomousTasks: 2, existingRunSlugs: [] }, new Date("2026-05-08T06:00:00.000Z"));

    expect(plan).toBeNull();
  });
});
