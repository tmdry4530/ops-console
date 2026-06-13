import { describe, expect, it, vi } from "vitest";
import { compileOpsCommand, decideControlActionPolicy, redactOpsRecord, safeCompiledCommandResponse, secretSafeMetadata } from "./ops-control-plane";

describe("secretSafeMetadata", () => {
  it("keeps only allowlisted primitive metadata and drops secret-shaped fields", () => {
    expect(secretSafeMetadata({
      traceId: "tr_1",
      latencyMs: 42,
      token: "secret-token",
      Authorization: "Bearer x",
      nested: { ok: true },
      model: "gpt-test",
      privateKey: "pem"
    })).toEqual({ traceId: "tr_1", latencyMs: 42, model: "gpt-test" });
  });
});

describe("control action policy", () => {
  it("queues low and medium internal actions", () => {
    expect(decideControlActionPolicy({ actionType: "pause", riskLevel: "low" })).toMatchObject({ decision: "allow_queue", status: "queued", commandStatus: "queued" });
    expect(decideControlActionPolicy({ actionType: "scope_limit" })).toMatchObject({ decision: "allow_queue", status: "queued" });
  });

  it("gates high and critical actions with approval/manual records instead of execution", () => {
    expect(decideControlActionPolicy({ actionType: "rollback" })).toMatchObject({ decision: "require_approval", status: "approval_required", commandStatus: "waiting_approval", riskLevel: "high" });
    expect(decideControlActionPolicy({ actionType: "emergency_stop" })).toMatchObject({ decision: "require_manual_handoff", status: "manual_handoff", commandStatus: "waiting_manual_handoff", riskLevel: "critical" });
  });

  it("allows only explicit pre-approved break-glass pure containment freeze to queue", () => {
    expect(decideControlActionPolicy({ actionType: "pure_containment_freeze" })).toMatchObject({ decision: "require_approval", status: "approval_required", commandStatus: "waiting_approval", riskLevel: "high" });
    expect(decideControlActionPolicy({ actionType: "pure_containment_freeze", breakGlass: true })).toMatchObject({ decision: "require_approval", status: "approval_required", riskLevel: "high" });
    expect(decideControlActionPolicy({ actionType: "pure_containment_freeze", breakGlass: true, breakGlassPreApproved: true })).toMatchObject({ decision: "allow_queue", status: "queued", riskLevel: "high" });
  });
});

describe("compileOpsCommand", () => {
  it("blocks forbidden secret terms", () => {
    const compiled = compileOpsCommand("/pause dev-agent --reason inspect token");
    expect(compiled.ok).toBe(false);
    if (!compiled.ok) expect(compiled.blockedTerms).toContain("token");
  });

  it("adds control policy to compiled commands", () => {
    const compiled = compileOpsCommand("/rollback dev-agent --reason bad deploy");
    expect(compiled.ok).toBe(true);
    if (compiled.ok) {
      expect(compiled.policy).toMatchObject({ decision: "require_approval", commandStatus: "waiting_approval" });
      expect(compiled.requiresApproval).toBe(true);
    }
  });

  it("returns only secret-safe compiled command response fields", () => {
    const success = safeCompiledCommandResponse(compileOpsCommand("/pause dev-agent --reason normal ops check --scope project only"));
    expect(success).toMatchObject({ ok: true, action: "pause", commandQueuePayload: { action: "pause", targetAgentSlug: "dev-agent" } });
    expect(JSON.stringify(success)).not.toContain("normal ops check");
    expect(JSON.stringify(success)).not.toContain("raw");

    const blocked = safeCompiledCommandResponse(compileOpsCommand("/pause dev-agent --reason token"));
    expect(blocked).toMatchObject({ ok: false, reason: "blocked_by_policy" });
    expect(JSON.stringify(blocked)).not.toContain("/pause");
    expect(JSON.stringify(blocked)).not.toContain("token");
  });
});

describe("redactOpsRecord", () => {
  it("redacts nested JSON fields and secret-like free text", () => {
    const redacted = redactOpsRecord({
      id: "evt_1",
      message: "contains password marker",
      metadata: { traceId: "tr_1", token: "abc", reason: "normal" },
      payload: { action: "pause", password: "abc", targetAgentSlug: "dev-agent" },
      result: { output: "private key here", latencyMs: 20 }
    });
    expect(redacted.message).toBe("[REDACTED_SECRET_LIKE]");
    expect(redacted.metadata).toEqual({ traceId: "tr_1" });
    expect(redacted.payload).toEqual({ action: "pause", targetAgentSlug: "dev-agent" });
    expect(redacted.result).toEqual({ latencyMs: 20 });
  });
});

describe("getOpsOverview", () => {
  it("returns an empty optional control-plane section when deployed tables or columns are missing", async () => {
    vi.resetModules();
    const missingTable = Object.assign(new Error("The table public.OrchestrationRun does not exist in the current database."), { code: "P2021" });
    const missingColumn = Object.assign(new Error("The column ModelCall.spanId does not exist in the current database."), { code: "P2022" });
    vi.doMock("@/lib/db", () => ({
      db: {
        orchestrationRun: { findMany: vi.fn().mockRejectedValue(missingTable) },
        controlAction: { findMany: vi.fn().mockRejectedValue(missingColumn) },
        traceSpan: { findMany: vi.fn().mockRejectedValue(missingTable) }
      }
    }));
    vi.doMock("./control-center", () => ({
      getControlCenterSummary: vi.fn().mockResolvedValue({ summary: { agents: 0 } })
    }));

    const { getOpsOverview } = await import("./ops-control-plane");

    await expect(getOpsOverview()).resolves.toEqual({
      summary: { agents: 0 },
      orchestrationRuns: [],
      controlActions: [],
      traceSpans: []
    });
    vi.doUnmock("@/lib/db");
    vi.doUnmock("./control-center");
  });
});
