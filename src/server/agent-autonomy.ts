import { promises as fs } from "node:fs";
import { db } from "@/lib/db";
import { contentHash } from "./ingest/hash";
import { planDepartmentAdapterRun, type DepartmentAdapterRunPlan } from "./department-adapters";
import { decideAutonomy } from "./autonomy-governor";
import { planAggregationAfterChildTerminals } from "./autonomy-orchestration";
import { selectCapabilityForTask } from "./agent-capabilities";
import { hermesBridgeDecision, hermesReportPathForTask, runHermesCompanyTask } from "./hermes-bridge";
import { planIdleCompanyWork, standingWorkRunSlug } from "./idle-work-planner";
import { reportSummaryFromMarkdown } from "./task-observability";
import type { AgentStatus, ApprovalStatus, ApprovalType, EventSeverity, RiskLevel, TaskStatus } from "@prisma/client";

export const AUTONOMOUS_WORK_AGENT_SLUGS = [
  "main-agent",
  "research-agent",
  "projects-agent",
  "dev-agent",
  "content-agent",
  "docs-agent",
  "design-agent"
] as const;

export type AutonomousTaskRecord = {
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

type AutonomousEventPlan = {
  type: string;
  severity: EventSeverity;
  message: string;
  metadata: Record<string, string | number | boolean | null>;
};

type AutonomousApprovalPlan = {
  type: ApprovalType;
  status: ApprovalStatus;
  riskLevel: RiskLevel;
  title: string;
  summary: string;
  requestedBy: string;
};

export type AutonomousTaskRunPlan = {
  kind: "execute_safe_task" | "request_console_approval" | "skip";
  taskStatus?: TaskStatus;
  agentStatus?: AgentStatus;
  taskNextAction?: string;
  approval?: AutonomousApprovalPlan;
  events: AutonomousEventPlan[];
  adapterArtifact?: DepartmentAdapterRunPlan["artifact"];
};

export type AutonomousTaskRunResult = {
  status: "completed" | "waiting_approval" | "skipped";
  reason?: string;
  taskId?: string;
  agentSlug?: string;
  completedParentTaskIds?: string[];
};

export function shouldCompleteHqParent(childStatuses: TaskStatus[]): boolean {
  return childStatuses.length > 0 && childStatuses.every((status) => status === "completed" || status === "failed");
}

function envFlag(name: string, defaultValue = false): boolean {
  const value = process.env[name];
  if (value == null || value === "") return defaultValue;
  return value === "true" || value === "1" || value.toLowerCase() === "yes";
}

function discordOutboxEventsEnabled(): boolean {
  return envFlag("OPS_DISCORD_OUTBOX_EVENT_CREATION_ENABLED", false);
}

function isSafeAutonomousRisk(riskLevel: RiskLevel): boolean {
  return riskLevel === "low" || riskLevel === "medium";
}

function requiresRevenueOutreachApproval(task: AutonomousTaskRecord): boolean {
  const text = `${task.title}\n${task.summary ?? ""}`.toLowerCase();
  const hasRevenueContext = /revenue|수익|매출|saas|pipeline|파이프라인|후보|prospect|a그룹|b그룹/.test(text);
  const hasExternalSend = /outreach|발송|보낸다|보내기|dm|이메일|email|카카오|kakao|인스타|instagram|\bline\b|외부 메시지|1:1/.test(text);
  const isPreparationOnly = /승인팩|초안|draft|준비|보강|proposal|artifact|하지 않는다|자동 발송 없음|외부 발송은 하지 않는다/.test(text);
  return hasRevenueContext && hasExternalSend && !isPreparationOnly;
}

function timestamp(now: Date): string {
  return now.toISOString();
}

function taskText(task: AutonomousTaskRecord): string {
  return `${task.title}\n${task.summary ?? ""}`;
}

function actionTypeForAutonomousTask(task: AutonomousTaskRecord): string {
  const text = taskText(task).toLowerCase();
  if (task.agent?.slug === "dev-agent" && /code write|repo_write|파일 수정|코드 작성|구현|patch|패치/.test(text)) return "code_write";
  if (/deploy|배포/.test(text)) return "deploy";
  if (/wallet|지갑|kyc/.test(text)) return "wallet_kyc";
  if (/live trading|실거래|order execution|주문/.test(text)) return "live_trading";
  if (/payment|결제|paid action|유료/.test(text)) return "paid_action";
  if (/secret|token|cookie|browser storage|비밀키|토큰|쿠키/.test(text)) return "secret_access";
  if (/public disclosure|공개/.test(text)) return "public_disclosure";
  if (requiresRevenueOutreachApproval(task)) return "revenue_outreach";
  return "operator_instruction";
}

function requestedToolsForAutonomousTask(task: AutonomousTaskRecord, capabilityTools: string[]): string[] {
  const actionType = actionTypeForAutonomousTask(task);
  if (actionType === "code_write") return ["repo_write", "test_runner"];
  if (["deploy", "wallet_kyc", "live_trading", "paid_action", "secret_access", "public_disclosure"].includes(actionType)) return [actionType];
  return capabilityTools.filter((tool) => !/external_send|wallet|secret|order|payment|deploy/.test(tool));
}

export function planAutonomousTaskRun(task: AutonomousTaskRecord, now = new Date()): AutonomousTaskRunPlan {
  if (!task.agent || !AUTONOMOUS_WORK_AGENT_SLUGS.includes(task.agent.slug as (typeof AUTONOMOUS_WORK_AGENT_SLUGS)[number])) {
    return { kind: "skip", events: [] };
  }

  const executedAt = timestamp(now);
  const baseMetadata = {
    taskId: task.id,
    agentSlug: task.agent.slug,
    mode: "autonomous_agent_worker",
    executedAt
  };

  const capabilitySeed = selectCapabilityForTask(task.agent.slug, taskText(task));
  const requestedTools = requestedToolsForAutonomousTask(task, capabilitySeed?.allowedTools ?? []);
  const actionType = actionTypeForAutonomousTask(task);
  const governorDecision = decideAutonomy({
    systemScope: "Company",
    projectSlug: task.projectSlug ?? "ops-console",
    agentSlug: task.agent.slug,
    actionType,
    riskLevel: task.riskLevel,
    requestedTools,
    capability: capabilitySeed
      ? { capabilityKey: capabilitySeed.capabilityKey, allowedTools: capabilitySeed.allowedTools, maxRisk: capabilitySeed.maxRisk, requiresApproval: capabilitySeed.requiresApproval }
      : null,
    policy: { action: "allow", riskLevel: task.riskLevel },
    budget: { requestedUsd: capabilitySeed?.avgCost ?? 0, remainingUsd: Number.POSITIVE_INFINITY },
    approvalStatus: null,
    verifier: { required: true, available: true }
  });

  if (["block", "require_manual_handoff", "require_approval", "pause_scope", "escalate_hq"].includes(governorDecision.decision)) {
    const highSeverity = governorDecision.decision === "block" || task.riskLevel === "critical" || task.riskLevel === "high";
    return {
      kind: "request_console_approval",
      taskStatus: "waiting_approval",
      agentStatus: "waiting_approval",
      taskNextAction: `Autonomy Governor: ${governorDecision.decision} · ${governorDecision.reasons.join(",")}`,
      approval: {
        type: actionType === "revenue_outreach" ? "revenue_outreach" : actionType === "deploy" ? "deploy" : actionType === "wallet_kyc" ? "wallet_kyc" : actionType === "live_trading" ? "live_trading" : actionType === "paid_action" ? "paid_action" : actionType === "public_disclosure" ? "public_disclosure" : "other",
        status: governorDecision.decision === "require_manual_handoff" ? "manual_handoff" : "pending",
        riskLevel: task.riskLevel,
        title: `Autonomy Governor decision · ${task.agent.name}`,
        summary: [`Decision: ${governorDecision.decision}`, `Level: ${governorDecision.autonomyLevel}`, `Reasons: ${governorDecision.reasons.join(", ")}`, "", `Task: ${task.title}`, `Summary: ${task.summary ?? "없음"}`].join("\n"),
        requestedBy: "autonomy-governor"
      },
      events: [
        {
          type: "autonomy.governor.decision",
          severity: highSeverity ? "warning" : "info",
          message: `Autonomy Governor ${governorDecision.decision}: ${task.agent.slug}`,
          metadata: { ...baseMetadata, decision: governorDecision.decision, autonomyLevel: governorDecision.autonomyLevel, reasons: governorDecision.reasons.join(","), actionType, requestedTools: requestedTools.join(","), verifierRequired: governorDecision.verifierRequired }
        },
        {
          type: "discord.report.queued",
          severity: "info",
          message: `Discord status report queued: ${task.agent.slug}`,
          metadata: { ...baseMetadata, purpose: "approval_needed", approvalRequest: false, consoleApprovalId: "pending", decision: governorDecision.decision }
        }
      ]
    };
  }

  if (governorDecision.decision === "allow_plan_only") {
    return {
      kind: "request_console_approval",
      taskStatus: "waiting_approval",
      agentStatus: "waiting_approval",
      taskNextAction: `Autonomy Governor plan-only gate · ${governorDecision.reasons.join(",")}`,
      approval: {
        type: "other",
        status: "pending",
        riskLevel: task.riskLevel,
        title: `Plan-only review 필요 · ${task.agent.name}`,
        summary: `Autonomy Governor가 실행 대신 계획/검토만 허용했습니다.\n\nDecision: ${governorDecision.decision}\nReasons: ${governorDecision.reasons.join(", ")}\nTask: ${task.title}`,
        requestedBy: "autonomy-governor"
      },
      events: [{ type: "autonomy.governor.decision", severity: "info", message: `Autonomy Governor plan-only: ${task.agent.slug}`, metadata: { ...baseMetadata, decision: governorDecision.decision, autonomyLevel: governorDecision.autonomyLevel, reasons: governorDecision.reasons.join(","), actionType } }]
    };
  }

  if (requiresRevenueOutreachApproval(task)) {
    return {
      kind: "request_console_approval",
      taskStatus: "waiting_approval",
      agentStatus: "waiting_approval",
      taskNextAction: "Ops Console 매출 아웃리치 승인 대기 · 외부 발송 자동 실행 금지",
      approval: {
        type: "revenue_outreach",
        status: "pending",
        riskLevel: task.riskLevel,
        title: `매출 아웃리치 승인 필요 · ${task.agent.name}`,
        summary: `자율 에이전트가 외부 수익 아웃리치 발송 작업을 감지해 콘솔 승인을 요청했습니다.\n\n작업: ${task.title}\n요약: ${task.summary ?? "없음"}`,
        requestedBy: "autonomous-agent-worker"
      },
      events: [
        {
          type: "agent.autonomy.approval_requested",
          severity: "warning",
          message: `Revenue outreach approval requested: ${task.agent.slug}`,
          metadata: { ...baseMetadata, riskLevel: task.riskLevel, approvalTarget: "ops_console", approvalType: "revenue_outreach", externalSend: false }
        },
        {
          type: "discord.report.queued",
          severity: "info",
          message: `Discord status report queued: ${task.agent.slug}`,
          metadata: { ...baseMetadata, purpose: "status_report", approvalRequest: false, consoleApprovalId: "pending" }
        }
      ]
    };
  }

  if (!isSafeAutonomousRisk(task.riskLevel)) {
    return {
      kind: "request_console_approval",
      taskStatus: "waiting_approval",
      agentStatus: "waiting_approval",
      taskNextAction: "Ops Console 승인 대기 · Discord는 결과/상태 보고만 수행",
      approval: {
        type: "other",
        status: "pending",
        riskLevel: task.riskLevel,
        title: `자율 작업 승인 필요 · ${task.agent.name}`,
        summary: `자율 에이전트가 고위험 작업을 감지해 콘솔 승인을 요청했습니다.\n\n작업: ${task.title}\n요약: ${task.summary ?? "없음"}`,
        requestedBy: "autonomous-agent-worker"
      },
      events: [
        {
          type: "agent.autonomy.approval_requested",
          severity: "warning",
          message: `Autonomous agent requested Ops Console approval: ${task.agent.slug}`,
          metadata: { ...baseMetadata, riskLevel: task.riskLevel, approvalTarget: "ops_console" }
        },
        {
          type: "discord.report.queued",
          severity: "info",
          message: `Discord status report queued: ${task.agent.slug}`,
          metadata: { ...baseMetadata, purpose: "status_report", approvalRequest: false, consoleApprovalId: "pending" }
        }
      ]
    };
  }

  const adapterPlan = planDepartmentAdapterRun(task, now);
  if (adapterPlan.kind === "unsupported_agent") {
    return { kind: "skip", events: [] };
  }

  if (adapterPlan.kind === "requires_approval") {
    return {
      kind: "request_console_approval",
      taskStatus: "waiting_approval",
      agentStatus: "waiting_approval",
      taskNextAction: "Ops Console 승인 대기 · Discord는 결과/상태 보고만 수행",
      approval: {
        type: "other",
        status: "pending",
        riskLevel: task.riskLevel,
        title: `자율 작업 승인 필요 · ${task.agent.name}`,
        summary: `자율 에이전트 어댑터가 승인이 필요한 작업을 감지했습니다.\n\n작업: ${task.title}\n요약: ${task.summary ?? "없음"}`,
        requestedBy: "autonomous-agent-worker"
      },
      events: adapterPlan.events
    };
  }

  return {
    kind: "execute_safe_task",
    taskStatus: "completed",
    agentStatus: "idle",
    taskNextAction: `자율 작업 완료: ${executedAt}`,
    adapterArtifact: adapterPlan.artifact,
    events: adapterPlan.events
  };
}

export function hqParentAgentCompletionState(): { status: AgentStatus; currentTask: null } {
  return { status: "idle", currentTask: null };
}

export async function completeFinishedHqParents(childTaskId: string, now = new Date()): Promise<string[]> {
  const delegationEvents = await db.event.findMany({
    where: { type: "hq.delegation.created", taskId: childTaskId },
    select: { metadata: true }
  });
  const parentTaskIds: string[] = Array.from(new Set<string>(delegationEvents
    .map((event) => event.metadata as Record<string, unknown>)
    .map((metadata) => metadata.parentTaskId)
    .filter((parentTaskId): parentTaskId is string => typeof parentTaskId === "string")));

  const aggregationParentTaskIds: string[] = [];
  for (const parentTaskId of parentTaskIds) {
    const siblingEvents = await db.event.findMany({
      where: { type: "hq.delegation.created" },
      select: { metadata: true }
    });
    const childTaskIds = siblingEvents
      .map((event) => event.metadata as Record<string, unknown>)
      .filter((metadata) => metadata.parentTaskId === parentTaskId && typeof metadata.childTaskId === "string")
      .map((metadata) => metadata.childTaskId as string);
    const childTasks = await db.task.findMany({ where: { id: { in: childTaskIds } }, select: { status: true } });
    if (!shouldCompleteHqParent(childTasks.map((task) => task.status))) continue;

    const existingAggregation = await db.event.findFirst({
      where: { type: "hq.aggregation.created", metadata: { path: ["parentTaskId"], equals: parentTaskId } },
      select: { id: true }
    });
    if (existingAggregation) continue;

    const parentTask = await db.task.findUnique({ where: { id: parentTaskId }, select: { agentId: true, projectId: true, slug: true, title: true } });
    const aggregationPlan = planAggregationAfterChildTerminals({
      parentTaskId,
      childStatuses: childTasks.map((task) => task.status),
      now
    });
    if (!parentTask || !aggregationPlan?.aggregationTask || !aggregationPlan.mainAgent || !aggregationPlan.parentTask || !aggregationPlan.eventMetadata) continue;

    await db.task.update({ where: { id: parentTaskId }, data: aggregationPlan.parentTask });
    const aggregationTaskPlan = aggregationPlan.aggregationTask;
    const aggregationTask = await db.task.create({
      data: {
        slug: `${parentTask.slug}-${aggregationTaskPlan.slugSuffix}`.slice(0, 120),
        title: aggregationTaskPlan.title,
        status: aggregationTaskPlan.status,
        riskLevel: aggregationTaskPlan.riskLevel,
        summary: aggregationTaskPlan.summary,
        nextAction: aggregationTaskPlan.nextAction,
        agentId: parentTask.agentId,
        projectId: parentTask.projectId
      },
      select: { id: true, slug: true }
    });
    if (parentTask.agentId) {
      await db.agent.update({ where: { id: parentTask.agentId }, data: aggregationPlan.mainAgent });
    }
    await db.event.create({
      data: {
        type: "hq.aggregation.created",
        severity: "info",
        message: "HQ aggregation task created after child terminal states",
        taskId: aggregationTask.id,
        projectId: parentTask.projectId ?? undefined,
        metadata: { ...aggregationPlan.eventMetadata, parentTaskId, aggregationTaskId: aggregationTask.id, aggregationTaskSlug: aggregationTask.slug }
      }
    });
    aggregationParentTaskIds.push(parentTaskId);
  }

  return aggregationParentTaskIds;
}

export async function processAutonomousTask(task: AutonomousTaskRecord, now = new Date()): Promise<AutonomousTaskRunResult> {
  const plan = planAutonomousTaskRun(task, now);
  if (plan.kind === "skip" || !task.agent) {
    return { status: "skipped", reason: "not_autonomous_work_agent", taskId: task.id, agentSlug: task.agent?.slug };
  }

  if (plan.kind === "request_console_approval" && plan.approval) {
    const existingApproval = await db.approval.findFirst({
      where: { taskId: task.id, status: { in: ["pending", "approved_waiting_execution", "executing"] } },
      select: { id: true }
    });
    const approval = existingApproval ?? await db.approval.create({
      data: {
        ...plan.approval,
        taskId: task.id,
        projectId: task.projectId ?? undefined
      },
      select: { id: true }
    });

    await db.$transaction([
      db.task.update({ where: { id: task.id }, data: { status: plan.taskStatus, nextAction: plan.taskNextAction } }),
      db.agent.update({ where: { id: task.agent.id }, data: { status: plan.agentStatus, currentTask: task.title } }),
      ...plan.events.map((event) => db.event.create({
        data: {
          ...event,
          metadata: { ...event.metadata, consoleApprovalId: approval.id },
          agentId: task.agent!.id,
          projectId: task.projectId ?? undefined,
          taskId: task.id,
          approvalId: approval.id
        }
      }))
    ]);
    return { status: "waiting_approval", taskId: task.id, agentSlug: task.agent.slug };
  }

  const hermesDecision = hermesBridgeDecision(task);
  if (plan.kind === "execute_safe_task" && hermesDecision.enabled) {
    const plannedReportPath = hermesReportPathForTask(task);
    const startedAt = now.toISOString();
    await db.$transaction([
      db.task.update({ where: { id: task.id }, data: { status: "running", blocker: null, nextAction: `Hermes Company execution running since ${startedAt}` } }),
      db.agent.update({ where: { id: task.agent!.id }, data: { status: "running", currentTask: task.title, heartbeatAt: now } }),
      db.event.create({
        data: {
          type: "agent.hermes.started",
          severity: "info",
          message: `Hermes Company task started: ${task.agent!.slug}`,
          agentId: task.agent!.id,
          projectId: task.projectId ?? undefined,
          taskId: task.id,
          metadata: { mode: "hermes_company_bridge", reportPath: plannedReportPath, startedAt }
        }
      })
    ]);
    const hermesResult = await runHermesCompanyTask(task);
    const reportMarkdown = await fs.readFile(hermesResult.reportPath, "utf8").catch(() => "");
    const operatorSummary = reportMarkdown ? reportSummaryFromMarkdown(reportMarkdown, 1400) : reportSummaryFromMarkdown(hermesResult.stdout, 1400);
    const artifactContent = [
      "## Hermes Company Execution Result",
      "",
      `- Agent: ${task.agent.slug}`,
      `- Task: ${task.title}`,
      `- Status: ${hermesResult.status}`,
      `- Executed At: ${hermesResult.executedAt}`,
      `- Report Path: ${hermesResult.reportPath}`,
      "",
      "## Stdout",
      "",
      "```text",
      hermesResult.stdout.slice(0, 12000),
      "```",
      "",
      hermesResult.stderr ? "## Stderr\n\n```text\n" + hermesResult.stderr.slice(0, 4000) + "\n```" : ""
    ].join("\n");
    const artifactHash = contentHash(`${hermesResult.reportPath}\n${artifactContent}`);

    await db.$transaction(async (tx) => {
      const artifact = await tx.artifact.upsert({
        where: { contentHash: artifactHash },
        update: { title: `${task.agent!.name} Hermes execution output`, path: hermesResult.reportPath, type: "report", agentId: task.agent!.id, projectId: task.projectId ?? undefined, taskId: task.id },
        create: { type: "report", title: `${task.agent!.name} Hermes execution output`, path: hermesResult.reportPath, contentHash: artifactHash, restricted: false, agentId: task.agent!.id, projectId: task.projectId ?? undefined, taskId: task.id }
      });
      await tx.task.update({ where: { id: task.id }, data: { status: hermesResult.status === "completed" ? "completed" : "failed", summary: operatorSummary || task.summary, blocker: hermesResult.status === "failed" ? "Hermes Company execution failed" : null, nextAction: hermesResult.status === "completed" ? `Hermes Company execution completed at ${hermesResult.executedAt}` : "Hermes execution log review needed" } });
      await tx.agent.update({ where: { id: task.agent!.id }, data: { status: hermesResult.status === "completed" ? "idle" : "failed", currentTask: null, heartbeatAt: now } });
      await tx.event.create({
        data: {
          type: hermesResult.status === "completed" ? "agent.hermes.completed" : "agent.hermes.failed",
          severity: hermesResult.status === "completed" ? "info" : "warning",
          message: `Hermes Company task ${hermesResult.status}: ${task.agent!.slug}`,
          agentId: task.agent!.id,
          projectId: task.projectId ?? undefined,
          taskId: task.id,
          artifactId: artifact.id,
          metadata: { mode: "hermes_company_bridge", reportPath: hermesResult.reportPath, artifactId: artifact.id, executedAt: hermesResult.executedAt, stdout: hermesResult.stdout.slice(0, 12000), stderr: hermesResult.stderr.slice(0, 4000), operatorSummary, git: hermesResult.git, kanban: hermesResult.kanban }
        }
      });
      if (discordOutboxEventsEnabled()) {
        await tx.event.create({
          data: {
            type: "discord.report.queued",
            severity: "info",
            message: `Discord result report queued: ${task.agent!.slug}`,
            agentId: task.agent!.id,
            projectId: task.projectId ?? undefined,
            taskId: task.id,
            artifactId: artifact.id,
            metadata: { channel: task.agent!.slug.replace("-agent", ""), message: [`상태: ${hermesResult.status === "completed" ? "완료" : "실패"}`, `작업: ${task.title}`, `에이전트: ${task.agent!.slug}`, `핵심: ${(operatorSummary || "상세 요약 없음").replace(/\n+/g, " / ").slice(0, 500)}`, `산출물: ${hermesResult.reportPath}`, hermesResult.git?.commit ? `GitHub 반영: ${hermesResult.git.commit}` : `GitHub 반영: ${hermesResult.git?.status ?? "unknown"}`, `다음액션: Ops Console에서 결과 확인`].join("\n"), purpose: "result_report", mode: "hermes_company_bridge" }
          }
        });
      }
    });

    const completedParentTaskIds = await completeFinishedHqParents(task.id, now);
    return { status: hermesResult.status === "completed" ? "completed" : "skipped", reason: hermesResult.status === "failed" ? "hermes_execution_failed" : undefined, taskId: task.id, agentSlug: task.agent.slug, completedParentTaskIds };
  }

  if (plan.events.length === 0) {
    return { status: "skipped", reason: "no_autonomous_events", taskId: task.id, agentSlug: task.agent.slug };
  }

  await db.$transaction(async (tx) => {
    await tx.agent.update({ where: { id: task.agent!.id }, data: { status: "running", currentTask: task.title } });
    await tx.event.create({
      data: { ...plan.events[0], agentId: task.agent!.id, projectId: task.projectId ?? undefined, taskId: task.id }
    });

    const artifact = plan.adapterArtifact
      ? await tx.artifact.upsert({
          where: { contentHash: plan.adapterArtifact.contentHash },
          update: {
            title: plan.adapterArtifact.title,
            path: plan.adapterArtifact.path,
            type: plan.adapterArtifact.type,
            restricted: plan.adapterArtifact.restricted,
            restrictionReason: plan.adapterArtifact.restrictionReason ?? null,
            agentId: task.agent!.id,
            projectId: task.projectId ?? undefined,
            taskId: task.id
          },
          create: {
            type: plan.adapterArtifact.type,
            title: plan.adapterArtifact.title,
            path: plan.adapterArtifact.path,
            contentHash: plan.adapterArtifact.contentHash,
            restricted: plan.adapterArtifact.restricted,
            restrictionReason: plan.adapterArtifact.restrictionReason ?? null,
            agentId: task.agent!.id,
            projectId: task.projectId ?? undefined,
            taskId: task.id
          },
          select: { id: true }
        })
      : null;

    await tx.task.update({ where: { id: task.id }, data: { status: plan.taskStatus, blocker: null, nextAction: plan.taskNextAction } });
    await tx.agent.update({ where: { id: task.agent!.id }, data: { status: plan.agentStatus, currentTask: null } });
    for (const event of plan.events.slice(1).filter((event) => discordOutboxEventsEnabled() || event.type !== "discord.report.queued")) {
      await tx.event.create({
        data: {
          ...event,
          metadata: artifact ? { ...event.metadata, artifactId: artifact.id } : event.metadata,
          agentId: task.agent!.id,
          projectId: task.projectId ?? undefined,
          taskId: task.id,
          artifactId: artifact?.id
        }
      });
    }
  });

  const completedParentTaskIds = await completeFinishedHqParents(task.id, now);

  return { status: "completed", taskId: task.id, agentSlug: task.agent.slug, completedParentTaskIds };
}

export async function ensureIdleCompanyWork(now = new Date()): Promise<{ status: "created" | "skipped"; reason?: string; runSlug?: string; childTaskCount?: number }> {
  if (!envFlag("OPS_COMPANY_AUTO_WORK_ENABLED", false)) return { status: "skipped", reason: "auto_work_disabled" };
  const autonomousAgentSlugs = [...AUTONOMOUS_WORK_AGENT_SLUGS];
  const activeAutonomousTasks = await db.task.count({
    where: {
      status: { in: ["queued", "running", "waiting_approval", "needs_changes"] },
      agent: { slug: { in: autonomousAgentSlugs } }
    }
  });
  const runSlug = standingWorkRunSlug(now);
  const existingRuns = await db.task.findMany({ where: { slug: runSlug }, select: { slug: true } });
  const plan = planIdleCompanyWork({ activeAutonomousTasks, existingRunSlugs: existingRuns.map((task) => task.slug) }, now);

  if (!plan) {
    return { status: "skipped", reason: activeAutonomousTasks > 0 ? "active_autonomous_work_exists" : "standing_work_already_created", runSlug };
  }

  const agents = await db.agent.findMany({
    where: { slug: { in: ["hq-agent", ...autonomousAgentSlugs] } },
    select: { id: true, slug: true }
  });
  const agentIdBySlug = new Map(agents.map((agent) => [agent.slug, agent.id]));
  const hqAgentId = agentIdBySlug.get("hq-agent");
  if (!hqAgentId) return { status: "skipped", reason: "hq_agent_missing", runSlug: plan.runSlug };

  await db.$transaction(async (tx) => {
    const parentTask = await tx.task.create({
      data: {
        slug: plan.parentTask.slug,
        title: plan.parentTask.title,
        status: plan.parentTask.status,
        riskLevel: plan.parentTask.riskLevel,
        summary: plan.parentTask.summary,
        nextAction: plan.parentTask.nextAction,
        agentId: hqAgentId
      }
    });
    await tx.agent.update({ where: { id: hqAgentId }, data: { status: "running", currentTask: plan.parentTask.title, heartbeatAt: now } });
    await tx.event.create({
      data: {
        type: "company.idle_work.created",
        severity: "info",
        message: `Company standing work created: ${plan.runSlug}`,
        agentId: hqAgentId,
        taskId: parentTask.id,
        metadata: { runSlug: plan.runSlug, childTaskCount: plan.childTasks.length, mode: "idle_work_scheduler" }
      }
    });

    for (const child of plan.childTasks) {
      const agentId = agentIdBySlug.get(child.agentSlug);
      if (!agentId) continue;
      const childTask = await tx.task.create({
        data: {
          slug: child.slug,
          title: child.title,
          status: child.status,
          riskLevel: child.riskLevel,
          summary: child.summary,
          nextAction: child.nextAction,
          agentId
        }
      });
      await tx.agent.update({ where: { id: agentId }, data: { status: "running", currentTask: child.title, heartbeatAt: now } });
      await tx.event.create({
        data: {
          type: "hq.delegation.created",
          severity: "info",
          message: `Standing work delegated: ${child.agentSlug}`,
          agentId,
          taskId: childTask.id,
          metadata: { orchestrationRunId: plan.runSlug, parentTaskId: parentTask.id, childTaskId: childTask.id, department: child.agentSlug.replace("-agent", ""), mode: "idle_work_scheduler" }
        }
      });
      await tx.event.create({
        data: {
          type: "hq.delegation.started",
          severity: "info",
          message: `Standing work started: ${child.title}`,
          agentId,
          taskId: childTask.id,
          metadata: { parentTaskId: parentTask.id, runSlug: plan.runSlug, mode: "idle_work_scheduler" }
        }
      });
    }
  });

  return { status: "created", runSlug: plan.runSlug, childTaskCount: plan.childTasks.length };
}

export async function processNextAutonomousTask(now = new Date()): Promise<AutonomousTaskRunResult> {
  await ensureIdleCompanyWork(now);
  const task = await db.task.findFirst({
    where: {
      status: { in: ["queued", "running"] },
      agent: { slug: { in: [...AUTONOMOUS_WORK_AGENT_SLUGS] } }
    },
    orderBy: [{ status: "asc" }, { updatedAt: "asc" }],
    select: {
      id: true,
      title: true,
      summary: true,
      riskLevel: true,
      projectId: true,
      project: { select: { slug: true } },
      agent: { select: { id: true, slug: true, name: true } }
    }
  });

  if (!task) {
    return { status: "skipped", reason: "no_queued_or_running_autonomous_tasks" };
  }

  return processAutonomousTask({ ...task, projectSlug: task.project?.slug ?? null }, now);
}
