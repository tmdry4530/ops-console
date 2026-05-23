export type RiskLevel = "low" | "medium" | "high" | "critical";
export type Visibility = "private" | "internal" | "external" | "public";
export type AutonomyDecision = "allow" | "allow_with_verification" | "require_owner_approval" | "require_manual_handoff" | "block" | "pause" | "lower_autonomy";
export type EvidenceConfidence = "low" | "medium" | "high";

export type PolicyGates = Partial<Record<"public" | "external" | "paid" | "production" | "secrets" | "mainBranch" | "highCritical" | "scopeExpansion" | "authCryptoAlphaXcdp" | "liveTrading", boolean>>;

export type AutonomyPolicyInput = {
  actionType: string;
  riskLevel: RiskLevel;
  visibility: Visibility;
  scopeApproved: boolean;
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
const CRITICAL_ACTION_RE = /(read[\s_-]*secret|secret|token|cookie|browser[\s_-]*storage|private[\s_-]*key|database[\s_-]*url|db[\s_-]*url|wallet|live[\s_-]*trading|order[\s_-]*execution|approval[\s_-]*bypass|self[\s_-]*authority|credential)/i;
const OWNER_GATE_RE = /(deploy|publish|external[\s_-]*send|public[\s_-]*release|paid|production|main[\s_-]*branch|scope[\s_-]*(expand|expansion)|project[\s_-]*activation|mvp|runtime[\s_-]*(config|env|credential)|env[\s_-]*(update|change)|config[\s_-]*(update|change)|credential[\s_-]*(update|change)|raise[\s_-]*autonomy|authority[\s_-]*expansion)/i;
const SECRET_LIKE_RE = /(bearer\s+[a-z0-9._~+/=-]{12,}|token\s*[=:]\s*[^\s`]{12,}|cookie\s*[=:]\s*[^\s`]{12,}|password\s*[=:]\s*[^\s`]{8,}|private\s*key|browser\s*storage|database_url|db\s*url|sk-[a-z0-9_-]{12,})/gi;
const MEMECOIN_RE = /memecoin|meme coin|doge|shib|pepe/i;

function riskAtLeast(risk: RiskLevel, threshold: RiskLevel) {
  return RISK_WEIGHT[risk] >= RISK_WEIGHT[threshold];
}

function gateReasons(gates: PolicyGates = {}) {
  return Object.entries(gates).filter(([, active]) => active).map(([gate]) => `${gate}_gate`);
}

export function redactSecretLikeText(text: string) {
  return text.replace(SECRET_LIKE_RE, "[REDACTED_SECRET_LIKE]");
}

export function evaluateAutonomyPolicy(input: AutonomyPolicyInput): AutonomyPolicyResult {
  const reasons = gateReasons(input.gates);
  const gates = input.gates ?? {};
  const criticalGate = gates.secrets || gates.liveTrading || CRITICAL_ACTION_RE.test(input.actionType);
  const ownerGate = gates.public || gates.external || gates.paid || gates.production || gates.mainBranch || gates.scopeExpansion || gates.authCryptoAlphaXcdp || OWNER_GATE_RE.test(input.actionType) || input.visibility === "public" || input.visibility === "external" || !input.scopeApproved;

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
