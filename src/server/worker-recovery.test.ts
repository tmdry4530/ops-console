import { describe, expect, it } from "vitest";
import { buildWorkerRecoveryPlan } from "./worker-recovery";

describe("worker recovery", () => {
  it("does nothing for live leases", () => {
    const now = new Date("2026-05-20T00:00:00.000Z");
    const plan = buildWorkerRecoveryPlan({ taskId: "task_1", taskTitle: "Live", claimedBy: "worker-a", leaseExpiresAt: new Date("2026-05-20T00:01:00.000Z"), now });
    expect(plan).toBeNull();
  });

  it("moves stale leased tasks to retry_scheduled and records an incident", () => {
    const now = new Date("2026-05-20T00:02:00.000Z");
    const plan = buildWorkerRecoveryPlan({ taskId: "task_1", taskTitle: "Stale", claimedBy: "worker-a", leaseExpiresAt: new Date("2026-05-20T00:01:00.000Z"), now, traceId: "trace_1" });
    expect(plan?.update).toMatchObject({ status: "retry_scheduled", statusReason: "lease_expired:worker-a", claimedBy: null, leaseExpiresAt: null });
    expect(plan?.incident).toMatchObject({ type: "worker.lease_expired", severity: "warning", traceId: "trace_1", taskId: "task_1" });
  });
});
