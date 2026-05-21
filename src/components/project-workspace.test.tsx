import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectWorkspace } from "./project-workspace";
import type { ProjectWorkspaceProjection } from "@/lib/project-workspace";

const workspace: ProjectWorkspaceProjection = {
  project: { id: "project_1", slug: "ops-console", name: "Ops Console", status: "active" },
  summary: {
    overallProgress: 0,
    statusLabel: "active",
    activeRoleCount: 0,
    blockedRoleCount: 0,
    artifactCount: 0,
    approvalCount: 0,
    syncLabel: "자동 동기화 · 5-8초 폴링/SSE fallback 예정"
  },
  roles: [
    {
      key: "lead",
      title: "Lead",
      agentSlug: "hq-agent",
      status: "unassigned",
      capabilityHint: "프로젝트 라우팅 · 우선순위 · 승인 분기",
      progress: 0,
      taskCount: 0,
      artifactCount: 0,
      approvalCount: 0
    },
    {
      key: "research",
      title: "Research",
      agentSlug: "research-agent",
      status: "unassigned",
      capabilityHint: "자료 조사 · 근거 수집 · 비교표",
      progress: 0,
      taskCount: 0,
      artifactCount: 0,
      approvalCount: 0
    }
  ]
};

describe("ProjectWorkspace visual layout", () => {
  it("keeps role title/agent separated from the status badge so labels are not squeezed", () => {
    const { container } = render(<ProjectWorkspace workspace={workspace} />);

    expect(screen.getByText("Lead")).toBeVisible();
    expect(screen.getByText("Research")).toBeVisible();
    expect(container.querySelectorAll(".workspace-role-primary")).toHaveLength(2);
    expect(container.querySelectorAll(".workspace-role-status")).toHaveLength(2);
    expect(container.querySelector(".workspace-role-top .badge")).toBeNull();
  });
});
