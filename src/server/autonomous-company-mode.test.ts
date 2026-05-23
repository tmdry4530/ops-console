import { describe, expect, it } from "vitest";
import {
  buildAutonomySchedulerDraft,
  buildAutonomyRunPlan,
  buildImprovementCandidate,
  buildMarketOpportunityCandidate,
  buildOwnerDecisionPacket,
  buildProjectDraftFromCandidate,
  evaluateAutonomyControlAction,
  evaluateAutonomyPolicy,
  runIdeaProjectFactory,
  runMarketOpportunityRadar,
  runServiceImprovementRadar,
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
      ["product_activation", "require_owner_approval"],
      ["browser_storage_read", "block"],
      ["private key access", "block"],
      ["place order", "block"]
    ] as const;
    for (const [actionType, decision] of cases) {
      expect(evaluateAutonomyPolicy({ actionType, riskLevel: "medium", visibility: "internal", scopeApproved: true }).decision).toBe(decision);
    }
  });

  it("enforces per-agent autonomy boundaries as hard blocks", () => {
    expect(evaluateAutonomyPolicy({ actionType: "deploy", primaryAgent: "research-agent", riskLevel: "medium", visibility: "internal", scopeApproved: true })).toMatchObject({ decision: "block", riskLevel: "critical" });
    expect(evaluateAutonomyPolicy({ actionType: "write_code", primaryAgent: "research-agent", riskLevel: "medium", visibility: "internal", scopeApproved: true }).reasons).toContain("research_agent_cannot_deploy_or_write_code");
    expect(evaluateAutonomyPolicy({ actionType: "external_publish", primaryAgent: "content-agent", riskLevel: "medium", visibility: "external", scopeApproved: true }).decision).toBe("block");
    expect(evaluateAutonomyPolicy({ actionType: "public_deploy", primaryAgent: "dev-agent", riskLevel: "medium", visibility: "public", scopeApproved: true }).reasons).toContain("dev_agent_cannot_public_deploy_or_access_secrets");
  });

  it("buildAutonomyRunPlan carries gate and agent context into policy evaluation", () => {
    const plan = buildAutonomyRunPlan({ runType: "product_activation", primaryAgent: "projects-agent", now: new Date("2026-05-24T00:00:00Z"), gates: { productActivation: true } });
    expect(plan.status).toBe("waiting_approval");
    expect(plan.decision).toBe("require_owner_approval");
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
      problem: "Dashboard slow because private key material leaked in logs",
      evidence: [{ title: "log", source: "trace", summary: "private key material", confidence: "high" }]
    });
    expect(JSON.stringify(candidate)).not.toContain("synthetic-long-marker");
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

