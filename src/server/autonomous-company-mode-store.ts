import { db } from "@/lib/db";
import {
  buildAutonomySchedulerDraft,
  buildImprovementCandidate,
  buildMarketOpportunityCandidate,
  buildOwnerDecisionPacket,
  buildProjectDraftFromCandidate,
  evaluateAutonomyPolicy,
  sanitizeOwnerDecisionInput,
  type RiskLevel,
  type Visibility
} from "./autonomous-company-mode";

type DbWithAutonomy = typeof db & {
  autonomyPolicy?: { findMany: Function; create: Function; updateMany: Function };
  autonomyRun?: { findMany: Function; create: Function; updateMany: Function };
  opportunityCandidate?: { findMany: Function; create: Function };
  improvementCandidate?: { findMany: Function; create: Function };
  projectDraft?: { findMany: Function; create: Function };
  ownerDecisionRequest?: { findMany: Function; create: Function };
};

const adb = db as DbWithAutonomy;

function isMissingAutonomyTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /does not exist|Unknown arg|Cannot read|not a function|P2021|P2022/i.test(message);
}

export async function getAutonomyControlSummary() {
  const scheduler = buildAutonomySchedulerDraft({ now: new Date() });
  const [policies, runs, ownerRequests] = await Promise.all([
    safeFind(() => adb.autonomyPolicy?.findMany({ orderBy: { updatedAt: "desc" }, take: 20 }) ?? []),
    safeFind(() => adb.autonomyRun?.findMany({ orderBy: { updatedAt: "desc" }, take: 20 }) ?? []),
    safeFind(() => adb.ownerDecisionRequest?.findMany({ where: { status: "open" }, orderBy: { updatedAt: "desc" }, take: 20 }) ?? [])
  ]);
  return {
    generatedAt: new Date(),
    currentMode: policies[0]?.maxAutonomyLevel ?? "L5",
    emergencyState: policies.find((policy: any) => policy.emergencyState !== "normal")?.emergencyState ?? "normal",
    policyMatrix: [
      { risk: "low", decision: "자동 허용", detail: "trace/event 기록" },
      { risk: "medium", decision: "검증 후 허용", detail: "docs/verifier evidence" },
      { risk: "high", decision: "오너 승인", detail: "hq-agent secondary" },
      { risk: "critical", decision: "차단/수동", detail: "emergency/manual handoff" }
    ],
    scheduler,
    runs,
    policies,
    ownerRequests,
    metrics: {
      activeRuns: runs.filter((run: any) => ["queued", "running", "waiting_children", "waiting_approval", "verifying"].includes(run.status)).length,
      gated: runs.filter((run: any) => ["require_owner_approval", "block", "require_manual_handoff"].includes(run.decision)).length,
      ownerInbox: ownerRequests.length,
      pausedScopes: policies.filter((policy: any) => policy.emergencyState !== "normal").length
    }
  };
}

export async function getOpportunityCandidates() {
  const rows = await safeFind(() => adb.opportunityCandidate?.findMany({ orderBy: { updatedAt: "desc" }, take: 50 }) ?? []);
  if (rows.length > 0) return rows;
  return [buildMarketOpportunityCandidate({ title: "B2B onboarding audit", summary: "온보딩 마찰을 줄이는 internal opportunity", evidence: [{ title: "internal trace", source: "trace:sample", summary: "dropoff observed", confidence: "medium" }, { title: "competitor", source: "https://example.com", summary: "shorter onboarding", confidence: "medium" }] })];
}

export async function getImprovementCandidates() {
  const rows = await safeFind(() => adb.improvementCandidate?.findMany({ orderBy: { updatedAt: "desc" }, take: 50 }) ?? []);
  if (rows.length > 0) return rows;
  return [buildImprovementCandidate({ title: "Control page latency audit", area: "latency", problem: "Ops Console operator surface can be audited for slow data fetches", evidence: [{ title: "operator ux", source: "internal", summary: "manual observation", confidence: "medium" }, { title: "trace", source: "trace:sample", summary: "candidate scan", confidence: "medium" }] })];
}

export async function getOwnerInbox() {
  const rows = await safeFind(() => adb.ownerDecisionRequest?.findMany({ where: { status: "open" }, orderBy: [{ riskLevel: "desc" }, { updatedAt: "desc" }], take: 50 }) ?? []);
  if (rows.length > 0) return rows;
  const packet = buildOwnerDecisionPacket({
    title: "Activate Autonomous Company Mode ProjectDraft",
    ownerQuestion: "ProjectDraft를 실제 Project로 activation할까?",
    contextSummary: "Scoped implementation is ready for owner review. Public/prod/external/paid/secret gates stay blocked.",
    options: [{ id: "approve", label: "Approve scoped activation", summary: "Create internal project tasks only", pros: ["fast"], cons: ["needs verifier"], riskLevel: "medium" }],
    gates: { public: false, external: false, paid: false, production: false, secrets: false, mainBranch: false, highCritical: false, scopeExpansion: false }
  });
  return [{ id: "owner-sample", title: packet.title, ownerQuestion: "ProjectDraft를 실제 Project로 activation할까?", contextSummary: packet.body, riskLevel: "medium", status: "open", traceId: "trace-owner-sample", requestedByAgent: "main-agent", gates: {}, evidenceRefs: [] }];
}

export async function getAutonomyRuns() {
  const rows = await safeFind(() => adb.autonomyRun?.findMany({ orderBy: { updatedAt: "desc" }, take: 80 }) ?? []);
  if (rows.length > 0) return rows;
  return [{ id: "run-sample", runType: "service_improvement_radar", status: "queued", decision: "allow_with_verification", primaryAgent: "projects-agent", traceId: "trace-run-sample", metrics: { candidatesCreated: 1 }, createdAt: new Date(), updatedAt: new Date() }];
}

export async function createOwnerDecisionRequest(input: { title: string; ownerQuestion: string; contextSummary: string; riskLevel?: RiskLevel; requestedByAgent?: string; gates?: Record<string, boolean>; traceId?: string }) {
  const riskLevel = input.riskLevel ?? "medium";
  const policy = evaluateAutonomyPolicy({ actionType: "owner_decision_request", riskLevel, visibility: "internal" as Visibility, scopeApproved: true, gates: input.gates });
  const sanitized = sanitizeOwnerDecisionInput(input);
  if (!adb.ownerDecisionRequest?.create) return { fallback: true, policy, traceId: sanitized.traceId };
  return adb.ownerDecisionRequest.create({ data: { title: sanitized.title, requestedByAgent: sanitized.requestedByAgent, decisionType: "approve", urgency: riskLevel === "high" || riskLevel === "critical" ? "high" : "normal", riskLevel, ownerQuestion: sanitized.ownerQuestion, contextSummary: sanitized.contextSummary, gates: sanitized.gates, allowedResponses: ["approve", "reject", "request_changes", "manual_handoff"], traceId: sanitized.traceId } });
}

export function draftProjectFromOpportunity(candidate: any) {
  return buildProjectDraftFromCandidate(candidate);
}

async function safeFind<T>(fn: () => Promise<T> | T): Promise<T extends unknown[] ? T : any[]> {
  try {
    return await fn() as any;
  } catch (error) {
    if (isMissingAutonomyTable(error)) return [] as any;
    throw error;
  }
}
