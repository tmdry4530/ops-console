import type { ArtifactType, EventSeverity, RiskLevel } from "@prisma/client";
import { contentHash } from "./ingest/hash";
import { selectCapabilityForTask } from "./agent-capabilities";
import { buildConversationMetadata } from "./project-conversations";

export type DepartmentAdapterTask = {
  id: string;
  title: string;
  summary: string | null;
  riskLevel: RiskLevel;
  projectId?: string | null;
  projectSlug?: string | null;
  agent: {
    id: string;
    slug: string;
    name: string;
  } | null;
};

type AdapterEventPlan = {
  type: string;
  severity: EventSeverity;
  message: string;
  metadata: Record<string, string | number | boolean | null>;
};

type AdapterArtifactPlan = {
  type: ArtifactType;
  title: string;
  path: string;
  content: string;
  contentHash: string;
  restricted: boolean;
  restrictionReason?: string | null;
};

export type DepartmentAdapterRunPlan = {
  kind: "artifact_only_execution" | "requires_approval" | "unsupported_agent";
  capabilityKey?: string;
  artifact?: AdapterArtifactPlan;
  events: AdapterEventPlan[];
};

function timestamp(now: Date): string {
  return now.toISOString();
}

function safeRisk(riskLevel: RiskLevel) {
  return riskLevel === "low" || riskLevel === "medium" || riskLevel === "high";
}

function outputForCapability(capabilityKey: string, task: DepartmentAdapterTask, executedAt: string): string {
  const summary = task.summary ?? "No summary provided.";
  const header = [
    "## Adapter Output",
    "",
    `- Agent: ${task.agent?.slug ?? "unknown"}`,
    `- Capability: ${capabilityKey}`,
    `- Task: ${task.title}`,
    `- Risk: ${task.riskLevel}`,
    `- Generated At: ${executedAt}`,
    "",
    "## Input Summary",
    "",
    summary,
    ""
  ].join("\n");

  if (capabilityKey === "docs.update_proposal") {
    return `${header}\n## Docs Update Checklist\n\n- Check target document against Company Wiki schema.\n- Update docs/INDEX.md if a durable page is added or moved.\n- Append log.md with create/update/archive action.\n- Keep chat response to path/commit/verification summary.\n\n## Proposed Next Action\n\nCreate a repo diff proposal first; do not directly publish high-risk or secret-bearing content.\n`;
  }

  if (capabilityKey === "research.source_brief") {
    return `${header}\n## Citation Requirements\n\n- Capture at least 3 reliable sources when web/source access is available.\n- Record confidence: high | medium | low.\n- Separate raw evidence from synthesis.\n- Flag single-source or stale claims instead of presenting them as fact.\n\n## Proposed Evidence Table\n\n- Source: pending capture\n- Claim: pending verification\n- Confidence: pending\n`;
  }

  if (capabilityKey === "dev.validation_proposal") {
    return `${header}\n## Validation Commands\n\n- pnpm lint\n- pnpm typecheck\n- pnpm test\n- pnpm build\n\n## Failure Handling\n\n- Preserve failing command output in the artifact.\n- Do not hide failed tests.\n- Deployment or destructive commands require Ops Console approval.\n`;
  }

  if (capabilityKey === "content.outreach_approval_pack") {
    return `${header}\n## Outreach Approval Pack Checklist\n\n- Refresh prospect-specific opening line from approved public context.\n- Keep the offer to manual 1:1 review/diagnosis; do not claim guaranteed revenue.\n- Include a clear operator approval gate before any external send.\n- Do not send Kakao/Instagram/LINE/email messages automatically.\n\n## Proposed Next Action\n\nPrepare an approval-ready draft bundle and mark all external sends as manual-only.\n`;
  }

  if (capabilityKey === "projects.pipeline_ops") {
    return `${header}\n## Pipeline Operations Checklist\n\n- Review stage, reply_status, owner, and next_action for each prospect.\n- Separate internal cleanup from external/manual outreach.\n- Flag stale A-group items and identify B-group preparation needs.\n- Keep CSV writes as a proposal unless explicitly approved.\n\n## Proposed Next Action\n\nProduce a pipeline status artifact with blockers, owner, and next manual gate.\n`;
  }

  if (capabilityKey === "design.handoff_review") {
    return `${header}\n## Design Review Checklist\n\n- Check DESIGN.md contract, semantic tokens, layout, components, states, and accessibility requirements.\n- Produce FE handoff notes with screen flow, component specs, responsive states, and open questions.\n- Do not deploy, edit production UI, or send Discord reports directly; return artifacts to Ops Console/company router.\n\n## Proposed Output\n\n- UX findings ranked by severity.\n- FE handoff notes and acceptance criteria.\n- Missing design tokens or accessibility gaps.\n`;
  }

  if (capabilityKey === "hq.policy_risk_audit") {
    return `${header}\n## HQ Policy/Risk Audit Checklist\n\n- Confirm the task is Company-scope and does not expand agent authority.\n- Verify no raw secrets/tokens/cookies/browser storage/private keys are requested or exposed.\n- Verify no external send/publishing, paid action, public/prod deploy, DB migration, credential/env/config change, live trading/order/payment/wallet/KYC/signature is auto-executed.\n- Confirm low/medium internal direct instructions can proceed without an extra approval packet because the owner instruction is the approval.\n- Escalate high/critical or cross-scope work instead of implementing it.\n\n## Audit Output\n\n- Decision: PASS | WARN | BLOCKED.\n- Reasons and evidence refs.\n- Required owner packet only if hard safety gates are touched.\n`;
  }

  return `${header}\n## Triage Checklist\n\n- Extract owner, blocker, and next action.\n- Flag stale running tasks.\n- Create follow-up tasks only when ownership is clear.\n`;
}

