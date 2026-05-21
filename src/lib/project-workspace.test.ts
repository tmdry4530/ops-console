import { describe, expect, it } from "vitest";
import { buildProjectWorkspaceProjection, estimatedTaskProgress, workspaceStatusFromTasks } from "./project-workspace";

describe("project workspace projection", () => {
  it("maps Company role-agent tasks into the seven workspace bubbles", () => {
    const projection = buildProjectWorkspaceProjection({
      project: { id: "project_1", slug: "ops-console", name: "Ops Console", status: "active" },
      tasks: [
        { id: "task_hq", title: "HQ routing", status: "running", agent: { slug: "hq-agent" } },
        { id: "task_research", title: "Research references", status: "completed", agent: { slug: "research-agent" } },
        { id: "task_dev", title: "Dev implementation", status: "queued", agent: { slug: "dev-agent" }, nextAction: "project detail slice" }
      ],
      approvals: [{ status: "pending", taskId: "task_hq", riskLevel: "medium" }],
      artifacts: [{ agent: { slug: "research-agent" }, taskId: "task_research" }]
    });

    expect(projection.roles.map((role) => role.key)).toEqual(["lead", "research", "design", "dev", "qa", "docs", "ops"]);
    expect(projection.roles.find((role) => role.key === "lead")).toMatchObject({
      agentSlug: "hq-agent",
      status: "running",
      taskCount: 1,
      approvalCount: 1
    });
    expect(projection.roles.find((role) => role.key === "research")).toMatchObject({
      status: "completed",
      progress: 100,
      artifactCount: 1
    });
    expect(projection.roles.find((role) => role.key === "dev")).toMatchObject({
      status: "queued",
      progress: 10,
      nextAction: "project detail slice"
    });
    expect(projection.summary).toMatchObject({ activeRoleCount: 2, blockedRoleCount: 0, artifactCount: 1, approvalCount: 1 });
  });

  it("keeps empty roles visible as unassigned instead of hiding departments", () => {
    const projection = buildProjectWorkspaceProjection({
      project: { id: "project_2", slug: "alpha-terminal", name: "Alpha Terminal", status: "active" },
      tasks: [],
      approvals: [],
      artifacts: []
    });

    expect(projection.roles).toHaveLength(7);
    expect(projection.roles.every((role) => role.status === "unassigned")).toBe(true);
    expect(projection.summary.syncLabel).toContain("fallback");
  });

  it("uses honest estimated progress from task status and artifacts", () => {
    expect(estimatedTaskProgress("queued")).toBe(10);
    expect(estimatedTaskProgress("waiting_approval")).toBe(25);
    expect(estimatedTaskProgress("waiting_children")).toBe(35);
    expect(estimatedTaskProgress("aggregation_pending")).toBe(80);
    expect(estimatedTaskProgress("awaiting_verifier")).toBe(80);
    expect(estimatedTaskProgress("running")).toBe(60);
    expect(estimatedTaskProgress("running", true)).toBe(85);
    expect(estimatedTaskProgress("completed")).toBe(100);
  });

  it("prioritizes failure/blocker states before runnable states", () => {
    expect(workspaceStatusFromTasks([{ title: "x", status: "running", blocker: "needs operator" }], [])).toBe("blocked");
    expect(workspaceStatusFromTasks([{ title: "x", status: "failed" }, { title: "y", status: "running" }], [])).toBe("failed");
    expect(workspaceStatusFromTasks([{ title: "x", status: "queued" }], [{ status: "pending" }])).toBe("waiting_approval");
    expect(workspaceStatusFromTasks([{ title: "x", status: "waiting_children" }], [])).toBe("waiting_children");
    expect(workspaceStatusFromTasks([{ title: "x", status: "aggregation_pending" }], [])).toBe("aggregation_pending");
  });
});
