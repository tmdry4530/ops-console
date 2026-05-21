import { describe, expect, it } from "vitest";
import { planAggregationAfterChildTerminals, parentDelegationStateAfterDispatch } from "./autonomy-orchestration";

describe("autonomy orchestration state", () => {
  it("returns main-agent to idle and marks parent as delegated/waiting_children after child dispatch", () => {
    const state = parentDelegationStateAfterDispatch(7, "2026-05-21T02:00:00.000Z");

    expect(state.parentTask).toMatchObject({
      status: "waiting_children",
      nextAction: "waiting_children · 0/7 child tasks terminal · currentStep=awaiting_child_results · statusReason=delegation_completed"
    });
    expect(state.parentEventMetadata).toMatchObject({ orchestrationState: "waiting_children", childTaskCount: 7 });
    expect(state.mainAgent).toEqual({ status: "idle", currentTask: null });
  });

  it("creates aggregation only when every child task is terminal", () => {
    expect(planAggregationAfterChildTerminals({ parentTaskId: "parent", childStatuses: ["completed", "failed"], now: new Date("2026-05-21T02:00:00.000Z") })).toMatchObject({
      shouldCreateAggregation: true,
      aggregationTask: {
        slugSuffix: "aggregation-20260521020000000",
        status: "queued",
        nextAction: "main-agent aggregation queued · verifier evidence required before parent completion"
      },
      parentTask: { status: "aggregation_pending" },
      mainAgent: { status: "idle", currentTask: null }
    });

    expect(planAggregationAfterChildTerminals({ parentTaskId: "parent", childStatuses: ["completed", "running"], now: new Date("2026-05-21T02:00:00.000Z") }).shouldCreateAggregation).toBe(false);
  });
});
