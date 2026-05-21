import { describe, expect, it } from "vitest";
import {
  buildConversationMetadata,
  deriveProjectConversationRegistry,
  resolveConversationThreadKey
} from "./project-conversations";

const now = new Date("2026-05-16T00:00:00.000Z");

describe("project conversation routing", () => {
  it("resolves stable reusable project/agent/workstream thread keys", () => {
    expect(resolveConversationThreadKey({
      projectSlug: "ops-console",
      agentSlug: "dev-agent",
      workstream: "Project Agent Conversations"
    })).toBe("ops-console/dev-agent/project-agent-conversations");
  });

  it("adds reuse policy and role-profile memory owner metadata", () => {
    expect(buildConversationMetadata({
      projectSlug: "ops-console",
      agentSlug: "docs-agent",
      workstream: "runbook"
    })).toMatchObject({
      projectSlug: "ops-console",
      agentSlug: "docs-agent",
      workstream: "runbook",
      threadKey: "ops-console/docs-agent/runbook",
      threadPolicy: "reuse_project_agent_thread",
      memoryOwner: "role_profile:docs"
    });
  });

  it("derives Discord-like reusable conversation surfaces from tasks, events, and artifacts", () => {
    const registry = deriveProjectConversationRegistry({
      project: { id: "project_1", slug: "ops-console", name: "Ops Console" },
      tasks: [
        {
          id: "task_1",
          title: "Conversation split implementation",
          status: "running",
          agentSlug: "dev-agent",
          createdAt: now,
          updatedAt: now,
          metadata: { workstream: "project-agent-conversations" }
        }
      ],
      events: [
        {
          id: "event_1",
          type: "discord.report.queued",
          severity: "info",
          message: "Discord result report queued: dev-agent",
          agentSlug: "dev-agent",
          createdAt: new Date("2026-05-16T00:01:00.000Z"),
          metadata: buildConversationMetadata({ projectSlug: "ops-console", agentSlug: "dev-agent", workstream: "project-agent-conversations" })
        }
      ],
      artifacts: [
        {
          id: "artifact_1",
          title: "Run report",
          path: "dev/ops-console-runs/example.md",
          agentSlug: "dev-agent",
          createdAt: new Date("2026-05-16T00:02:00.000Z"),
          updatedAt: new Date("2026-05-16T00:02:00.000Z"),
          metadata: { workstream: "project-agent-conversations" }
        }
      ]
    });

    expect(registry.enabled).toBe(true);
    expect(registry.conversations).toHaveLength(1);
    expect(registry.conversations[0]).toMatchObject({
      threadKey: "ops-console/dev-agent/project-agent-conversations",
      projectSlug: "ops-console",
      agentSlug: "dev-agent",
      workstream: "project-agent-conversations",
      title: "Ops Console · Dev Agent · project-agent-conversations",
      status: "running",
      memoryOwner: "role_profile:dev"
    });
    expect(registry.conversations[0].messages.map((message) => message.kind)).toEqual(["task", "event", "artifact"]);
  });

  it("keeps non-active Company projects out of conversation surfaces", () => {
    const registry = deriveProjectConversationRegistry({
      project: { id: "project_2", slug: "crypto-signal", name: "Crypto Signal" },
      tasks: [],
      events: [],
      artifacts: []
    });

    expect(registry.enabled).toBe(false);
    expect(registry.conversations).toEqual([]);
    expect(registry.emptyReason).toContain("ops-console / alpha-terminal");
  });
});
