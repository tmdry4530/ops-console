import { compareCompanyAgents, workAgentWhereClause } from "@/lib/agent-visibility";
import { db } from "@/lib/db";
import type { Agent, Approval, Artifact, Event, RiskLevel, Task } from "@prisma/client";
import { buildLocalSystemMonitor } from "./local-system-monitor";
import { getCompanyOpsMonitor, summarizeAgentOps } from "./ops-monitor";

const ACTIVE_TASK_STATUSES = ["queued", "running", "waiting_approval", "needs_changes"] as const;
const OPEN_APPROVAL_STATUSES = ["pending", "approved_waiting_execution", "executing", "needs_changes", "manual_handoff"] as const;
const TRACE_EVENT_TYPES = [
  "ingest.status",
  "command.execution.started",
  "command.execution.completed",
  "command.execution.failed",
  "approval.requested",
  "approval.accepted",
  "approval.rejected",
  "hq.delegation.created",
  "ops.runtime.reconciled",
  "artifact.created",
  "discord.report.queued"
];

type SafeRecord = Record<string, string | number | boolean | null>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeMetadata(value: unknown): SafeRecord {
  if (!isRecord(value)) return {};
  const allowlist = [
    "model",
    "runtime",
    "scope",
    "department",
    "executionMode",
    "frequency",
    "costToday",
    "tokensToday",
    "latencyMs",
    "traceId",
    "source",
    "worker",
    "service",
    "expectedStopped",
    "healthUrl",
    "parentTaskId",
    "childTaskId",
    "targetStatus"
  ];
  return Object.fromEntries(
    allowlist
      .filter((key) => ["string", "number", "boolean"].includes(typeof value[key]) || value[key] === null)
      .map((key) => [key, value[key] as string | number | boolean | null])
  );
}

function readString(metadata: unknown, key: string): string | null {
  const safe = safeMetadata(metadata);
  return typeof safe[key] === "string" ? safe[key] : null;
}

function readNumber(metadata: unknown, key: string): number | null {
  const safe = safeMetadata(metadata);
  return typeof safe[key] === "number" ? safe[key] : null;
}

function expectedStopped(agent: Pick<Agent, "slug" | "metadata" | "currentTask">): boolean {
  const safe = safeMetadata(agent.metadata);
  const text = `${agent.slug} ${agent.currentTask ?? ""}`.toLowerCase();
  return safe.expectedStopped === true || (text.includes("worker") && text.includes("gateway") && text.includes("stopped"));
}

function scopeForAgent(slug: string): "Company" | "Auth" | "Crypto" | "Alpha" | "X-CDP" | "Shared" {
  const lower = slug.toLowerCase();
  if (lower.includes("auth") || lower.includes("oauth")) return "Auth";
  if (lower.includes("crypto") || lower.includes("trading")) return "Crypto";
  if (lower.includes("alpha")) return "Alpha";
  if (lower.includes("x-cdp") || lower.includes("cdp")) return "X-CDP";
  if (["hq-agent", "docs-agent", "dev-agent", "design-agent", "research-agent", "content-agent"].some((key) => lower.includes(key))) return "Company";
  return "Shared";
}

function riskWeight(risk: RiskLevel) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[risk];
}

function eventSource(event: Event) {
  const safe = safeMetadata(event.metadata);
  return (typeof safe.source === "string" && safe.source) || event.type.split(".")[0] || "ops";
}

function traceIdFor(item: { id: string; metadata?: unknown; taskId?: string | null; agentId?: string | null }) {
  return readString(item.metadata, "traceId") ?? item.taskId ?? item.agentId ?? item.id;
}

function shortId(id: string) {
  return id.slice(0, 8);
}

