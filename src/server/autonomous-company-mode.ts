export type RiskLevel = "low" | "medium" | "high" | "critical";
export type Visibility = "private" | "internal" | "external" | "public";
export type AutonomyDecision = "allow" | "allow_with_verification" | "require_owner_approval" | "require_manual_handoff" | "block" | "pause" | "lower_autonomy";
export type EvidenceConfidence = "low" | "medium" | "high";

export type PolicyGates = Partial<Record<"public" | "external" | "paid" | "production" | "secrets" | "mainBranch" | "highCritical" | "scopeExpansion" | "authCryptoAlphaXcdp" | "liveTrading" | "orderExecution" | "productActivation", boolean>>;

export type AutonomyPolicyInput = {
  actionType: string;
  riskLevel: RiskLevel;
  visibility: Visibility;
  scopeApproved: boolean;
  primaryAgent?: string;
  gates?: PolicyGates;
};

export type AutonomyPolicyResult = {
  decision: AutonomyDecision;
  riskLevel: RiskLevel;
  requiresOwnerApproval: boolean;
  verifierRequired: boolean;
  hqReviewRequired: boolean;
  reasons: string[];
};

const RISK_WEIGHT: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };
const CRITICAL_ACTION_RE = /(read[\s_-]*secret|secret|token|cookie|browser[\s_-]*storage|private[\s_-]*key|database[\s_-]*url|db[\s_-]*url|DATABASE_URL|wallet|live[\s_-]*trading|trade[\s_-]*execution|place[\s_-]*order|order[\s_-]*(execution|placement)|approval[\s_-]*bypass|self[\s_-]*authority|credential)/i;
const OWNER_GATE_RE = /(deploy|publish|external[\s_-]*send|public[\s_-]*release|paid|production|main[\s_-]*branch|scope[\s_-]*(expand|expansion)|project[\s_-]*activation|product[\s_-]*activation|mvp|runtime[\s_-]*(config|env|credential)|env[\s_-]*(update|change)|config[\s_-]*(update|change)|credential[\s_-]*(update|change)|raise[\s_-]*autonomy|authority[\s_-]*expansion)/i;
const RESEARCH_FORBIDDEN_RE = /(deploy|write[\s_-]*code|code[\s_-]*write|modify[\s_-]*(file|code)|implementation|public|publish)/i;
const CONTENT_FORBIDDEN_RE = /(external[\s_-]*(publish|send|post)|publish[\s_-]*external|public[\s_-]*publish|send[\s_-]*(email|kakao|instagram|line)|social[\s_-]*post)/i;
const DEV_FORBIDDEN_RE = /(public[\s_-]*(deploy|release|publish)|deploy[\s_-]*public|secret|token|cookie|browser[\s_-]*storage|private[\s_-]*key|database[\s_-]*url|db[\s_-]*url|DATABASE_URL)/i;
const SECRET_LIKE_RE = /(bearer\s+[a-z0-9._~+/=-]{12,}|token\s*[=:]\s*[^\s`]{12,}|cookie\s*[=:]\s*[^\s`]{12,}|password\s*[=:]\s*[^\s`]{8,}|private\s*key|browser\s*storage|database_url|db\s*url|sk-[a-z0-9_-]{12,})/gi;
const MEMECOIN_RE = /memecoin|meme coin|doge|shib|pepe/i;

function riskAtLeast(risk: RiskLevel, threshold: RiskLevel) {
  return RISK_WEIGHT[risk] >= RISK_WEIGHT[threshold];
}

function gateReasons(gates: PolicyGates = {}) {
  return Object.entries(gates).filter(([, active]) => active).map(([gate]) => `${gate}_gate`);
}

function violatesAgentBoundary(primaryAgent: string | undefined, actionType: string, visibility: Visibility, gates: PolicyGates = {}) {
  const agent = primaryAgent ?? "";
  if (agent === "research-agent" && RESEARCH_FORBIDDEN_RE.test(actionType)) return "research_agent_cannot_deploy_or_write_code";
  if (agent === "content-agent" && (CONTENT_FORBIDDEN_RE.test(actionType) || visibility === "external" || visibility === "public" || gates.external || gates.public)) return "content_agent_cannot_external_publish";
  if (agent === "dev-agent" && (DEV_FORBIDDEN_RE.test(actionType) || visibility === "public" || gates.public || gates.secrets)) return "dev_agent_cannot_public_deploy_or_access_secrets";
  return undefined;
}

export function redactSecretLikeText(text: string) {
  return text.replace(SECRET_LIKE_RE, "[REDACTED_SECRET_LIKE]");
}

export function evaluateAutonomyPolicy(input: AutonomyPolicyInput): AutonomyPolicyResult {
  const reasons = gateReasons(input.gates);
  const gates = input.gates ?? {};
  const criticalGate = gates.secrets || gates.liveTrading || gates.orderExecution || CRITICAL_ACTION_RE.test(input.actionType);
  const ownerGate = gates.public || gates.external || gates.paid || gates.production || gates.mainBranch || gates.scopeExpansion || gates.authCryptoAlphaXcdp || gates.productActivation || OWNER_GATE_RE.test(input.actionType) || input.visibility === "public" || input.visibility === "external" || !input.scopeApproved;
  const agentBoundaryViolation = violatesAgentBoundary(input.primaryAgent, input.actionType, input.visibility, gates);

  if (agentBoundaryViolation) {
    return { decision: "block", riskLevel: "critical", requiresOwnerApproval: true, verifierRequired: true, hqReviewRequired: true, reasons: [...reasons, agentBoundaryViolation] };
  }
  if (criticalGate) {
    return { decision: "block", riskLevel: "critical", requiresOwnerApproval: true, verifierRequired: true, hqReviewRequired: true, reasons: [...reasons, "critical_or_secret_like_action_blocked"] };
  }
  if (riskAtLeast(input.riskLevel, "high") || gates.highCritical || ownerGate) {
    return { decision: "require_owner_approval", riskLevel: input.riskLevel, requiresOwnerApproval: true, verifierRequired: true, hqReviewRequired: true, reasons: [...reasons, input.scopeApproved ? "owner_gate_triggered" : "scope_not_approved"] };
  }
  if (input.riskLevel === "medium") {
    return { decision: "allow_with_verification", riskLevel: input.riskLevel, requiresOwnerApproval: false, verifierRequired: true, hqReviewRequired: false, reasons: ["medium_internal_allowed_with_verification"] };
  }
  return { decision: "allow", riskLevel: input.riskLevel, requiresOwnerApproval: false, verifierRequired: false, hqReviewRequired: false, reasons: ["low_internal_allowed"] };
}

export type EvidenceInput = { title: string; source: string; summary: string; confidence: EvidenceConfidence };
export type EvidenceRef = EvidenceInput & { id: string; summary: string; capturedAt: string };

export function sanitizeEvidencePack(evidence: EvidenceInput[]) {
  const refs: EvidenceRef[] = evidence.map((item, index) => ({
    id: `evidence-${index + 1}`,
    title: redactSecretLikeText(item.title).slice(0, 160),
    source: redactSecretLikeText(item.source).slice(0, 240),
    summary: redactSecretLikeText(item.summary).slice(0, 600),
    confidence: item.confidence,
    capturedAt: new Date(0).toISOString()
  }));
  const highEnough = refs.filter((item) => item.confidence === "medium" || item.confidence === "high").length >= 2;
  const readyForOwner = highEnough;
  return { refs, readyForOwner, qualityGate: readyForOwner ? "evidence-ready" : "low-confidence or single-source evidence requires enrichment" };
}

export type OpportunityCandidate = {
  id: string;
  type: "opportunity";
  title: string;
  status: "new" | "ready_for_review" | "rejected";
  summary: string;
  confidence: EvidenceConfidence;
  riskLevel: RiskLevel;
  visibility: Visibility;
  evidenceRefs: EvidenceRef[];
  excludedReason?: string;
  traceId: string;
};

export function buildMarketOpportunityCandidate(input: { title: string; summary: string; evidence: EvidenceInput[] }): OpportunityCandidate {
  const evidencePack = sanitizeEvidencePack(input.evidence);
  const text = `${input.title} ${input.summary} ${input.evidence.map((item) => item.summary).join(" ")}`;
  const excludedReason = MEMECOIN_RE.test(text) ? "memecoin-related opportunities are excluded by Company policy" : undefined;
  return {
    id: `opp-${slugify(input.title)}`,
    type: "opportunity",
    title: redactSecretLikeText(input.title),
    status: excludedReason ? "rejected" : evidencePack.readyForOwner ? "ready_for_review" : "new",
    summary: redactSecretLikeText(input.summary),
    confidence: evidencePack.readyForOwner ? "medium" : "low",
    riskLevel: "medium",
    visibility: "internal",
    evidenceRefs: evidencePack.refs,
    excludedReason,
    traceId: `trace-opp-${slugify(input.title)}`
  };
}

export type ImprovementCandidate = {
  id: string;
  type: "improvement";
  title: string;
  area: "reliability" | "latency" | "cost" | "operator_ux" | "automation" | "security" | "data_quality" | "docs" | "developer_experience";
  problem: string;
  status: "new" | "ready_for_review";
  autonomyFit: "auto_execute" | "auto_prepare_only" | "owner_required" | "blocked";
  riskLevel: RiskLevel;
  visibility: Visibility;
  evidenceRefs: EvidenceRef[];
  traceId: string;
};

export function buildImprovementCandidate(input: { title: string; area: ImprovementCandidate["area"]; problem: string; evidence: EvidenceInput[] }): ImprovementCandidate {
  const evidencePack = sanitizeEvidencePack(input.evidence);
  const riskLevel: RiskLevel = input.area === "security" ? "high" : "medium";
  const policy = evaluateAutonomyPolicy({ actionType: `improvement_${input.area}`, riskLevel, visibility: "internal", scopeApproved: true });
  return {
    id: `imp-${slugify(input.title)}`,
    type: "improvement",
    title: redactSecretLikeText(input.title),
    area: input.area,
    problem: redactSecretLikeText(input.problem),
    status: evidencePack.readyForOwner ? "ready_for_review" : "new",
    autonomyFit: policy.decision === "allow" || policy.decision === "allow_with_verification" ? "auto_execute" : policy.decision === "require_owner_approval" ? "owner_required" : "blocked",
    riskLevel,
    visibility: "internal",
    evidenceRefs: evidencePack.refs,
    traceId: `trace-imp-${slugify(input.title)}`
  };
}

export type ProjectDraft = {
  id: string;
  title: string;
  status: "needs_enrichment" | "needs_owner_decision";
  sourceCandidateId: string;
  summary: string;
  successCriteria: string[];
  requiredOwnerDecision: { title: string; question: string; reason: string };
  traceId: string;
};

export function buildProjectDraftFromCandidate(candidate: OpportunityCandidate | ImprovementCandidate): ProjectDraft {
  return {
    id: `draft-${candidate.id}`,
    title: candidate.title,
    status: "needs_owner_decision",
    sourceCandidateId: candidate.id,
    summary: "summary" in candidate ? candidate.summary : candidate.problem,
    successCriteria: ["owner approves activation", "trace/event/artifact/verification linkage exists", "high risk gates remain blocked"],
    requiredOwnerDecision: {
      title: `Activate ${candidate.title}`,
      question: "이 candidate를 ProjectDraft에서 실제 Project로 activation할까?",
      reason: "project activation requires owner confirmation before autonomous execution"
    },
    traceId: candidate.traceId
  };
}

export function buildAutonomySchedulerDraft(input: { now: Date }) {
  return {
    generatedAt: input.now.toISOString(),
    concurrency: { globalMaxRuns: 3, perAgentMaxRuns: 1 },
    budget: { dailyCostUsd: 10, maxRunMinutes: 30 },
    guardrails: {
      highCritical: "owner approval required",
      blockedScopes: ["Auth/Crypto/Alpha/X-CDP scope expansion", "production deploy", "public deploy", "external send", "paid action", "secret access"]
    },
    jobs: [
      { type: "service_improvement_radar", cadence: "daily", primaryAgent: "projects-agent", verifier: "docs-agent.verifier" },
      { type: "market_opportunity_radar", cadence: "daily", primaryAgent: "research-agent", verifier: "docs-agent.verifier" },
      { type: "idea_project_factory", cadence: "event_triggered", primaryAgent: "projects-agent", verifier: "hq-agent" },
      { type: "executive_brief", cadence: "daily", primaryAgent: "content-agent", verifier: "main-agent" }
    ]
  };
}

export type AutonomyRunPlan = {
  id: string;
  runType: string;
  status: "queued" | "running" | "waiting_approval" | "verifying" | "completed" | "blocked";
  decision: AutonomyDecision;
  primaryAgent: string;
  traceId: string;
  eventIds: string[];
  artifactIds: string[];
  verificationIds: string[];
  candidateIds: string[];
  projectDraftIds: string[];
  ownerDecisionRequestIds: string[];
  steps: { name: string; agent: string; status: "pending" | "completed" }[];
  metrics: Record<string, number | string>;
};

export function buildAutonomyRunPlan(input: { runType: string; primaryAgent: string; now: Date; riskLevel?: RiskLevel; visibility?: Visibility; scopeApproved?: boolean; gates?: PolicyGates; candidateIds?: string[]; projectDraftIds?: string[]; ownerDecisionRequestIds?: string[] }): AutonomyRunPlan {
  const slug = slugify(input.runType);
  const stamp = input.now.toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const policy = evaluateAutonomyPolicy({ actionType: input.runType, riskLevel: input.riskLevel ?? "medium", visibility: input.visibility ?? "internal", scopeApproved: input.scopeApproved ?? true, primaryAgent: input.primaryAgent, gates: input.gates });
  const status = policy.decision === "require_owner_approval" ? "waiting_approval" : policy.decision === "block" ? "blocked" : "queued";
  return {
    id: `autonomy-run-${slug}-${stamp}`,
    runType: input.runType,
    status,
    decision: policy.decision,
    primaryAgent: input.primaryAgent,
    traceId: `trace-autonomy-${slug}-${stamp}`,
    eventIds: [`event-autonomy-${slug}-planned-${stamp}`],
    artifactIds: [`artifact-autonomy-${slug}-evidence-${stamp}`],
    verificationIds: [`verification-autonomy-${slug}-policy-${stamp}`],
    candidateIds: input.candidateIds ?? [],
    projectDraftIds: input.projectDraftIds ?? [],
    ownerDecisionRequestIds: input.ownerDecisionRequestIds ?? [],
    steps: [
      { name: "policy_gate", agent: "hq-agent", status: "completed" },
      { name: input.runType, agent: input.primaryAgent, status: "pending" },
      { name: "independent_verification", agent: "docs-agent.verifier", status: "pending" }
    ],
    metrics: { candidatesCreated: (input.candidateIds ?? []).length, projectDraftsCreated: (input.projectDraftIds ?? []).length, ownerDecisionsCreated: (input.ownerDecisionRequestIds ?? []).length }
  };
}

export type AutonomyControlInput = { action: "pause" | "resume" | "lower_autonomy" | "raise_autonomy" | "emergency_stop"; currentLevel: string; requestedLevel?: string };
export function evaluateAutonomyControlAction(input: AutonomyControlInput) {
  if (input.action === "pause") return { decision: "allow" as const, nextState: "paused", nextLevel: input.currentLevel, reasons: ["safe_containment_control"] };
  if (input.action === "emergency_stop") return { decision: "allow" as const, nextState: "emergency_stop", nextLevel: "L0", reasons: ["emergency_stop_containment"] };
  if (input.action === "lower_autonomy") {
    const requested = input.requestedLevel ?? "L0";
    return { decision: "allow" as const, nextState: "normal", nextLevel: requested, reasons: ["lowering_autonomy_is_safe"] };
  }
  return { decision: "require_owner_approval" as const, nextState: "approval_required", nextLevel: input.requestedLevel ?? input.currentLevel, reasons: ["resume_or_raise_requires_owner_approval"] };
}

export function runServiceImprovementRadar(input: { services: { name: string; area: ImprovementCandidate["area"]; symptom: string; confidence: EvidenceConfidence }[]; now?: Date }) {
  const improvements = input.services.map((service) => buildImprovementCandidate({
    title: `${service.name} ${service.area} improvement`,
    area: service.area,
    problem: service.symptom,
    evidence: [
      { title: `${service.name} health signal`, source: "ops-console:service-radar", summary: service.symptom, confidence: service.confidence },
      { title: `${service.name} operator impact`, source: "ops-console:operator-surface", summary: `${service.area} issue affects internal Company operations`, confidence: service.confidence }
    ]
  }));
  const run = buildAutonomyRunPlan({ runType: "service_improvement_radar", primaryAgent: "projects-agent", now: input.now ?? new Date(0), candidateIds: improvements.map((item) => item.id) });
  return { run, improvements };
}

export function runMarketOpportunityRadar(input: { signals: { title: string; summary: string; source: string; confidence: EvidenceConfidence }[]; now?: Date }) {
  const grouped = new Map<string, { title: string; summary: string; evidence: EvidenceInput[] }>();
  for (const signal of input.signals) {
    const key = slugify(signal.title);
    const existing = grouped.get(key) ?? { title: signal.title, summary: signal.summary, evidence: [] };
    existing.evidence.push({ title: signal.title, source: signal.source, summary: signal.summary, confidence: signal.confidence });
    grouped.set(key, existing);
  }
  const opportunities = Array.from(grouped.values()).map((group) => buildMarketOpportunityCandidate(group));
  const run = buildAutonomyRunPlan({ runType: "market_opportunity_radar", primaryAgent: "research-agent", now: input.now ?? new Date(0), candidateIds: opportunities.map((item) => item.id) });
  return { run, opportunities };
}

export function runIdeaProjectFactory(input: { candidates: (OpportunityCandidate | ImprovementCandidate)[]; now?: Date }) {
  const ready = input.candidates.filter((candidate) => candidate.status === "ready_for_review" && !("excludedReason" in candidate && candidate.excludedReason));
  const projectDrafts = ready.map((candidate) => buildProjectDraftFromCandidate(candidate));
  const ownerDecisionRequests = projectDrafts.map((draft) => sanitizeOwnerDecisionInput({
    title: draft.requiredOwnerDecision.title,
    ownerQuestion: draft.requiredOwnerDecision.question,
    contextSummary: `${draft.summary}\nRisk gates remain active. Project activation requires owner confirmation.`,
    requestedByAgent: "main-agent",
    traceId: draft.traceId,
    gates: { public: false, external: false, paid: false, production: false, secrets: false, mainBranch: false, highCritical: false, scopeExpansion: false }
  }));
  const run = buildAutonomyRunPlan({ runType: "idea_project_factory", primaryAgent: "projects-agent", now: input.now ?? new Date(0), projectDraftIds: projectDrafts.map((item) => item.id), ownerDecisionRequestIds: ownerDecisionRequests.map((item, index) => item.traceId || `owner-${index}`) });
  return { run, projectDrafts, ownerDecisionRequests };
}

export function buildOwnerDecisionPacket(input: {
  title: string;
  ownerQuestion: string;
  contextSummary: string;
  options: { id: string; label: string; summary: string; pros: string[]; cons: string[]; riskLevel: RiskLevel }[];
  gates: Required<Pick<PolicyGates, "public" | "external" | "paid" | "production" | "secrets" | "mainBranch" | "highCritical" | "scopeExpansion">>;
}) {
  const body = [
    `## Decision Needed: ${redactSecretLikeText(input.title)}`,
    "",
    "### Owner question",
    redactSecretLikeText(input.ownerQuestion),
    "",
    "### Short context",
    redactSecretLikeText(input.contextSummary),
    "",
    "### Options",
    ...input.options.map((option, index) => `${index + 1}. ${redactSecretLikeText(option.label)} — ${redactSecretLikeText(option.summary)} · risk=${option.riskLevel}`),
    "",
    "### Gates triggered",
    ...Object.entries(input.gates).map(([gate, active]) => `- ${gate}: ${active ? "yes" : "no"}`),
    "",
    "Reply with: Approve / Reject / Defer / Need more info"
  ].join("\n");
  return { title: redactSecretLikeText(input.title), body };
}

export function sanitizeOwnerDecisionInput(input: { title: string; ownerQuestion: string; contextSummary: string; requestedByAgent?: string; gates?: Record<string, unknown>; traceId?: string }) {
  return {
    title: redactSecretLikeText(input.title).slice(0, 200),
    ownerQuestion: redactSecretLikeText(input.ownerQuestion).slice(0, 1000),
    contextSummary: redactSecretLikeText(input.contextSummary).slice(0, 4000),
    requestedByAgent: redactSecretLikeText(input.requestedByAgent ?? "main-agent").slice(0, 80),
    gates: Object.fromEntries(Object.entries(input.gates ?? {}).filter(([, value]) => typeof value === "boolean").map(([key, value]) => [redactSecretLikeText(key).slice(0, 80), value as boolean])),
    traceId: redactSecretLikeText(input.traceId ?? `trace-owner-${Date.now()}`).slice(0, 160)
  };
}

function slugify(value: string) {
  const slug = value.toLowerCase().replace(/[^a-z0-9가-힣]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60);
  return slug || "candidate";
}
