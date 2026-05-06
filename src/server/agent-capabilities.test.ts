import { describe, expect, it } from "vitest";
import { capabilitySeedsForAgent, selectCapabilityForTask } from "./agent-capabilities";

describe("agent capability registry", () => {
  it("defines safe execution contracts for initial department adapters", () => {
    const docsCapabilities = capabilitySeedsForAgent("docs-agent");

    expect(docsCapabilities).toContainEqual(expect.objectContaining({
      capabilityKey: "docs.update_proposal",
      expectedArtifactType: "report",
      maxRisk: "medium",
      requiresApproval: false
    }));
    expect(docsCapabilities[0]).toMatchObject({
      inputSchema: expect.any(Object),
      outputSchema: expect.any(Object),
      allowedTools: expect.arrayContaining(["repo_read", "artifact_write"]),
      successCriteria: expect.arrayContaining(["artifact_created"]),
      failureModes: expect.arrayContaining(["missing_context"]),
      rollbackOrManualHandoff: expect.any(String)
    });
  });

  it("selects the narrowest capability for a task instead of broad fan-out", () => {
    expect(selectCapabilityForTask("docs-agent", "System-Feedback.md 기준으로 docs/INDEX.md와 log.md 업데이트 proposal 작성")).toMatchObject({
      capabilityKey: "docs.update_proposal"
    });
    expect(selectCapabilityForTask("research-agent", "경쟁사 시장 조사와 근거 citation 정리")).toMatchObject({
      capabilityKey: "research.source_brief"
    });
    expect(selectCapabilityForTask("dev-agent", "ops-console lint typecheck test 실패 로그 요약")).toMatchObject({
      capabilityKey: "dev.validation_proposal"
    });
  });
});
