import { describe, expect, it } from "vitest";
import { heartbeatState, hqOrchestrationStatusFromChildren, summarizeAgentOps } from "./ops-monitor";

describe("ops monitor", () => {
  const now = new Date("2026-05-07T10:00:00.000Z");

  it("treats recent heartbeats as live and missing workflow heartbeats as idle-only", () => {
    expect(heartbeatState(new Date("2026-05-07T09:59:30.000Z"), now)).toBe("live");
    expect(heartbeatState(new Date("2026-05-07T09:50:00.000Z"), now)).toBe("stale");
    expect(heartbeatState(null, now)).toBe("not_reported");
  });

  it("keeps HQ parent running while any delegated child is not terminal", () => {
    expect(hqOrchestrationStatusFromChildren(["completed", "running"])).toBe("running");
    expect(hqOrchestrationStatusFromChildren(["completed", "failed"])).toBe("completed");
    expect(hqOrchestrationStatusFromChildren(["queued", "queued"])).toBe("running");
  });

  it("summarizes company agent management state for operator view", () => {
    expect(summarizeAgentOps({ slug: "projects-agent", status: "running", currentTask: "HQ 위임", heartbeatAt: null }, now)).toMatchObject({
      slug: "projects-agent",
      runtime: "workflow_running",
      heartbeat: "not_reported",
      operatorAction: "작업 진행 확인"
    });
    expect(summarizeAgentOps({ slug: "crypto-signal", status: "running", currentTask: "collector", heartbeatAt: new Date("2026-05-07T09:59:40.000Z") }, now)).toMatchObject({
      runtime: "process_live",
      heartbeat: "live",
      operatorAction: "모니터링 유지"
    });
  });
});
