import { describe, expect, it } from "vitest";
import { canAutoRunRisk, claimedTaskData, completionVerificationCreate, makeTraceId, maxAttemptsForRisk, requiresVerificationBeforeCompletion, verifiedCompletionTaskData } from "./task-state-machine";

describe("task state machine safety", () => {
  it("requires verification before a task can be treated as completed", () => {
    expect(requiresVerificationBeforeCompletion("completed", "pending")).toBe(true);
    expect(requiresVerificationBeforeCompletion("completed", "passed")).toBe(false);
    expect(requiresVerificationBeforeCompletion("running", "pending")).toBe(false);
  });

  it("creates deterministic trace id shape without leaking inputs", () => {
    const traceId = makeTraceId({ systemScope: "company", projectSlug: "ops-console", agentSlug: "dev-agent", date: new Date("2026-05-20T00:00:00.000Z"), entropy: "abc123xyz" });
    expect(traceId).toBe("trace_20260520_company_ops-console_dev-agent_abc123xy");
  });

  it("adds worker claim metadata and lease expiry", () => {
    const now = new Date("2026-05-20T00:00:00.000Z");
    const data = claimedTaskData("worker-a", now, 60_000);
    expect(data).toMatchObject({ status: "claimed", claimedBy: "worker-a", claimedAt: now, heartbeatAt: now });
    expect((data.leaseExpiresAt as Date).toISOString()).toBe("2026-05-20T00:01:00.000Z");
  });

  it("encodes risk retry policy", () => {
    expect(canAutoRunRisk("medium")).toBe(true);
    expect(canAutoRunRisk("high")).toBe(false);
    expect(maxAttemptsForRisk("low")).toBe(3);
    expect(maxAttemptsForRisk("medium")).toBe(2);
    expect(maxAttemptsForRisk("critical")).toBe(1);
  });

  it("builds a verified completion update paired with verification evidence", () => {
    const update = verifiedCompletionTaskData({ verifiedBy: "docs-agent", evidence: { artifactId: "art_1" }, nextAction: "done" });
    expect(update).toMatchObject({ status: "completed", verificationStatus: "passed", statusReason: "verified_by:docs-agent", nextAction: "done" });
    const verification = completionVerificationCreate({ taskId: "task_1", verifier: "docs-agent", checks: ["artifact_linked"], evidence: { artifactId: "art_1" }, traceId: "trace_1" });
    expect(verification).toMatchObject({ taskId: "task_1", verifier: "docs-agent", status: "passed", traceId: "trace_1" });
  });
});
