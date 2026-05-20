import { describe, expect, it } from "vitest";
import { buildProjectSurface } from "./project-surface";

const now = new Date("2026-05-20T00:00:00.000Z");

const baseProject = {
  id: "project_ops",
  slug: "ops-console",
  name: "Ops Console",
  status: "active" as const,
  revenueType: null,
  nextAction: null,
  blocker: null,
  systemScope: "company" as const,
  metadata: {},
  createdAt: now,
  updatedAt: now
};

describe("project surface grouping", () => {
  it("keeps one all-projects section and separates assigned projects by responsible agent", () => {
    const surface = buildProjectSurface([
      {
        ...baseProject,
        tasks: [
          { id: "task_dev", title: "UI split", status: "running", agent: { id: "agent_dev", slug: "dev-agent", name: "Dev Agent" } },
          { id: "task_docs", title: "Guide", status: "queued", agent: { id: "agent_docs", slug: "docs-agent", name: "Docs Agent" } }
        ]
      },
      {
        ...baseProject,
        id: "project_alpha",
        slug: "alpha-terminal",
        name: "Alpha Terminal",
        tasks: [
          { id: "task_dev_alpha", title: "Runtime check", status: "completed", agent: { id: "agent_dev", slug: "dev-agent", name: "Dev Agent" } }
        ]
      }
    ]);

    expect(surface.allProjects.map((project) => project.slug)).toEqual(["ops-console", "alpha-terminal"]);
    expect(surface.byAgent.map((section) => section.agentSlug)).toEqual(["dev-agent", "docs-agent"]);
    expect(surface.byAgent[0]).toMatchObject({ agentName: "Dev Agent", projects: [{ slug: "ops-console" }, { slug: "alpha-terminal" }] });
    expect(surface.byAgent[1]).toMatchObject({ agentName: "Docs Agent", projects: [{ slug: "ops-console" }] });
  });

  it("does not duplicate a project inside the same agent section when one agent has multiple tasks", () => {
    const surface = buildProjectSurface([
      {
        ...baseProject,
        tasks: [
          { id: "task_1", title: "One", status: "queued", agent: { id: "agent_dev", slug: "dev-agent", name: "Dev Agent" } },
          { id: "task_2", title: "Two", status: "running", agent: { id: "agent_dev", slug: "dev-agent", name: "Dev Agent" } }
        ]
      }
    ]);

    expect(surface.byAgent).toHaveLength(1);
    expect(surface.byAgent[0].projects).toHaveLength(1);
    expect(surface.byAgent[0].projects[0].assignmentCount).toBe(2);
  });
});