export async function getControlCenterSummary(now = new Date()) {
  const [monitor, agentsRaw, tasks, approvals, events, artifacts, commands] = await Promise.all([
    getCompanyOpsMonitor(now),
    db.agent.findMany({
      where: workAgentWhereClause(),
      orderBy: { updatedAt: "desc" },
      include: { capabilities: { orderBy: { capabilityKey: "asc" }, take: 8 } }
    }),
    db.task.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 80,
      include: { agent: true, project: true }
    }),
    db.approval.findMany({
      where: { status: { in: [...OPEN_APPROVAL_STATUSES] } },
      orderBy: [{ riskLevel: "desc" }, { updatedAt: "desc" }],
      take: 40,
      include: { task: true, project: true }
    }),
    db.event.findMany({ orderBy: { createdAt: "desc" }, take: 120, include: { agent: true, task: true, approval: true } }),
    db.artifact.findMany({ orderBy: { updatedAt: "desc" }, take: 40 }),
    db.commandQueue.findMany({ orderBy: { updatedAt: "desc" }, take: 40, include: { approval: true } })
  ]);

  const agents = agentsRaw.sort(compareCompanyAgents).map((agent) => {
    const runtime = summarizeAgentOps(agent, now);
    const agentTasks = tasks.filter((task) => task.agentId === agent.id);
    const activeTasks = agentTasks.filter((task) => ACTIVE_TASK_STATUSES.includes(task.status as (typeof ACTIVE_TASK_STATUSES)[number]));
    const metadata = safeMetadata(agent.metadata);
    const stoppedByDesign = expectedStopped(agent);
    const queueDepth = agentTasks.filter((task) => task.status === "queued").length;
    return {
      id: agent.id,
      slug: agent.slug,
      name: agent.name,
      scope: scopeForAgent(agent.slug),
      status: agent.status,
      health: stoppedByDesign ? "ok" : agent.health,
      runtime: stoppedByDesign ? "idle" : runtime.runtime,
      runtimeLabel: stoppedByDesign ? "stopped by design" : runtime.runtime,
      heartbeatAt: agent.heartbeatAt,
      currentTask: activeTasks[0]?.title ?? agent.currentTask,
      currentTaskId: activeTasks[0]?.id ?? null,
      model: typeof metadata.model === "string" ? metadata.model : "unknown",
      costToday: readNumber(agent.metadata, "costToday") ?? 0,
      tokensToday: readNumber(agent.metadata, "tokensToday") ?? 0,
      latencyMs: readNumber(agent.metadata, "latencyMs") ?? null,
      risk: agent.capabilities.reduce<RiskLevel>((max, capability) => (riskWeight(capability.maxRisk) > riskWeight(max) ? capability.maxRisk : max), "low"),
      queueDepth,
      activeCount: activeTasks.length,
      failures24h: agentTasks.filter((task) => task.status === "failed" && now.getTime() - task.updatedAt.getTime() < 24 * 60 * 60 * 1000).length,
      capabilities: agent.capabilities.map((capability) => capability.capabilityKey),
      tools: [...new Set(agent.capabilities.flatMap((capability) => Array.isArray(capability.allowedTools) ? capability.allowedTools.filter((tool): tool is string => typeof tool === "string") : []))].slice(0, 8),
      expectedStopped: stoppedByDesign
    };
  });

  const taskRows = tasks.map((task) => ({
    id: task.id,
    slug: task.slug,
    title: task.title,
    status: task.status,
    riskLevel: task.riskLevel,
    agentName: task.agent?.name ?? "미배정",
    agentId: task.agentId,
    projectName: task.project?.name ?? "scope 없음",
    scope: task.agent ? scopeForAgent(task.agent.slug) : "Shared",
    summary: task.summary,
    blocker: task.blocker,
    nextAction: task.nextAction,
    traceId: traceIdFor({ id: task.id, taskId: task.id }),
    updatedAt: task.updatedAt,
    createdAt: task.createdAt
  }));

  const approvalRows = approvals.map((approval) => ({
    id: approval.id,
    title: approval.title,
    summary: approval.summary,
    type: approval.type,
    status: approval.status,
    riskLevel: approval.riskLevel,
    requester: approval.requestedBy ?? approval.task?.agentId ?? "system",
    scope: approval.project?.name ?? approval.task?.title ?? "Company Ops",
    taskId: approval.taskId,
    traceId: traceIdFor({ id: approval.id, taskId: approval.taskId }),
    commandPreview: commands.find((command) => command.approvalId === approval.id)?.actionType ?? null,
    secretExposureCheck: "not_applicable" as const,
    createdAt: approval.createdAt,
    updatedAt: approval.updatedAt
  })).sort((a, b) => riskWeight(b.riskLevel) - riskWeight(a.riskLevel));

  const eventRows = events.slice(0, 60).map((event) => ({
    id: event.id,
    type: event.type,
    source: eventSource(event),
    severity: event.severity,
    message: event.message,
    traceId: traceIdFor({ id: event.id, metadata: event.metadata, taskId: event.taskId, agentId: event.agentId }),
    agentName: event.agent?.name ?? null,
    taskTitle: event.task?.title ?? null,
    approvalTitle: event.approval?.title ?? null,
    createdAt: event.createdAt,
    metadata: safeMetadata(event.metadata)
  }));

  const traceRows = events
    .filter((event) => TRACE_EVENT_TYPES.includes(event.type) || event.taskId || event.approvalId || event.commandQueueId)
    .slice(0, 24)
    .map((event) => ({
      id: event.id,
      traceId: traceIdFor({ id: event.id, metadata: event.metadata, taskId: event.taskId, agentId: event.agentId }),
      kind: event.type.includes("approval") ? "approval" : event.type.includes("command") ? "command" : event.type.includes("artifact") ? "artifact" : event.severity === "critical" ? "error" : "event",
      title: event.message,
      status: event.severity === "critical" ? "failed" : event.severity === "warning" ? "blocked" : "succeeded",
      at: event.createdAt,
      related: [event.agent?.name, event.task?.title, event.approval?.title].filter(Boolean).join(" · ")
    }));

  const highRiskApprovals = approvalRows.filter((approval) => approval.riskLevel === "high" || approval.riskLevel === "critical");
  const criticalEvents = eventRows.filter((event) => event.severity === "critical");
  const failedTasks = taskRows.filter((task) => task.status === "failed");
  const incidents = [
    ...criticalEvents.slice(0, 8).map((event) => ({
      id: `evt-${shortId(event.id)}`,
      severity: "critical" as const,
      title: event.message,
      affectedScope: [event.agentName, event.taskTitle].filter(Boolean) as string[],
      state: "detected" as const,
      updatedAt: event.createdAt,
      traceId: event.traceId
    })),
    ...failedTasks.slice(0, 8).map((task) => ({
      id: `task-${shortId(task.id)}`,
      severity: task.riskLevel === "critical" || task.riskLevel === "high" ? "major" as const : "minor" as const,
      title: task.title,
      affectedScope: [task.agentName, task.scope],
      state: "triaged" as const,
      updatedAt: task.updatedAt,
      traceId: task.traceId
    }))
  ];

  const healthRows = [
    { name: "Ops API", scope: "Company", status: "ok", note: "Next.js route online" },
    { name: "Approval service", scope: "Company", status: approvalRows.length > 0 ? "degraded" : "ok", note: `${approvalRows.length} open approvals` },
    { name: "Cron scheduler", scope: "Shared", status: eventRows.some((event) => event.type.includes("cron") && event.severity === "critical") ? "failing" : "ok", note: "cron/auth incidents monitored" },
    { name: "Auth proxy", scope: "Auth", status: eventRows.some((event) => event.source.includes("auth") && event.severity === "critical") ? "failing" : "ok", note: "scope isolated" },
    { name: "Worker gateway", scope: "Company", status: "stopped", note: "stopped by design · 정상" },
    ...agents.slice(0, 10).map((agent) => ({ name: agent.name, scope: agent.scope, status: agent.expectedStopped ? "stopped" : agent.health, note: agent.currentTask ?? "대기" }))
  ];

  const scopeBoundaries = [
    { scope: "Company", state: "active", rule: "Ops Console canonical state. Product/dev/docs/design only." },
    { scope: "Auth", state: "isolated", rule: "OAuth/auth manager status only. Secret/cookie/token value hidden." },
    { scope: "Crypto", state: "isolated", rule: "Signals and monitoring only. No live trading from Company scope." },
    { scope: "Alpha", state: "isolated", rule: "Trading system handoff only. Execution requires separate approval." },
    { scope: "X-CDP", state: "isolated", rule: "CDP-specific tasks stay out of Company active scope." }
  ];

  const totalCostToday = agents.reduce((sum, agent) => sum + agent.costToday, 0);
  const averageLatencyMs = Math.round(agents.reduce((sum, agent) => sum + (agent.latencyMs ?? 0), 0) / Math.max(1, agents.filter((agent) => agent.latencyMs !== null).length));

  const localSystems = buildLocalSystemMonitor({
    now,
    checks: {
      "company-router": { state: "ok", detail: "manifest and router health tracked separately" },
      "ops-console": { state: "ok", detail: "Ops Console DB/API is canonical" },
      "developer-job-dashboard": { state: "unknown", detail: "checked by router health probe" },
      "alpha-terminal": { state: "unknown", detail: "Alpha scope stays isolated" },
      "auth-manager": { state: eventRows.some((event) => event.source.includes("auth") && event.severity === "critical") ? "error" : "ok", detail: "launchd health monitor; secrets hidden" },
      "crypto-signal": { state: eventRows.some((event) => event.source.includes("crypto") && event.severity === "critical") ? "error" : "unknown", detail: "collector/CDP process-backed; Company read-only" }
    }
  });

  return {
    generatedAt: now,
    summary: {
      agents: agents.length,
      running: agents.filter((agent) => agent.runtime === "process_live" || agent.runtime === "workflow_running").length,
      idle: agents.filter((agent) => agent.runtime === "idle").length,
      queueDepth: taskRows.filter((task) => task.status === "queued").length,
      activeTasks: taskRows.filter((task) => ACTIVE_TASK_STATUSES.includes(task.status as (typeof ACTIVE_TASK_STATUSES)[number])).length,
      openApprovals: approvalRows.length,
      highRiskApprovals: highRiskApprovals.length,
      incidents: incidents.length,
      totalCostToday,
      averageLatencyMs,
      artifacts: artifacts.length,
      restrictedArtifacts: artifacts.filter((artifact: Artifact) => artifact.restricted).length,
      commandsOpen: commands.filter((command) => ["queued", "waiting_manual_handoff", "running"].includes(command.status)).length
    },
    monitorTotals: monitor.totals,
    localSystems,
    agents,
    tasks: taskRows,
    approvals: approvalRows,
    highRiskApprovals,
    events: eventRows,
    healthRows,
    traces: traceRows,
    incidents,
    scopeBoundaries,
    costRows: agents.map((agent) => ({ agent: agent.name, model: agent.model, costToday: agent.costToday, tokensToday: agent.tokensToday, latencyMs: agent.latencyMs, traceId: agent.currentTaskId ?? agent.id }))
  };
}

export type ControlCenterSummary = Awaited<ReturnType<typeof getControlCenterSummary>>;
