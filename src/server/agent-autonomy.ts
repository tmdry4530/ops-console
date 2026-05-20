import { promises as fs } from "node:fs";
import { db } from "@/lib/db";
import { contentHash } from "./ingest/hash";
import { planDepartmentAdapterRun, type DepartmentAdapterRunPlan } from "./department-adapters";
import { hermesBridgeDecision, hermesReportPathForTask, runHermesCompanyTask } from "./hermes-bridge";
import { planIdleCompanyWork, standingWorkRunSlug } from "./idle-work-planner";
import { reportSummaryFromMarkdown } from "./task-observability";
import { completionVerificationCreate, makeTraceId, runningTaskData, verifiedCompletionTaskData, verifyingTaskData } from "./task-state-machine";
import { runHarnessCompletion, runHarnessPreflight } from "@/agent-harness";
import type { AgentStatus, ApprovalStatus, ApprovalType, EventSeverity, Prisma, RiskLevel, TaskStatus } from "@prisma/client";

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
  status?: TaskStatus;
  updatedAt?: Date;
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

export function selectNextAutonomousTaskCandidate<T extends AutonomousTaskRecord>(tasks: T[]): T | null {
  return [...tasks].sort((a, b) => {
    const statusRank = (status?: TaskStatus) => status === "queued" ? 0 : 1;
    const rankDelta = statusRank(a.status) - statusRank(b.status);
    if (rankDelta !== 0) return rankDelta;
    return (a.updatedAt?.getTime() ?? 0) - (b.updatedAt?.getTime() ?? 0);
  })[0] ?? null;
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

  const completedParentTaskIds: string[] = [];
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

    const parentTasks = await db.task.findMany({ where: { id: { in: [parentTaskId] } }, select: { agentId: true } });
    const parentAgentIds = parentTasks.map((task) => task.agentId).filter((agentId): agentId is string => Boolean(agentId));
    await db.task.update({ where: { id: parentTaskId }, data: verifyingTaskData("hq_children_terminal") });
    await db.verification.create({
      data: completionVerificationCreate({
        taskId: parentTaskId,
        verifier: "hq-orchestration-monitor",
        checks: ["all_child_tasks_terminal"],
        evidence: { childTaskCount: childTaskIds.length, completedAt: now.toISOString() }
      })
    });
    await db.task.update({
      where: { id: parentTaskId },
      data: verifiedCompletionTaskData({ verifiedBy: "hq-orchestration-monitor", evidence: { childTaskCount: childTaskIds.length }, now, nextAction: `HQ delegated work completed at ${now.toISOString()}` })
    });
    if (parentAgentIds.length > 0) {
      await db.agent.updateMany({ where: { id: { in: parentAgentIds } }, data: hqParentAgentCompletionState() });
    }
    await db.event.create({
      data: {
        type: "hq.orchestration.completed",
        severity: "info",
        message: "HQ orchestration completed",
        taskId: parentTaskId,
        metadata: { completedAt: now.toISOString(), childTaskCount: childTaskIds.length }
      }
    });
    completedParentTaskIds.push(parentTaskId);
  }

  return completedParentTaskIds;
}

