import { describe, expect, it } from "vitest";
import { planAutonomousTaskRun, shouldCompleteHqParent, type AutonomousTaskRecord } from "./agent-autonomy";

const safeTask: AutonomousTaskRecord = {
  id: "task_1",
  title: "문서 업데이트",
  summary: "운영 문서 업데이트",
  riskLevel: "low",
  agent: { id: "agent_docs", slug: "docs-agent", name: "Docs Agent" }
};

describe("planAutonomousTaskRun", () => {
  it("lets work agents execute low-risk internal tasks without asking Discord for approval", () => {
    const plan = planAutonomousTaskRun(safeTask, new Date("2026-05-06T00:00:00.000Z"));

    expect(plan.kind).toBe("execute_safe_task");
    expect(plan.taskStatus).toBe("completed");
    expect(plan.agentStatus).toBe("idle");
    expect(plan.adapterArtifact).toMatchObject({
      type: "report",
      path: "artifacts/agents/docs-agent/task_1-docs.update_proposal.md"
    });
    expect(plan.events.map((event) => event.type)).toEqual([
      "agent.adapter.started",
      "agent.adapter.artifact_created",
      "agent.adapter.completed",
      "discord.report.queued"
    ]);
    expect(plan.events.find((event) => event.type === "discord.report.queued")?.metadata).toMatchObject({
      purpose: "result_report",
      approvalRequest: false
    });
  });

  it("executes revenue-facing work agents with configured capability contracts", () => {
    const plan = planAutonomousTaskRun(
      {
        ...safeTask,
        id: "task_projects",
        title: "SaaS 수익 파이프라인 운영표 정리",
        summary: "projects-agent가 revenue pipeline next action을 정리한다.",
        agent: { id: "agent_projects", slug: "projects-agent", name: "Projects Agent" }
      },
      new Date("2026-05-06T00:00:00.000Z")
    );

    expect(plan.kind).toBe("execute_safe_task");
    expect(plan.adapterArtifact).toMatchObject({
      path: "artifacts/agents/projects-agent/task_projects-projects.pipeline_ops.md"
    });
    expect(plan.events.map((event) => event.type)).toEqual([
      "agent.adapter.started",
      "agent.adapter.artifact_created",
      "agent.adapter.completed",
      "discord.report.queued"
    ]);
  });

  it("routes high-risk autonomous work to the Ops Console approval inbox", () => {
    const plan = planAutonomousTaskRun({ ...safeTask, riskLevel: "high", title: "프로덕션 배포" }, new Date("2026-05-06T00:00:00.000Z"));

    expect(plan.kind).toBe("request_console_approval");
    expect(plan.taskStatus).toBe("waiting_approval");
    expect(plan.agentStatus).toBe("waiting_approval");
    expect(plan.approval).toMatchObject({
      status: "pending",
      riskLevel: "high",
      requestedBy: "autonomous-agent-worker"
    });
    expect(plan.events.map((event) => event.type)).toEqual([
      "agent.autonomy.approval_requested",
      "discord.report.queued"
    ]);
    expect(plan.events.find((event) => event.type === "discord.report.queued")?.metadata).toMatchObject({
      purpose: "status_report",
      approvalRequest: false,
      consoleApprovalId: "pending"
    });
  });

  it("keeps HQ parent running until all delegated children are terminal", () => {
    expect(shouldCompleteHqParent(["completed", "failed"])).toBe(true);
    expect(shouldCompleteHqParent(["completed", "running"])).toBe(false);
    expect(shouldCompleteHqParent([])).toBe(false);
  });
});