describe("radars and idea project factory", () => {
  it("generates service improvement candidates from service health signals", () => {
    const result = runServiceImprovementRadar({
      services: [{ name: "Ops Console", area: "latency", symptom: "Control page p95 fetch is slow", confidence: "medium" }]
    });
    expect(result.run.runType).toBe("service_improvement_radar");
    expect(result.improvements).toHaveLength(1);
    expect(result.improvements[0]).toMatchObject({ area: "latency", riskLevel: "medium", autonomyFit: "auto_execute" });
    expect(result.run.candidateIds).toContain(result.improvements[0].id);
  });

  it("generates market opportunity candidates with evidence packs and excludes memecoin noise", () => {
    const result = runMarketOpportunityRadar({
      signals: [
        { title: "AI support audit", summary: "B2B teams need internal support deflection", source: "trusted-market-note", confidence: "high" },
        { title: "AI support audit", summary: "Competitors shorten support setup", source: "competitor-site", confidence: "medium" },
        { title: "Pepe bot", summary: "memecoin pump monitor", source: "social", confidence: "high" }
      ]
    });
    expect(result.run.runType).toBe("market_opportunity_radar");
    expect(result.opportunities.some((item) => item.status === "ready_for_review")).toBe(true);
    expect(result.opportunities.some((item) => item.excludedReason?.includes("memecoin"))).toBe(true);
  });

  it("turns ready candidates into project drafts and owner decision packets", () => {
    const opportunity = buildMarketOpportunityCandidate({
      title: "Internal support copilot",
      summary: "Evidence-backed support workflow opportunity",
      evidence: [
        { title: "market", source: "trusted", summary: "demand", confidence: "high" },
        { title: "competitor", source: "trusted2", summary: "validated", confidence: "medium" }
      ]
    });
    const result = runIdeaProjectFactory({ candidates: [opportunity] });
    expect(result.run.runType).toBe("idea_project_factory");
    expect(result.projectDrafts).toHaveLength(1);
    expect(result.ownerDecisionRequests[0].requestedByAgent).toBe("main-agent");
    expect(result.ownerDecisionRequests[0].contextSummary).not.toContain("raw log");
    expect(result.run.projectDraftIds).toContain(result.projectDrafts[0].id);
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

  it("plans executable autonomy runs with trace event artifact and verification linkage", () => {
    const plan = buildAutonomyRunPlan({ runType: "service_improvement_radar", primaryAgent: "projects-agent", now: new Date("2026-05-24T00:00:00Z") });
    expect(plan.status).toBe("queued");
    expect(plan.decision).toBe("allow_with_verification");
    expect(plan.traceId).toMatch(/^trace-autonomy-service-improvement-radar/);
    expect(plan.eventIds.length).toBeGreaterThan(0);
    expect(plan.artifactIds.length).toBeGreaterThan(0);
    expect(plan.verificationIds.length).toBeGreaterThan(0);
    expect(plan.steps.map((step) => step.agent)).toEqual(expect.arrayContaining(["projects-agent", "docs-agent.verifier"]));
  });

  it("evaluates pause resume lower and emergency-stop controls without allowing authority expansion", () => {
    expect(evaluateAutonomyControlAction({ action: "pause", currentLevel: "L5" })).toMatchObject({ decision: "allow", nextState: "paused" });
    expect(evaluateAutonomyControlAction({ action: "lower_autonomy", currentLevel: "L5", requestedLevel: "L3" })).toMatchObject({ decision: "allow", nextLevel: "L3" });
    expect(evaluateAutonomyControlAction({ action: "emergency_stop", currentLevel: "L5" })).toMatchObject({ decision: "allow", nextState: "emergency_stop" });
    expect(evaluateAutonomyControlAction({ action: "resume", currentLevel: "L5" }).decision).toBe("require_owner_approval");
    expect(evaluateAutonomyControlAction({ action: "raise_autonomy", currentLevel: "L3", requestedLevel: "L5" }).decision).toBe("require_owner_approval");
  });

  it("builds concise main-agent owner confirmation packets without raw logs", () => {
    const packet = buildOwnerDecisionPacket({
      title: "Activate ProjectDraft",
      ownerQuestion: "프로젝트로 전환할까?",
      contextSummary: "raw log: private key material should not leak",
      options: [{ id: "approve", label: "Approve", summary: "Activate", pros: ["fast"], cons: ["risk"], riskLevel: "medium" }],
      gates: { public: false, external: false, paid: false, production: false, secrets: false, mainBranch: false, highCritical: false, scopeExpansion: false }
    });
    expect(packet.body).toContain("Decision Needed");
    expect(packet.body).toContain("[REDACTED_SECRET_LIKE]");
    expect(packet.body).not.toContain("synthetic-long-marker");
  });

  it("sanitizes owner decision persistence inputs before DB/UI exposure", () => {
    const sanitized = sanitizeOwnerDecisionInput({
      title: "Approve private key material",
      ownerQuestion: "Use private key for deployment? private key should redact",
      contextSummary: "raw log private key material and browser storage dump",
      requestedByAgent: "main-agent private key material",
      gates: { secrets: true, note: "private key material" },
      traceId: "trace-private key material"
    });
    expect(JSON.stringify(sanitized)).not.toContain("synthetic-long-marker");
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