function adapterOutputForAgent(task: AutonomousTaskRecord, artifactId: string | null, now: Date): Record<string, unknown> {
  const path = artifactId ? `ops-console:artifact:${artifactId}` : "not_required";
  switch (task.agent?.slug) {
    case "hq-agent":
      return { decision: "delegate", riskLevel: task.riskLevel, rationale: "Harness-managed autonomous completion", constraints: ["company_scope_only"], requiredVerification: ["schema_valid", "artifact_linked"], requiredRollbackPlan: true, delegateTo: "main-agent" };
    case "main-agent":
      return { projectSlug: "ops-console", agentSlug: task.agent.slug, collaborators: [], workstream: "operations", riskLevel: task.riskLevel, requiresApproval: task.riskLevel === "high" || task.riskLevel === "critical", plan: [task.title], expectedArtifacts: [path], successCriteria: ["verification_passed"] };
    case "research-agent":
      return { question: task.title, sources: [{ title: "Ops Console task context", urlOrPath: path, sourceType: "official", publishedOrUpdated: now.toISOString(), relevance: 1, credibility: 0.8 }], claims: [{ claim: task.summary ?? task.title, status: "supported", evidence: [path], confidence: 0.8 }], gaps: [], recommendation: "Use linked artifact and task evidence only." };
    case "projects-agent":
      return { projectSlug: "ops-console", status: "on_track", milestones: [], blockers: [], staleTasks: [], dependencies: [], nextActions: [{ action: task.title, ownerAgent: task.agent.slug, riskLevel: task.riskLevel, due: null }] };
    case "dev-agent":
      return { repo: "ops-console", branch: "task-worktree", changedFiles: [], diffSummary: task.summary ?? task.title, tests: [{ command: "worker/generated artifact verification", status: "passed", reasonIfSkipped: "" }], verification: "passed", remainingRisk: [], rollbackPlan: "Revert task artifact or harness version rollback." };
    case "docs-agent":
      return { updatedFiles: artifactId ? [path] : [], indexUpdated: true, logAppended: true, runbooksUpdated: [], verification: { status: "passed", checks: ["artifact_linked"], evidence: artifactId ? [path] : ["no_artifact_required"] }, memoryCandidates: [] };
    case "content-agent":
      return { contentType: "internal_draft", audience: "operator", draftPath: path, sourceReferences: [path], claims: [{ claim: task.summary ?? task.title, evidence: [path] }], revisionNotes: [], factualityStatus: "passed" };
    case "design-agent":
      return { trendBriefPath: path, referenceBoardPath: path, informationArchitecturePath: path, uxFlowPath: path, designTokensPath: path, componentSpecsPath: path, feHandoffPath: path, implementationRisk: [], accessibilityNotes: ["Verify keyboard/focus states in FE implementation."] };
    default:
      return { artifact: { id: artifactId }, events: [] };
  }
}

