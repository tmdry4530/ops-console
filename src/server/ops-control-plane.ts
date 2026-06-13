import { db } from "@/lib/db";
import { compileGlobalCommand, type CompiledGlobalCommand } from "./command-compiler";
import { getControlCenterSummary } from "./control-center";
import type { RiskLevel } from "@prisma/client";

export type SafeMetadata = Record<string, string | number | boolean | null>;

const SECRET_KEY_PATTERN = /(secret|token|cookie|authorization|api[_-]?key|password|private[_-]?key|seed|mnemonic|2fa|totp|db[_-]?url|database_url)/i;
const SECRET_TEXT_PATTERN = /(bearer\s+[a-z0-9._~+/=-]+|sk-[a-z0-9_-]+|api[_ -]?key|authorization|password|private\s*key|secret|token|cookie|seed phrase|mnemonic|totp|2fa|database_url|db\s*url)/i;
const SAFE_METADATA_KEYS = new Set([
  "id",
  "slug",
  "status",
  "state",
  "source",
  "runtime",
  "model",
  "host",
  "processName",
  "version",
  "durationMs",
  "latencyMs",
  "retryCount",
  "exitCode",
  "queueDepth",
  "runningCommands",
  "tokensToday",
  "inputTokens",
  "outputTokens",
  "costToday",
  "costUsd",
  "riskLevel",
  "decision",
  "policyDecision",
  "autonomyLevel",
  "errorClass",
  "traceId",
  "runId",
  "spanId",
  "taskId",
  "projectId",
  "agentId",
  "agentSlug",
  "targetAgentSlug",
  "commandQueueId",
  "approvalId",
  "action",
  "actionType",
  "scopeLimit",
  "breakGlass",
  "compiledFrom",
  "verifierRequired"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function secretSafeMetadata(input: unknown): SafeMetadata {
  if (!isRecord(input)) return {};
  const output: SafeMetadata = {};
  for (const [key, value] of Object.entries(input)) {
    if (SECRET_KEY_PATTERN.test(key) || !SAFE_METADATA_KEYS.has(key)) continue;
    if (["number", "boolean"].includes(typeof value) || value === null) {
      output[key] = value as number | boolean | null;
      continue;
    }
    if (typeof value === "string") {
      output[key] = redactSecretLikeText(value).slice(0, 500);
    }
  }
  return output;
}

export function hasSecretLikeText(value: string | null | undefined): boolean {
  return Boolean(value && SECRET_TEXT_PATTERN.test(value));
}

export function redactSecretLikeText(value: string): string {
  return SECRET_TEXT_PATTERN.test(value) ? "[REDACTED_SECRET_LIKE]" : value;
}

function requireSecretSafeText(value: unknown, field: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  if (hasSecretLikeText(value)) throw new Error(`${field}_secret_like_text_rejected`);
  return value.slice(0, 1000);
}

function safeCommandActionType(value: unknown, fallback: string) {
  if (typeof value === "string" && /^(agent_control|control|ops)_[a-z0-9_]+$/.test(value)) return value;
  return fallback;
}

async function createControlTraceSpan(input: { traceId: string; eventId: string; commandQueueId: string; actionType: string; status: string; riskLevel: RiskLevel; approvalId?: string | null; controlActionId?: string | null; }) {
  await db.traceSpan.create({
    data: {
      traceId: input.traceId,
      commandQueueId: input.commandQueueId,
      eventId: input.eventId,
      kind: "command",
      name: `control_action.${input.actionType}`,
      status: input.status === "queued" || input.status === "completed" ? "ok" : input.status === "blocked" ? "blocked" : "pending",
      attributes: secretSafeMetadata({ action: input.actionType, commandQueueId: input.commandQueueId, approvalId: input.approvalId ?? null, riskLevel: input.riskLevel, status: input.status, traceId: input.traceId })
    }
  });
}

export type ControlPolicyInput = {
  actionType: string;
  riskLevel?: RiskLevel;
  breakGlass?: boolean;
  breakGlassPreApproved?: boolean;
};

export type ControlPolicyDecision = {
  decision: "allow_queue" | "require_approval" | "require_manual_handoff" | "block";
  status: "queued" | "approval_required" | "manual_handoff" | "blocked";
  commandStatus?: "queued" | "waiting_approval" | "waiting_manual_handoff" | "blocked";
  riskLevel: RiskLevel;
  reasons: string[];
};

const RISK_WEIGHT: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };
const HIGH_RISK_ACTIONS = new Set(["rollback", "restart", "kill", "deploy", "external_send"]);
const EMERGENCY_ACTIONS = new Set(["emergency_stop", "emergency-stop"]);
const FORBIDDEN_ACTIONS = new Set(["live_trading", "payment", "wallet_transfer", "read_secret", "approval_bypass"]);

function maxRisk(left: RiskLevel, right: RiskLevel): RiskLevel {
  return RISK_WEIGHT[left] >= RISK_WEIGHT[right] ? left : right;
}

export function classifyControlActionRisk(actionType: string, explicit?: RiskLevel): RiskLevel {
  const action = actionType.trim().toLowerCase().replace(/-/g, "_");
  if (EMERGENCY_ACTIONS.has(action) || FORBIDDEN_ACTIONS.has(action)) return "critical";
  if (action === "pure_containment_freeze" || HIGH_RISK_ACTIONS.has(action)) return maxRisk(explicit ?? "low", "high");
  if (["cancel", "reassign", "scope_limit", "request_more_evidence"].includes(action)) return maxRisk(explicit ?? "low", "medium");
  return explicit ?? "low";
}

export function decideControlActionPolicy(input: ControlPolicyInput): ControlPolicyDecision {
  const normalizedAction = input.actionType.trim().toLowerCase().replace(/-/g, "_");
  const riskLevel = classifyControlActionRisk(normalizedAction, input.riskLevel);

  if (FORBIDDEN_ACTIONS.has(normalizedAction)) {
    return { decision: "block", status: "blocked", commandStatus: "blocked", riskLevel, reasons: ["forbidden_action_scope"] };
  }

  if (EMERGENCY_ACTIONS.has(normalizedAction)) {
    return { decision: "require_manual_handoff", status: "manual_handoff", commandStatus: "waiting_manual_handoff", riskLevel: "critical", reasons: ["emergency_stop_manual_by_default"] };
  }

  if (normalizedAction === "pure_containment_freeze" && input.breakGlass === true && input.breakGlassPreApproved === true) {
    return { decision: "allow_queue", status: "queued", commandStatus: "queued", riskLevel: "high", reasons: ["break_glass_pure_containment_freeze"] };
  }

  if (RISK_WEIGHT[riskLevel] >= RISK_WEIGHT.high) {
    return { decision: "require_approval", status: "approval_required", commandStatus: "waiting_approval", riskLevel, reasons: ["high_critical_requires_human_approval"] };
  }

  return { decision: "allow_queue", status: "queued", commandStatus: "queued", riskLevel, reasons: ["low_medium_internal_auto_allowed"] };
}

export function compileOpsCommand(raw: string) {
  const compiled = compileGlobalCommand(raw);
  if (!compiled.ok) return compiled;
  const policy = decideControlActionPolicy({ actionType: compiled.action, riskLevel: compiled.riskLevel });
  return { ...compiled, policy, requiresApproval: policy.decision !== "allow_queue" };
}

export function safeCompiledCommandResponse(compiled: ReturnType<typeof compileOpsCommand>) {
  if (compiled.ok !== true) {
    const blocked = compiled as { blockedTerms?: string[] };
    return { ok: false as const, reason: "blocked_by_policy", blockedTerms: (blocked.blockedTerms ?? []).map((term) => redactSecretLikeText(term)) };
  }
  const success = compiled as Extract<CompiledGlobalCommand, { ok: true }> & { policy: ControlPolicyDecision };
  return {
    ok: true as const,
    kind: success.kind,
    action: success.action,
    targetAgentSlug: success.targetAgentSlug,
    riskLevel: success.riskLevel,
    requiresApproval: success.requiresApproval,
    verifierRequired: success.verifierRequired,
    commandQueuePayload: secretSafeMetadata(success.commandQueuePayload),
    policy: success.policy
  };
}

type QueueCompiledInput = {
  compiled: Extract<CompiledGlobalCommand, { ok: true }> & { policy?: ControlPolicyDecision };
  requestedBy?: string;
};

export async function queueCompiledCommand(input: QueueCompiledInput) {
  const policy = input.compiled.policy ?? decideControlActionPolicy({ actionType: input.compiled.action, riskLevel: input.compiled.riskLevel });
  const payload = secretSafeMetadata(input.compiled.commandQueuePayload);
  const operatorSummary = requireSecretSafeText(input.compiled.operatorSummary, "operator_summary") ?? input.compiled.action;
  const approval = policy.decision === "require_approval" || policy.decision === "require_manual_handoff"
    ? await db.approval.create({
        data: {
          type: "other",
          status: policy.decision === "require_manual_handoff" ? "manual_handoff" : "pending",
          riskLevel: policy.riskLevel,
          title: `Control action gate · ${input.compiled.action}`,
          summary: `${operatorSummary}\nReasons: ${policy.reasons.join(", ")}`,
          requestedBy: input.requestedBy ?? "ops-control-plane"
        },
        select: { id: true }
      })
    : null;

  const command = await db.commandQueue.create({
    data: {
      actionType: `ops_${input.compiled.action}`,
      status: policy.commandStatus ?? "blocked",
      riskLevel: policy.riskLevel,
      approvalId: approval?.id,
      payload: { ...payload, policyDecision: policy.decision }
    },
    select: { id: true }
  });

  const controlAction = await db.controlAction.create({
    data: {
      actionType: input.compiled.action,
      status: policy.status,
      riskLevel: policy.riskLevel,
      commandQueueId: command.id,
      approvalId: approval?.id,
      requestedBy: input.requestedBy ?? "ops-control-plane",
      payload
    },
    select: { id: true }
  });

  const traceId = String(payload.traceId ?? `ctrl_${controlAction.id}`);
  const event = await db.event.create({
    data: {
      type: `control.action.${policy.status}`,
      severity: policy.riskLevel === "critical" ? "critical" : policy.riskLevel === "high" ? "warning" : "info",
      message: `Control action ${policy.status}: ${input.compiled.action}`,
      commandQueueId: command.id,
      approvalId: approval?.id,
      metadata: secretSafeMetadata({ action: input.compiled.action, commandQueueId: command.id, approvalId: approval?.id ?? null, riskLevel: policy.riskLevel, decision: policy.decision, traceId })
    },
    select: { id: true }
  });
  await createControlTraceSpan({ traceId, eventId: event.id, commandQueueId: command.id, actionType: input.compiled.action, status: policy.status, riskLevel: policy.riskLevel, approvalId: approval?.id, controlActionId: controlAction.id });

  return { status: policy.status, riskLevel: policy.riskLevel, reasons: policy.reasons, commandQueueId: command.id, approvalId: approval?.id, controlActionId: controlAction.id, traceId };
}

export async function requestControlAction(body: unknown, requestedBy = "ops-control-plane") {
  const data = isRecord(body) ? body : {};
  const actionType = String(data.actionType ?? data.action ?? "").trim().toLowerCase().replace(/-/g, "_");
  if (!actionType) throw new Error("action_required");
  const breakGlassApprovalId = typeof data.breakGlassApprovalId === "string" ? data.breakGlassApprovalId : null;
  const breakGlassApproval = data.breakGlass === true && actionType === "pure_containment_freeze" && breakGlassApprovalId
    ? await db.approval.findFirst({
        where: { id: breakGlassApprovalId, status: { in: ["approved_waiting_execution", "executing"] }, riskLevel: { in: ["high", "critical"] } },
        select: { id: true }
      })
    : null;
  const riskLevel = classifyControlActionRisk(actionType, typeof data.riskLevel === "string" ? data.riskLevel as RiskLevel : undefined);
  const policy = decideControlActionPolicy({ actionType, riskLevel, breakGlass: data.breakGlass === true, breakGlassPreApproved: Boolean(breakGlassApproval) });
  const reason = requireSecretSafeText(data.reason, "reason");
  const scopeLimit = requireSecretSafeText(data.scopeLimit, "scope_limit");
  const payload = secretSafeMetadata(isRecord(data.payload) ? data.payload : data);
  const commandActionType = safeCommandActionType(data.commandActionType, `control_${actionType}`);

  const approval = policy.decision === "require_approval" || policy.decision === "require_manual_handoff"
    ? await db.approval.create({
        data: {
          type: "other",
          status: policy.decision === "require_manual_handoff" ? "manual_handoff" : "pending",
          riskLevel: policy.riskLevel,
          title: `Control action gate · ${actionType}`,
          summary: reason ?? policy.reasons.join(", "),
          requestedBy
        },
        select: { id: true }
      })
    : null;

  const command = await db.commandQueue.create({
    data: {
      actionType: commandActionType,
      status: policy.commandStatus ?? "blocked",
      riskLevel: policy.riskLevel,
      approvalId: approval?.id ?? breakGlassApproval?.id,
      payload: { ...payload, action: actionType, policyDecision: policy.decision }
    },
    select: { id: true }
  });

  const controlAction = await db.controlAction.create({
    data: {
      actionType,
      status: policy.status,
      riskLevel: policy.riskLevel,
      targetAgentId: typeof data.targetAgentId === "string" ? data.targetAgentId : null,
      runId: typeof data.runId === "string" ? data.runId : null,
      taskId: typeof data.taskId === "string" ? data.taskId : null,
      commandQueueId: command.id,
      approvalId: approval?.id ?? breakGlassApproval?.id,
      requestedBy,
      reason,
      scopeLimit,
      payload
    },
    select: { id: true }
  });

  const traceId = typeof data.traceId === "string" ? redactSecretLikeText(data.traceId).slice(0, 200) : `ctrl_${controlAction.id}`;
  const event = await db.event.create({
    data: {
      type: `control.action.${policy.status}`,
      severity: policy.riskLevel === "critical" ? "critical" : policy.riskLevel === "high" ? "warning" : "info",
      message: `Control action ${policy.status}: ${actionType}`,
      agentId: typeof data.targetAgentId === "string" ? data.targetAgentId : null,
      taskId: typeof data.taskId === "string" ? data.taskId : null,
      approvalId: approval?.id ?? breakGlassApproval?.id,
      commandQueueId: command.id,
      metadata: secretSafeMetadata({ action: actionType, commandQueueId: command.id, approvalId: approval?.id ?? breakGlassApproval?.id ?? null, riskLevel: policy.riskLevel, decision: policy.decision, traceId })
    },
    select: { id: true }
  });
  await createControlTraceSpan({ traceId, eventId: event.id, commandQueueId: command.id, actionType, status: policy.status, riskLevel: policy.riskLevel, approvalId: approval?.id ?? breakGlassApproval?.id, controlActionId: controlAction.id });

  return { status: policy.status, riskLevel: policy.riskLevel, reasons: policy.reasons, commandQueueId: command.id, approvalId: approval?.id ?? breakGlassApproval?.id, controlActionId: controlAction.id, traceId };
}

export function redactOpsRecord<T extends Record<string, unknown>>(record: T): T {
  const copy: Record<string, unknown> = { ...record };
  for (const key of ["metadata", "payload", "attributes", "metrics", "result", "input", "output"] as const) {
    if (key in copy) copy[key] = secretSafeMetadata(copy[key]);
  }
  for (const key of ["message", "summary", "decisionNote", "blocker", "nextAction", "reason", "scopeLimit", "operatorSummary"] as const) {
    if (typeof copy[key] === "string") copy[key] = redactSecretLikeText(copy[key]);
  }
  return copy as T;
}

function isOptionalControlSchemaDrift(error: unknown) {
  const message = error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : "";
  return Boolean(
    error &&
      typeof error === "object" &&
      (("code" in error && (error.code === "P2021" || error.code === "P2022")) ||
        (/table|column/i.test(message) && /does not exist/i.test(message)))
  );
}

export async function findOptionalControlRecords<T>(query: () => Promise<T[]>): Promise<T[]> {
  try {
    return await query();
  } catch (error) {
    if (isOptionalControlSchemaDrift(error)) return [];
    throw error;
  }
}

export async function getOpsOverview() {
  const summary = await getControlCenterSummary();
  const [runs, actions, spans] = await Promise.all([
    findOptionalControlRecords(() => db.orchestrationRun.findMany({ orderBy: { updatedAt: "desc" }, take: 20 })),
    findOptionalControlRecords(() => db.controlAction.findMany({ orderBy: { updatedAt: "desc" }, take: 20 })),
    findOptionalControlRecords(() => db.traceSpan.findMany({ orderBy: { updatedAt: "desc" }, take: 20 }))
  ]);
  return { ...summary, orchestrationRuns: runs.map(redactOpsRecord), controlActions: actions.map(redactOpsRecord), traceSpans: spans.map(redactOpsRecord) };
}
