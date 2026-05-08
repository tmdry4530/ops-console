import type { ArtifactType, RiskLevel } from "@prisma/client";

export type AgentCapabilitySeed = {
  agentSlug: string;
  capabilityKey: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  allowedTools: string[];
  maxRisk: RiskLevel;
  expectedArtifactType: ArtifactType;
  successCriteria: string[];
  failureModes: string[];
  rollbackOrManualHandoff: string;
  requiresApproval: boolean;
  avgCost: number;
  avgDuration: number;
  keywords: string[];
};

const baseInputSchema = {
  type: "object",
  required: ["taskId", "title", "summary", "riskLevel"],
  properties: {
    taskId: { type: "string" },
    title: { type: "string" },
    summary: { type: ["string", "null"] },
    riskLevel: { enum: ["low", "medium", "high", "critical"] }
  }
};

const artifactOutputSchema = {
  type: "object",
  required: ["artifact", "events"],
  properties: {
    artifact: { type: "object" },
    events: { type: "array" }
  }
};

export const AGENT_CAPABILITY_SEEDS: AgentCapabilitySeed[] = [
  {
    agentSlug: "docs-agent",
    capabilityKey: "docs.update_proposal",
    inputSchema: baseInputSchema,
    outputSchema: artifactOutputSchema,
    allowedTools: ["repo_read", "artifact_write", "diff_proposal"],
    maxRisk: "medium",
    expectedArtifactType: "report",
    successCriteria: ["artifact_created", "index_log_checklist_included", "no_secret_output"],
    failureModes: ["missing_context", "schema_violation", "secret_like_content"],
    rollbackOrManualHandoff: "Do not write repo files directly; create an artifact proposal for operator or docs-agent follow-up.",
    requiresApproval: false,
    avgCost: 0,
    avgDuration: 30,
    keywords: ["docs", "문서", "index", "log", "가이드", "보고", "아카이브", "System-Feedback"]
  },
  {
    agentSlug: "research-agent",
    capabilityKey: "research.source_brief",
    inputSchema: baseInputSchema,
    outputSchema: artifactOutputSchema,
    allowedTools: ["repo_read", "web_read", "artifact_write", "citation_extract"],
    maxRisk: "medium",
    expectedArtifactType: "report",
    successCriteria: ["artifact_created", "citation_requirements_included", "confidence_recorded"],
    failureModes: ["missing_sources", "low_confidence", "secret_like_content"],
    rollbackOrManualHandoff: "If fewer than three reliable sources are available, mark low confidence and request follow-up instead of inventing claims.",
    requiresApproval: false,
    avgCost: 0,
    avgDuration: 60,
    keywords: ["research", "조사", "시장", "근거", "citation", "출처", "경쟁사", "분석"]
  },
  {
    agentSlug: "dev-agent",
    capabilityKey: "dev.validation_proposal",
    inputSchema: baseInputSchema,
    outputSchema: artifactOutputSchema,
    allowedTools: ["repo_read", "safe_command_proposal", "artifact_write"],
    maxRisk: "medium",
    expectedArtifactType: "report",
    successCriteria: ["artifact_created", "validation_commands_listed", "failure_logs_not_hidden"],
    failureModes: ["missing_repo_context", "test_failure", "unsafe_command_requested"],
    rollbackOrManualHandoff: "For deploys or destructive commands, stop at a proposal and request Ops Console approval.",
    requiresApproval: false,
    avgCost: 0,
    avgDuration: 45,
    keywords: ["dev", "개발", "코드", "lint", "typecheck", "test", "테스트", "검증", "patch"]
  },
  {
    agentSlug: "content-agent",
    capabilityKey: "content.outreach_approval_pack",
    inputSchema: baseInputSchema,
    outputSchema: artifactOutputSchema,
    allowedTools: ["repo_read", "artifact_write", "approval_pack_draft"],
    maxRisk: "medium",
    expectedArtifactType: "report",
    successCriteria: ["artifact_created", "manual_send_gate_included", "no_external_send"],
    failureModes: ["missing_prospect_context", "unsafe_outreach_claim", "secret_like_content"],
    rollbackOrManualHandoff: "Draft outreach approval packs only; never send external messages without operator approval and manual channel handling.",
    requiresApproval: false,
    avgCost: 0,
    avgDuration: 45,
    keywords: ["content", "outreach", "발송", "문구", "승인팩", "DM", "이메일", "메시지", "카카오", "인스타"]
  },
  {
    agentSlug: "projects-agent",
    capabilityKey: "projects.pipeline_ops",
    inputSchema: baseInputSchema,
    outputSchema: artifactOutputSchema,
    allowedTools: ["repo_read", "artifact_write", "pipeline_triage"],
    maxRisk: "medium",
    expectedArtifactType: "report",
    successCriteria: ["artifact_created", "pipeline_next_actions_listed", "manual_blockers_called_out"],
    failureModes: ["missing_pipeline_context", "ambiguous_stage", "external_action_requested"],
    rollbackOrManualHandoff: "Summarize pipeline status and blockers only; external outreach or CRM updates require operator review.",
    requiresApproval: false,
    avgCost: 0,
    avgDuration: 45,
    keywords: ["projects", "pipeline", "파이프라인", "운영표", "next_action", "reply_status", "파일럿", "prospect", "후보"]
  },
  {
    agentSlug: "trading-agent",
    capabilityKey: "trading.bounty_scope_triage",
    inputSchema: baseInputSchema,
    outputSchema: artifactOutputSchema,
    allowedTools: ["repo_read", "scope_review", "artifact_write"],
    maxRisk: "medium",
    expectedArtifactType: "report",
    successCriteria: ["artifact_created", "scope_limits_called_out", "no_submission_or_trade"],
    failureModes: ["missing_scope", "unsafe_submission_requested", "secret_like_content"],
    rollbackOrManualHandoff: "Analyze public/scoped bounty context only; submissions, trades, wallet actions, or disclosures require manual approval.",
    requiresApproval: false,
    avgCost: 0,
    avgDuration: 45,
    keywords: ["trading", "web3", "bounty", "바운티", "scope", "스코프", "security", "poc", "취약점", "audit", "거래", "제출"]
  },
  {
    agentSlug: "main-agent",
    capabilityKey: "main.task_triage",
    inputSchema: baseInputSchema,
    outputSchema: artifactOutputSchema,
    allowedTools: ["ops_console_read", "artifact_write"],
    maxRisk: "medium",
    expectedArtifactType: "report",
    successCriteria: ["artifact_created", "next_actions_extracted", "stale_tasks_flagged"],
    failureModes: ["missing_task_context", "ambiguous_owner"],
    rollbackOrManualHandoff: "If ownership is ambiguous, create a handoff artifact instead of reassigning work automatically.",
    requiresApproval: false,
    avgCost: 0,
    avgDuration: 30,
    keywords: ["운영", "라우팅", "handoff", "핸드오프", "stale", "정리", "동기화"]
  }
];

export function capabilitySeedsForAgent(agentSlug: string): AgentCapabilitySeed[] {
  return AGENT_CAPABILITY_SEEDS.filter((capability) => capability.agentSlug === agentSlug);
}

export function selectCapabilityForTask(agentSlug: string, text: string): AgentCapabilitySeed | null {
  const capabilities = capabilitySeedsForAgent(agentSlug);
  if (capabilities.length === 0) return null;
  const lowered = text.toLowerCase();
  return capabilities.find((capability) => capability.keywords.some((keyword) => lowered.includes(keyword.toLowerCase()))) ?? capabilities[0];
}