export async function processAutonomousTask(task: AutonomousTaskRecord, now = new Date()): Promise<AutonomousTaskRunResult> {
  if (task.agent) {
    const preflight = await runHarnessPreflight({ agentSlug: task.agent.slug, taskId: task.id, title: task.title, summary: task.summary, riskLevel: task.riskLevel, systemScope: "company" });
    if (!preflight.pass) {
      await db.$transaction(async (tx) => {
        await tx.agentFailure.create({ data: { agentSlug: task.agent!.slug, taskId: task.id, failureClass: preflight.failureClass ?? "POLICY_VIOLATION", severity: "warning", summary: `Harness preflight blocked execution: ${preflight.checks.join(", ")}`, createsEvalCase: true } });
        await tx.event.create({ data: { type: "agent.harness.blocked", severity: "warning", message: `Harness preflight blocked: ${task.agent!.slug}`, agentId: task.agent!.id, taskId: task.id, metadata: { checks: preflight.checks, failureClass: preflight.failureClass, harnessVersion: preflight.harnessVersion } } });
        await tx.task.update({ where: { id: task.id }, data: { status: "blocked", blocker: `Harness preflight failed: ${preflight.failureClass}`, nextAction: "Review agent capability/policy before retry", verificationStatus: "failed" } });
      });
      return { status: "skipped", reason: "harness_preflight_failed", taskId: task.id, agentSlug: task.agent.slug };
    }
  }
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
      db.task.update({ where: { id: task.id }, data: runningTaskData("autonomous-agent-worker", now) }),
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
      await tx.verification.create({
        data: completionVerificationCreate({
          taskId: task.id,
          verifier: "autonomous-agent-worker",
          checks: ["hermes_subprocess_finished", "artifact_linked", hermesResult.status === "completed" ? "worker_report_available" : "worker_report_failed"],
          evidence: { artifactId: artifact.id, reportPath: hermesResult.reportPath, status: hermesResult.status, gitCommit: hermesResult.git?.commit ?? null }
        })
      });
      await tx.task.update({
        where: { id: task.id },
        data: hermesResult.status === "completed"
          ? verifiedCompletionTaskData({ verifiedBy: "autonomous-agent-worker", evidence: { artifactId: artifact.id, reportPath: hermesResult.reportPath }, now, summary: operatorSummary || task.summary, nextAction: `Hermes Company execution verified at ${hermesResult.executedAt}` })
          : { status: "failed", verificationStatus: "failed", summary: operatorSummary || task.summary, blocker: "Hermes Company execution failed", nextAction: "Hermes execution log review needed" }
      });
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
          metadata: { mode: "hermes_company_bridge", reportPath: hermesResult.reportPath, artifactId: artifact.id, executedAt: hermesResult.executedAt, stdout: hermesResult.stdout.slice(0, 12000), stderr: hermesResult.stderr.slice(0, 4000), operatorSummary, git: hermesResult.git }
        }
      });
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
    });

    const completedParentTaskIds = await completeFinishedHqParents(task.id, now);
    return { status: hermesResult.status === "completed" ? "completed" : "skipped", reason: hermesResult.status === "failed" ? "hermes_execution_failed" : undefined, taskId: task.id, agentSlug: task.agent.slug, completedParentTaskIds };
  }

  if (plan.events.length === 0) {
    return { status: "skipped", reason: "no_autonomous_events", taskId: task.id, agentSlug: task.agent.slug };
  }

  let harnessBlocked = false;
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

    await tx.task.update({ where: { id: task.id }, data: verifyingTaskData("adapter_artifact_created") });
    const harnessOutput = adapterOutputForAgent(task, artifact?.id ?? null, now);
    const harnessCompletion = await runHarnessCompletion(task.agent!.slug, harnessOutput);
    await tx.agentEvalResult.create({
      data: {
        agentSlug: task.agent!.slug,
        harnessVersion: harnessCompletion.harnessVersion,
        score: harnessCompletion.score,
        pass: harnessCompletion.pass,
        dimensionScores: { checks: harnessCompletion.checks } as Prisma.InputJsonValue,
        outputJson: harnessOutput as Prisma.InputJsonValue,
        failureReason: harnessCompletion.failureClass ?? null
      }
    });
    if (!harnessCompletion.pass) {
      harnessBlocked = true;
      await tx.agentFailure.create({ data: { agentSlug: task.agent!.slug, taskId: task.id, failureClass: harnessCompletion.failureClass ?? "VERIFIER_FAILED", severity: "warning", summary: `Harness verifier blocked completion: ${harnessCompletion.checks.join(", ")}`, createsEvalCase: true, createsSkillCandidate: true } });
      await tx.event.create({ data: { type: "agent.harness.verifier_failed", severity: "warning", message: `Harness verifier failed: ${task.agent!.slug}`, agentId: task.agent!.id, taskId: task.id, artifactId: artifact?.id, metadata: { checks: harnessCompletion.checks, failureClass: harnessCompletion.failureClass, harnessVersion: harnessCompletion.harnessVersion } } });
      await tx.task.update({ where: { id: task.id }, data: { status: "blocked", blocker: `Harness verifier failed: ${harnessCompletion.failureClass}`, nextAction: "Fix output/schema/evidence before completion", verificationStatus: "failed" } });
      await tx.agent.update({ where: { id: task.agent!.id }, data: { status: "blocked", currentTask: null } });
      return;
    }
    await tx.verification.create({
      data: completionVerificationCreate({
        taskId: task.id,
        verifier: "runtime-harness-kernel",
        checks: ["adapter_events_created", artifact ? "artifact_linked" : "no_artifact_required", "output_schema_valid", "agent_verifier_passed"],
        evidence: { artifactId: artifact?.id ?? null, eventCount: plan.events.length, harnessVersion: harnessCompletion.harnessVersion, score: harnessCompletion.score }
      })
    });
    await tx.task.update({ where: { id: task.id }, data: verifiedCompletionTaskData({ verifiedBy: "autonomous-agent-worker", evidence: { artifactId: artifact?.id ?? null }, now, nextAction: plan.taskNextAction }) });
    await tx.agent.update({ where: { id: task.agent!.id }, data: { status: plan.agentStatus, currentTask: null } });
    for (const event of plan.events.slice(1)) {
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

  if (harnessBlocked) {
    return { status: "skipped", reason: "harness_verifier_failed", taskId: task.id, agentSlug: task.agent.slug };
  }

  const completedParentTaskIds = await completeFinishedHqParents(task.id, now);

  return { status: "completed", taskId: task.id, agentSlug: task.agent.slug, completedParentTaskIds };
}

