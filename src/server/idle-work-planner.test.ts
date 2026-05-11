import { describe, expect, it } from "vitest";
import { planIdleCompanyWork, standingWorkRunSlug } from "./idle-work-planner";

describe("idle company work planner", () => {
  it("creates a safe realtime standing-work run when Company has no active autonomous work", () => {
    const now = new Date("2026-05-08T00:30:45.000Z");
    const plan = planIdleCompanyWork({ activeAutonomousTasks: 0, existingRunSlugs: [] }, now);

    expect(plan?.runSlug).toBe("company-standing-work-20260508-003045");
    expect(plan?.parentTask).toMatchObject({
      slug: "company-standing-work-20260508-003045",
      title: "Company 자동 업무 생성 · 2026-05-08 00:30:45Z",
      status: "running",
      riskLevel: "low",
      nextAction: "자동 생성된 부서별 내부 업무 진행 중"
    });
    expect(plan?.childTasks.map((task) => task.agentSlug)).toEqual([
      "main-agent",
      "research-agent",
      "projects-agent",
      "dev-agent",
      "docs-agent"
    ]);
    expect(plan?.childTasks.every((task) => task.status === "running" && task.riskLevel === "low")).toBe(true);
    expect(plan?.childTasks.find((task) => task.agentSlug === "main-agent")?.summary).toContain("ops-console/alpha-terminal로만");
    expect(plan?.childTasks.find((task) => task.agentSlug === "main-agent")?.summary).not.toContain("CapyFi");
    expect(plan?.childTasks.find((task) => task.agentSlug === "projects-agent")?.summary).toContain("ops-console/alpha-terminal만");
    expect(plan?.childTasks.some((task) => ["content-agent", "trading-agent"].includes(task.agentSlug))).toBe(false);
  });

  it("does not create duplicate realtime standing work for the same timestamp", () => {
    const now = new Date("2026-05-08T05:59:07.000Z");
    const runSlug = standingWorkRunSlug(now);

    expect(runSlug).toBe("company-standing-work-20260508-055907");
    expect(planIdleCompanyWork({ activeAutonomousTasks: 0, existingRunSlugs: [runSlug] }, now)).toBeNull();
  });

  it("creates another run as soon as previous autonomous work has drained", () => {
    const previous = standingWorkRunSlug(new Date("2026-05-08T05:59:07.000Z"));
    const plan = planIdleCompanyWork({ activeAutonomousTasks: 0, existingRunSlugs: [previous] }, new Date("2026-05-08T05:59:08.000Z"));

    expect(plan?.runSlug).toBe("company-standing-work-20260508-055908");
  });

  it("does not create extra work while autonomous work is already active", () => {
    const plan = planIdleCompanyWork({ activeAutonomousTasks: 2, existingRunSlugs: [] }, new Date("2026-05-08T06:00:00.000Z"));

    expect(plan).toBeNull();
  });
});
