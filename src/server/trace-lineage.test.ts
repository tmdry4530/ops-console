import { describe, expect, it } from "vitest";
import { buildTraceLineage } from "./trace-lineage";

describe("buildTraceLineage", () => {
  it("orders operator intent through final report lineage with safe metadata", () => {
    const lineage = buildTraceLineage({
      traceId: "trace-123",
      tasks: [
        { id: "parent", title: "Parent orchestration", status: "running", summary: "delegated waiting_children", nextAction: "waiting_children", createdAt: new Date("2026-05-21T00:00:00Z"), updatedAt: new Date("2026-05-21T00:01:00Z"), agent: { slug: "main-agent", name: "Main Agent" }, artifacts: [] },
        { id: "child", title: "Dev child", status: "completed", summary: null, nextAction: null, createdAt: new Date("2026-05-21T00:02:00Z"), updatedAt: new Date("2026-05-21T00:03:00Z"), agent: { slug: "dev-agent", name: "Dev Agent" }, artifacts: [{ id: "art", title: "Report", path: "dev/report.md", restricted: false }] }
      ],
      events: [
        { id: "evt1", type: "operator.intent.received", message: "Operator intent", severity: "info", createdAt: new Date("2026-05-21T00:00:00Z"), metadata: { traceId: "trace-123", secret: "SHOULD_NOT_LEAK", compiledCommand: "/route dev" } },
        { id: "evt2", type: "autonomy.governor.decision", message: "allow_auto", severity: "info", createdAt: new Date("2026-05-21T00:01:00Z"), metadata: { traceId: "trace-123", decision: "allow_auto" } },
        { id: "evt3", type: "verification.passed", message: "verified", severity: "info", createdAt: new Date("2026-05-21T00:04:00Z"), metadata: { traceId: "trace-123", verifier: "tests" } }
      ],
      commands: [{ id: "cmd", actionType: "agent_control_pause", status: "completed", riskLevel: "low", createdAt: new Date("2026-05-21T00:00:30Z"), updatedAt: new Date("2026-05-21T00:00:45Z"), payload: { traceId: "trace-123", action: "pause", token: "NO" } }],
      artifacts: [{ id: "art", title: "Report", path: "dev/report.md", restricted: false, createdAt: new Date("2026-05-21T00:03:00Z"), updatedAt: new Date("2026-05-21T00:03:00Z") }]
    });

    expect(lineage.stages.map((stage) => stage.key)).toEqual([
      "operator_intent",
      "compiled_command",
      "autonomy_decision",
      "orchestration",
      "model_tool_calls",
      "artifacts",
      "verification",
      "final_report"
    ]);
    expect(JSON.stringify(lineage)).not.toContain("SHOULD_NOT_LEAK");
    expect(JSON.stringify(lineage)).not.toContain("token");
    expect(lineage.parentTasks[0].orchestrationState).toBe("delegated/waiting_children");
  });
});
