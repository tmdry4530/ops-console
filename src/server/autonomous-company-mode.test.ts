import { describe, expect, it } from "vitest";
import {
  buildAutonomySchedulerDraft,
  buildImprovementCandidate,
  buildMarketOpportunityCandidate,
  buildOwnerDecisionPacket,
  buildProjectDraftFromCandidate,
  evaluateAutonomyPolicy,
  sanitizeEvidencePack,
  sanitizeOwnerDecisionInput
} from "./autonomous-company-mode";

describe("evaluateAutonomyPolicy", () => {
  it("allows low/medium private internal work inside approved scope", () => {
    expect(evaluateAutonomyPolicy({ actionType: "service_improvement_scan", riskLevel: "medium", visibility: "internal", scopeApproved: true })).toMatchObject({
      decision: "allow_with_verification",
      requiresOwnerApproval: false,
      verifierRequired: true
    });
  });

  it("routes high critical public external paid production secret and main branch gates to owner or block", () => {
    expect(evaluateAutonomyPolicy({ actionType: "public_release", riskLevel: "high", visibility: "public", scopeApproved: true }).decision).toBe("require_owner_approval");
    expect(evaluateAutonomyPolicy({ actionType: "read_secret", riskLevel: "critical", visibility: "internal", scopeApproved: true, gates: { secrets: true } })).toMatchObject({ decision: "block", requiresOwnerApproval: true });
    expect(evaluateAutonomyPolicy({ actionType: "scope_expand", riskLevel: "medium", visibility: "internal", scopeApproved: false }).decision).toBe("require_owner_approval");
  });

  it("detects forbidden action variants even when callers omit explicit gates", () => {
    const cases = [
      ["env_update", "require_owner_approval"],
      ["runtime env change", "require_owner_approval"],
      ["config_update", "require_owner_approval"],
      ["raise_autonomy_level", "require_owner_approval"],
      ["main branch direct modification", "require_owner_approval"],
      ["browser_storage_read", "block"],
      ["private key access", "block"]
    ] as const;
    for (const [actionType, decision] of cases) {
      expect(evaluateAutonomyPolicy({ actionType, riskLevel: "medium", visibility: "internal", scopeApproved: true }).decision).toBe(decision);
    }
  });
});

describe("candidate factory", () => {
  it("creates secret-safe opportunity candidates and excludes memecoin opportunities", () => {
    const candidate = buildMarketOpportunityCandidate({
      title: "Memecoin launch monitor",
      summary: "Track memecoin hype",
      evidence: [{ title: "source", source: "https://example.com", summary: "memecoin trend", confidence: "medium" }]
    });
    expect(candidate.status).toBe("rejected");
    expect(candidate.excludedReason).toContain("memecoin");
  });

  it("redacts secret-like evidence before creating improvement candidates", () => {
    const candidate = buildImprovementCandidate({
      title: "Ops latency audit",
      area: "latency",
      problem: "Dashboard slow because token=abc12345678901234567890 leaked in logs",
      evidence: [{ title: "log", source: "trace", summary: "Bearer abc12345678901234567890", confidence: "high" }]
    });
    expect(JSON.stringify(candidate)).not.toContain("abc12345678901234567890");
    expect(JSON.stringify(candidate)).toContain("[REDACTED_SECRET_LIKE]");
  });

  it("converts candidates to project drafts requiring owner confirmation before activation", () => {
    const opportunity = buildMarketOpportunityCandidate({
      title: "B2B onboarding audit",
      summary: "Improve onboarding conversion",
      evidence: [
        { title: "competitor", source: "https://competitor.example", summary: "fewer steps", confidence: "high" },
        { title: "internal", source: "trace:abc", summary: "dropoff", confidence: "medium" }
      ]
    });
    const draft = buildProjectDraftFromCandidate(opportunity);
    expect(draft.status).toBe("needs_owner_decision");
    expect(draft.requiredOwnerDecision.reason).toContain("project activation");
  });
});

describe("scheduler and owner packet", () => {
  it("builds bounded scheduler drafts with budget and concurrency guardrails", () => {
    const draft = buildAutonomySchedulerDraft({ now: new Date("2026-05-24T00:00:00+09:00") });
    expect(draft.concurrency.globalMaxRuns).toBeLessThanOrEqual(3);
    expect(draft.jobs.map((job) => job.type)).toContain("service_improvement_radar");
    expect(draft.jobs.map((job) => job.type)).toContain("market_opportunity_radar");
    expect(draft.guardrails.blockedScopes).toContain("Auth/Crypto/Alpha/X-CDP scope expansion");
  });

  it("builds concise main-agent owner confirmation packets without raw logs", () => {
    const packet = buildOwnerDecisionPacket({
      title: "Activate ProjectDraft",
      ownerQuestion: "프로젝트로 전환할까?",
      contextSummary: "raw log: token=abc12345678901234567890 should not leak",
      options: [{ id: "approve", label: "Approve", summary: "Activate", pros: ["fast"], cons: ["risk"], riskLevel: "medium" }],
      gates: { public: false, external: false, paid: false, production: false, secrets: false, mainBranch: false, highCritical: false, scopeExpansion: false }
    });
    expect(packet.body).toContain("Decision Needed");
    expect(packet.body).toContain("[REDACTED_SECRET_LIKE]");
    expect(packet.body).not.toContain("abc12345678901234567890");
  });

  it("sanitizes owner decision persistence inputs before DB/UI exposure", () => {
    const sanitized = sanitizeOwnerDecisionInput({
      title: "Approve token=abc12345678901234567890",
      ownerQuestion: "Use private key for deployment? private key should redact",
      contextSummary: "raw log Bearer abc12345678901234567890 and browser storage dump",
      requestedByAgent: "main-agent token=abc12345678901234567890",
      gates: { secrets: true, note: "token=abc12345678901234567890" },
      traceId: "trace-token=abc12345678901234567890"
    });
    expect(JSON.stringify(sanitized)).not.toContain("abc12345678901234567890");
    expect(JSON.stringify(sanitized)).not.toContain("raw log Bearer");
    expect(sanitized.gates).toEqual({ secrets: true });
    expect(JSON.stringify(sanitized)).toContain("[REDACTED_SECRET_LIKE]");
  });

  it("sanitizes evidence packs and rejects low confidence single source readiness", () => {
    const pack = sanitizeEvidencePack([{ title: "one", source: "url", summary: "single", confidence: "low" }]);
    expect(pack.readyForOwner).toBe(false);
    expect(pack.qualityGate).toContain("low-confidence");
  });
});