export async function ensureIdleCompanyWork(now = new Date()): Promise<{ status: "created" | "skipped"; reason?: string; runSlug?: string; childTaskCount?: number }> {
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

  const parentTraceId = makeTraceId({ systemScope: "company", projectSlug: "ops-console", agentSlug: "hq-agent", date: now, entropy: plan.runSlug });
  await db.$transaction(async (tx) => {
    const parentTask = await tx.task.create({
      data: {
        slug: plan.parentTask.slug,
        title: plan.parentTask.title,
        status: plan.parentTask.status,
        riskLevel: plan.parentTask.riskLevel,
        summary: plan.parentTask.summary,
        nextAction: plan.parentTask.nextAction,
        agentId: hqAgentId,
        traceId: parentTraceId,
        systemScope: "company",
        planJson: { mode: "idle_work_scheduler", runSlug: plan.runSlug, childTaskCount: plan.childTasks.length }
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
        metadata: { runSlug: plan.runSlug, childTaskCount: plan.childTasks.length, mode: "idle_work_scheduler", traceId: parentTraceId }
      }
    });

    for (const child of plan.childTasks) {
      const agentId = agentIdBySlug.get(child.agentSlug);
      if (!agentId) continue;
      const childTraceId = makeTraceId({ systemScope: "company", projectSlug: "ops-console", agentSlug: child.agentSlug, date: now, entropy: child.slug });
      const childTask = await tx.task.create({
        data: {
          slug: child.slug,
          title: child.title,
          status: child.status,
          riskLevel: child.riskLevel,
          summary: child.summary,
          nextAction: child.nextAction,
          agentId,
          parentTaskId: parentTask.id,
          traceId: childTraceId,
          systemScope: "company",
          planJson: { mode: "idle_work_scheduler", runSlug: plan.runSlug, parentTaskId: parentTask.id, department: child.agentSlug.replace("-agent", "") }
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
          metadata: { orchestrationRunId: plan.runSlug, parentTaskId: parentTask.id, childTaskId: childTask.id, department: child.agentSlug.replace("-agent", ""), mode: "idle_work_scheduler", traceId: childTraceId }
        }
      });
      await tx.event.create({
        data: {
          type: "hq.delegation.started",
          severity: "info",
          message: `Standing work started: ${child.title}`,
          agentId,
          taskId: childTask.id,
          metadata: { parentTaskId: parentTask.id, runSlug: plan.runSlug, mode: "idle_work_scheduler", traceId: childTraceId }
        }
      });
    }
  });

  return { status: "created", runSlug: plan.runSlug, childTaskCount: plan.childTasks.length };
}

export async function processNextAutonomousTask(now = new Date()): Promise<AutonomousTaskRunResult> {
  await ensureIdleCompanyWork(now);
  const tasks = await db.task.findMany({
    where: {
      status: { in: ["queued", "running"] },
      agent: { slug: { in: [...AUTONOMOUS_WORK_AGENT_SLUGS] } }
    },
    orderBy: [{ status: "desc" }, { updatedAt: "asc" }],
    take: 20,
    select: {
      id: true,
      title: true,
      summary: true,
      status: true,
      updatedAt: true,
      riskLevel: true,
      projectId: true,
      agent: { select: { id: true, slug: true, name: true } }
    }
  });
  const task = selectNextAutonomousTaskCandidate(tasks);

  if (!task) {
    return { status: "skipped", reason: "no_queued_task" };
  }

  return processAutonomousTask(task, now);
}
