import { describe, expect, it } from "vitest";
import { buildProjectRouterMetadata, normalizeProjectIntake, slugifyProjectSlug } from "./project-intake";

describe("project intake router", () => {
  it("normalizes project registration into a project router shape", () => {
    const intake = normalizeProjectIntake({
      name: "New Agent OS",
      instruction: "컴퍼니 전체로 조사, 설계, 구현 분배해",
      ownerAgentSlug: "hq-agent",
      workstream: "launch-plan"
    });

    expect(intake).toMatchObject({
      name: "New Agent OS",
      slug: "new-agent-os",
      ownerAgentSlug: "hq-agent",
      workstream: "launch-plan",
      riskLevel: "low",
      actionType: "operator_instruction"
    });
  });

  it("supports Discord main-agent goal payloads", () => {
    const intake = normalizeProjectIntake({
      projectName: "디스코드 지시 프로젝트",
      goal: "메인한테 지시하면 자동 분배",
      projectSlug: "discord-main-intake"
    }, "discord_main_agent");
    const metadata = buildProjectRouterMetadata(intake, "discord-main-agent@example.invalid");

    expect(metadata).toMatchObject({
      source: "discord_main_agent",
      projectSlug: "discord-main-intake",
      agentSlug: "hq-agent",
      workstream: "project-intake",
      threadKey: "discord-main-intake/hq-agent/project-intake",
      threadPolicy: "reuse_project_agent_thread",
      memoryOwner: "role_profile:hq"
    });
  });

  it("slugifies Korean and mixed project names safely", () => {
    expect(slugifyProjectSlug("  신규 프로젝트: Alpha ++  ")).toBe("신규-프로젝트-alpha");
  });
});
