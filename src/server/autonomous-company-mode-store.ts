import { db } from "@/lib/db";
import {
  buildAutonomyRunPlan,
  buildAutonomySchedulerDraft,
  buildImprovementCandidate,
  buildMarketOpportunityCandidate,
  buildOwnerDecisionPacket,
  buildProjectDraftFromCandidate,
  buildFullAuthorityModePolicy,
  evaluateAutonomyPolicy,
  runIdeaProjectFactory,
  runMarketOpportunityRadar,
  runServiceImprovementRadar,
  sanitizeOwnerDecisionInput,
  type EvidenceConfidence,
  type ImprovementCandidate,
  type RiskLevel,
  type Visibility
} from "./autonomous-company-mode";

type DbWithAutonomy = typeof db & {
  autonomyPolicy?: { findMany: Function; create: Function; updateMany: Function };
  autonomyRun?: { findMany: Function; create: Function; updateMany: Function };
  opportunityCandidate?: { findMany: Function; create: Function; upsert: Function };
  improvementCandidate?: { findMany: Function; create: Function; upsert: Function };
  projectDraft?: { findMany: Function; create: Function; upsert: Function };
  ownerDecisionRequest?: { findMany: Function; create: Function; upsert: Function };
};

const adb = db as DbWithAutonomy;

function isMissingAutonomyTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /does not exist|Unknown arg|Cannot read|not a function|P2021|P2022/i.test(message);
}