export function planDepartmentAdapterRun(task: DepartmentAdapterTask, now = new Date()): DepartmentAdapterRunPlan {
  if (!task.agent) return { kind: "unsupported_agent", events: [] };
  const text = `${task.title}\n${task.summary ?? ""}`;
  const capability = selectCapabilityForTask(task.agent.slug, text);
  if (!capability) return { kind: "unsupported_agent", events: [] };

  const executedAt = timestamp(now);
  const conversationMetadata = buildConversationMetadata({
    projectSlug: task.projectSlug ?? "ops-console",
    agentSlug: task.agent.slug,
    workstream: "general"
  });
  const baseMetadata = {
    taskId: task.id,
    capabilityKey: capability.capabilityKey,
    riskLevel: task.riskLevel,
    executedAt,
    mode: "department_adapter_v1",
    ...conversationMetadata
  };

  if (!safeRisk(task.riskLevel)) {
    return {
      kind: "requires_approval",
      capabilityKey: capability.capabilityKey,
      events: [
        {
          type: "agent.adapter.approval_required",
          severity: "warning",
          message: `Department adapter requires approval: ${task.agent.slug}`,
          metadata: { ...baseMetadata, policyDecision: "require_approval" }
        },
        {
          type: "discord.report.queued",
          severity: "info",
          message: `Discord status report queued: ${task.agent.slug}`,
          metadata: { ...baseMetadata, purpose: "status_report", approvalRequest: false }
        }
      ]
    };
  }

  const artifactContent = outputForCapability(capability.capabilityKey, task, executedAt);
  const artifactPath = `artifacts/agents/${task.agent.slug}/${task.id}-${capability.capabilityKey}.md`;
  const artifact: AdapterArtifactPlan = {
    type: capability.expectedArtifactType,
    title: `${task.agent.name} adapter output · ${capability.capabilityKey}`,
    path: artifactPath,
    content: artifactContent,
    contentHash: contentHash(`${artifactPath}\n${artifactContent}`),
    restricted: false,
    restrictionReason: null
  };

  return {
    kind: "artifact_only_execution",
    capabilityKey: capability.capabilityKey,
    artifact,
    events: [
      {
        type: "agent.adapter.started",
        severity: "info",
        message: `Department adapter started: ${task.agent.slug}`,
        metadata: baseMetadata
      },
      {
        type: "agent.adapter.artifact_created",
        severity: "info",
        message: `Department adapter artifact created: ${task.agent.slug}`,
        metadata: { ...baseMetadata, artifactPath: artifact.path, artifactHash: artifact.contentHash }
      },
      {
        type: "agent.adapter.completed",
        severity: "info",
        message: `Department adapter completed: ${task.agent.slug}`,
        metadata: baseMetadata
      },
      {
        type: "discord.report.queued",
        severity: "info",
        message: `Discord result report queued: ${task.agent.slug}`,
        metadata: { ...baseMetadata, purpose: "result_report", approvalRequest: false, artifactPath: artifact.path }
      }
    ]
  };
}
