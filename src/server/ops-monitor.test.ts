import { describe, expect, it } from "vitest";
import {
  effectiveHqChildStatuses,
  heartbeatState,
  hqOrchestrationStatusFromChildren,
  planHqOrchestrationRuntimeTransition,
  summarizeAgentOps,
} from "./ops-monitor";

describe("ops monitor", () => {
  const now = new Date("2026-05-07T10:00:00.000Z");

  it("treats recent heartbeats as live and missing workflow heartbeats as idle-only", () => {
    expect(heartbeatState(new Date("2026-05-07T09:59:30.000Z"), now)).toBe("live");
    expect(heartbeatState(new Date("2026-05-07T09:50:00.000Z"), now)).toBe("stale");
    expect(heartbeatState(null, now)).toBe("not_reported");
  });

  it("keeps HQ parent delegated/waiting instead of running while any delegated child is not terminal", () => {
    expect(hqOrchestrationStatusFromChildren(["completed", "running"])).toBe("waiting_children");
    expect(hqOrchestrationStatusFromChildren(["queued", "queued"])).toBe("waiting_children");
    expect(hqOrchestrationStatusFromChildren(["completed", "failed"])).toBe("aggregation_pending");
  });

  it("treats delegated-authority child chains as terminal when their delegated child completed", () => {
    expect(effectiveHqChildStatuses({
      children: [
        { id: "direct-dev", status: "completed" },
        { id: "role-outside-child", status: "waiting_children" },
        { id: "still-running", status: "waiting_children" },
      ],
      delegatedChildrenByParent: new Map([
        ["role-outside-child", ["completed"]],
        ["still-running", ["queued"]],
      ]),
    })).toEqual(["completed", "completed", "waiting_children"]);

    expect(effectiveHqChildStatuses({
      children: [{ id: "role-outside-child", status: "waiting_children" }],
      delegatedChildrenByParent: new Map([["role-outside-child", ["failed"]]]),
    })).toEqual(["failed"]);
  });

  it("returns parent agent to idle while child tasks are still running", () => {
    expect(planHqOrchestrationRuntimeTransition({
      childStatuses: ["completed", "running", "queued"],
      childTaskIds: ["child-1", "child-2", "child-3"],
      aggregationTask: null,
      now,
    })).toMatchObject({
      parentTask: {
        status: "waiting_children",
        nextAction: "waiting_children · 1/3 child tasks terminal · currentStep=awaiting_child_results · statusReason=delegation_completed",
      },
      parentAgent: { status: "idle", currentTask: null },
      eventMetadata: {
        mode: "orchestration_parent",
        currentStep: "awaiting_child_results",
        statusReason: "delegation_completed",
        childTaskIds: ["child-1", "child-2", "child-3"],
        childTaskCount: 3,
        terminalChildTaskCount: 1,
      },
      createAggregationTask: false,
      completeParent: false,
    });
  });

  it("creates a queued aggregation task when all children are terminal but does not complete parent before verifier", () => {
    const transition = planHqOrchestrationRuntimeTransition({
      childStatuses: ["completed", "failed"],
      childTaskIds: ["child-1", "child-2"],
      aggregationTask: null,
      now,
    });

    expect(transition).toMatchObject({
      parentTask: {
        status: "aggregation_pending",
        nextAction: "aggregation_pending · 2/2 child tasks terminal · verifier gate required before completion",
      },
      parentAgent: { status: "idle", currentTask: null },
      createAggregationTask: true,
      aggregationTask: {
        slugSuffix: "aggregation-20260507100000000",
        status: "queued",
      },
      completeParent: false,
    });
  });

  it("does not complete parent after aggregation until verifier passes", () => {
    expect(planHqOrchestrationRuntimeTransition({
      childStatuses: ["completed"],
      childTaskIds: ["child-1"],
      aggregationTask: { id: "aggregation-1", status: "completed", verifierPassed: false },
      now,
    })).toMatchObject({
      parentTask: {
        status: "awaiting_verifier",
        nextAction: "aggregation_completed · verifier pending · completed 전 verifier gate 유지",
      },
      completeParent: false,
    });

    expect(planHqOrchestrationRuntimeTransition({
      childStatuses: ["completed"],
      childTaskIds: ["child-1"],
      aggregationTask: { id: "aggregation-1", status: "completed", verifierPassed: true },
      now,
    })).toMatchObject({
      parentTask: {
        status: "completed",
        nextAction: "final_completed · aggregation verified at 2026-05-07T10:00:00.000Z",
      },
      completeParent: true,
    });
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