export async function getAutonomyControlSummary() {
  const scheduler = buildAutonomySchedulerDraft({ now: new Date() });
  const fullAuthorityPolicy = buildFullAuthorityModePolicy({ now: new Date() });
  const [policies, runs, ownerRequests] = await Promise.all([
    safeFind(() => adb.autonomyPolicy?.findMany({ orderBy: { updatedAt: "desc" }, take: 20 }) ?? []),
    safeFind(() => adb.autonomyRun?.findMany({ orderBy: { updatedAt: "desc" }, take: 20 }) ?? []),
    safeFind(() => adb.ownerDecisionRequest?.findMany({ where: { status: "open" }, orderBy: { updatedAt: "desc" }, take: 20 }) ?? [])
  ]);
  const isFullAuthorityActive = policies.some((policy: any) => policy.scopeKey === "company:autonomous-company-mode:enabled_full_authority_within_constitution" && policy.metadata?.runtimeActivationApproved === true);
  return {
    generatedAt: new Date(),
    currentMode: policies[0]?.maxAutonomyLevel ?? "L5",
    authorityMode: isFullAuthorityActive ? "enabled_full_authority_within_constitution" : "enabled_persistent_pilot",
    fullAuthorityPolicy,
    ownerInboxMode: fullAuthorityPolicy.ownerInboxMode,
    emergencyState: policies.find((policy: any) => policy.emergencyState !== "normal")?.emergencyState ?? "normal",
    policyMatrix: [
      { risk: "low", decision: "자동 허용", detail: "trace/event 기록" },
      { risk: "medium", decision: "검증 후 허용", detail: "docs/verifier evidence" },
      { risk: "high", decision: "Full authority protocol gate", detail: "constitution + hq protocol + docs verifier" },
      { risk: "critical", decision: "Exception-only owner inbox", detail: "non-delegable/raw-secret/authority changes blocked" }
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
  if (!adb.ownerDecisionRequest?.create) return { fallback: true, policy, ...sanitized, riskLevel, status: "open" };
  try {
    const data = { title: sanitized.title, requestedByAgent: sanitized.requestedByAgent, decisionType: "approve", urgency: riskLevel === "high" || riskLevel === "critical" ? "high" : "normal", riskLevel, ownerQuestion: sanitized.ownerQuestion, contextSummary: sanitized.contextSummary, gates: sanitized.gates, allowedResponses: ["approve", "reject", "request_changes", "manual_handoff"], traceId: sanitized.traceId, eventIds: [`event-${sanitized.traceId}`], artifactIds: [`artifact-${sanitized.traceId}`], verificationIds: [`verification-${sanitized.traceId}`] };
    if (adb.ownerDecisionRequest.upsert) return await adb.ownerDecisionRequest.upsert({ where: { traceId: sanitized.traceId }, create: data, update: data });
    return await adb.ownerDecisionRequest.create({ data });
  } catch (error) {
    if (isMissingAutonomyTable(error)) return { fallback: true, policy, ...sanitized, riskLevel, status: "open" };
    throw error;
  }
}

export async function createAutonomyRunDraft(input: { runType: string; primaryAgent?: string; riskLevel?: RiskLevel }) {
  const primaryAgent = input.primaryAgent ?? (input.runType === "market_opportunity_radar" ? "research-agent" : input.runType === "executive_brief" ? "content-agent" : "projects-agent");
  const plan = buildAutonomyRunPlan({ runType: input.runType, primaryAgent, riskLevel: input.riskLevel, now: new Date() });
  return persistAutonomyRun(plan);
}

export async function createServiceImprovementRadarRun(input: { services?: { name: string; area: ImprovementCandidate["area"]; symptom: string; confidence: EvidenceConfidence }[] }) {
  const result = runServiceImprovementRadar({ now: new Date(), services: input.services?.length ? input.services : [{ name: "Ops Console", area: "operator_ux", symptom: "Autonomous Company Mode should continuously audit operator workflows", confidence: "medium" }] });
  await persistAutonomyRun(result.run);
  const improvements = [];
  for (const item of result.improvements) {
    improvements.push(await persistImprovementCandidate(item));
  }
  return { ...result, improvements };
}

export async function createMarketOpportunityRadarRun(input: { signals?: { title: string; summary: string; source: string; confidence: EvidenceConfidence }[] }) {
  const result = runMarketOpportunityRadar({ now: new Date(), signals: input.signals?.length ? input.signals : [
    { title: "Internal operations copilot", summary: "Teams need reliable internal workflow copilots with approvals", source: "company:market-radar", confidence: "medium" },
    { title: "Internal operations copilot", summary: "Competitors emphasize governed automation and auditability", source: "company:competitor-radar", confidence: "medium" }
  ] });
  await persistAutonomyRun(result.run);
  const opportunities = [];
  for (const item of result.opportunities) {
    opportunities.push(await persistOpportunityCandidate(item));
  }
  return { ...result, opportunities };
}

export async function createIdeaProjectFactoryRun(input: { candidates?: any[] }) {
  const candidates = input.candidates?.length ? input.candidates : [buildMarketOpportunityCandidate({ title: "Autonomous Company Mode", summary: "Governed internal autonomous operating loop", evidence: [{ title: "policy", source: "company:policy", summary: "owner gates active", confidence: "medium" }, { title: "ops", source: "ops-console", summary: "candidate records supported", confidence: "medium" }] })];
  const result = runIdeaProjectFactory({ candidates, now: new Date() });
  await persistAutonomyRun(result.run);
  const projectDrafts = [];
  for (const draft of result.projectDrafts) {
    projectDrafts.push(await persistProjectDraft(draft));
  }
  const ownerDecisionRequests = [];
  for (const decision of result.ownerDecisionRequests) {
    ownerDecisionRequests.push(await createOwnerDecisionRequest({ ...decision, riskLevel: "medium", gates: decision.gates as Record<string, boolean> }));
  }
  return { ...result, projectDrafts, ownerDecisionRequests };
}

async function persistAutonomyRun(plan: ReturnType<typeof buildAutonomyRunPlan>) {
  if (!adb.autonomyRun?.create) return { ...plan, fallback: true };
  try {
    return await adb.autonomyRun.create({ data: autonomyRunData(plan) });
  } catch (error) {
    if (isMissingAutonomyTable(error)) return { ...plan, fallback: true };
    throw error;
  }
}

function autonomyRunData(plan: ReturnType<typeof buildAutonomyRunPlan>) {
  return {
    id: plan.id,
    runType: plan.runType,
    status: plan.status,
    trigger: { source: "api", mode: "autonomous_company_mode_mvp" },
    decision: plan.decision,
    primaryAgent: plan.primaryAgent,
    childRunIds: [],
    candidateIds: plan.candidateIds,
    projectDraftIds: plan.projectDraftIds,
    ownerDecisionRequestIds: plan.ownerDecisionRequestIds,
    eventIds: plan.eventIds,
    traceId: plan.traceId,
    artifactIds: plan.artifactIds,
    verificationIds: plan.verificationIds,
    metrics: plan.metrics
  };
}

async function persistOpportunityCandidate(item: ReturnType<typeof buildMarketOpportunityCandidate>) {
  if (!adb.opportunityCandidate?.create) return { ...item, fallback: true };
  const data = { id: item.id, title: item.title, status: item.status, source: { type: "market_opportunity_radar" }, summary: item.summary, marketSignals: item.evidenceRefs, competitorSignals: [], confidence: item.confidence, riskLevel: item.riskLevel, visibility: item.visibility, excludedReason: item.excludedReason, eventIds: [`event-${item.traceId}`], traceId: item.traceId, artifactIds: [`artifact-${item.traceId}`], verificationIds: [`verification-${item.traceId}`] };
  try {
    if (adb.opportunityCandidate.upsert) return await adb.opportunityCandidate.upsert({ where: { id: item.id }, create: data, update: data });
    return await adb.opportunityCandidate.create({ data });
  } catch (error) {
    if (isMissingAutonomyTable(error)) return { ...item, fallback: true };
    throw error;
  }
}

async function persistImprovementCandidate(item: ReturnType<typeof buildImprovementCandidate>) {
  if (!adb.improvementCandidate?.create) return { ...item, fallback: true };
  const data = { id: item.id, title: item.title, status: item.status, area: item.area, detectedBy: "service_improvement_radar", signalRefs: item.evidenceRefs, problem: item.problem, impact: { internal: true }, proposedFix: `Prepare scoped ${item.area} improvement with tests and rollback`, autonomyFit: item.autonomyFit, riskLevel: item.riskLevel, visibility: item.visibility, eventIds: [`event-${item.traceId}`], traceId: item.traceId, artifactIds: [`artifact-${item.traceId}`], verificationIds: [`verification-${item.traceId}`] };
  try {
    if (adb.improvementCandidate.upsert) return await adb.improvementCandidate.upsert({ where: { id: item.id }, create: data, update: data });
    return await adb.improvementCandidate.create({ data });
  } catch (error) {
    if (isMissingAutonomyTable(error)) return { ...item, fallback: true };
    throw error;
  }
}

async function persistProjectDraft(draft: ReturnType<typeof buildProjectDraftFromCandidate>) {
  if (!adb.projectDraft?.create) return { ...draft, fallback: true };
  const data = { id: draft.id, title: draft.title, sourceCandidateIds: [draft.sourceCandidateId], status: draft.status, summary: draft.summary, problem: draft.summary, proposedOutcome: "Owner-approved internal project activation", scope: { publicDeploy: false, externalSend: false, secretAccess: false }, classification: { risk: "medium", visibility: "internal" }, successCriteria: draft.successCriteria, milestones: [], tasks: [], dependencies: [], blockers: [], requiredOwnerDecisionIds: [], artifactIds: [`artifact-${draft.traceId}`], eventIds: [`event-${draft.traceId}`], traceId: draft.traceId, verificationIds: [`verification-${draft.traceId}`] };
  try {
    if (adb.projectDraft.upsert) return await adb.projectDraft.upsert({ where: { id: draft.id }, create: data, update: data });
    return await adb.projectDraft.create({ data });
  } catch (error) {
    if (isMissingAutonomyTable(error)) return { ...draft, fallback: true };
    throw error;
  }
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
