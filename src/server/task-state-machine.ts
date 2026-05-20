import type { Prisma, RiskLevel, TaskStatus, VerificationStatus } from "@prisma/client";

export const TERMINAL_TASK_STATUSES: TaskStatus[] = ["completed", "failed", "cancelled", "expired", "rolled_back", "archived"];
export const ACTIVE_TASK_STATUSES: TaskStatus[] = ["created", "classified", "planned", "waiting_approval", "queued", "claimed", "running", "tool_wait", "verifying", "blocked", "retry_scheduled", "needs_changes"];

const RISK_ORDER: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };

export function makeTraceId(input: { systemScope?: string | null; projectSlug?: string | null; agentSlug?: string | null; date?: Date; entropy?: string }): string {
  const date = (input.date ?? new Date()).toISOString().slice(0, 10).replace(/-/g, "");
  const system = (input.systemScope || "company").replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  const project = (input.projectSlug || "ops").replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  const agent = (input.agentSlug || "agent").replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  const short = (input.entropy || Math.random().toString(36).slice(2, 8)).replace(/[^a-z0-9]/gi, "").slice(0, 8) || "trace";
  return `trace_${date}_${system}_${project}_${agent}_${short}`;
}

export function canAutoRunRisk(risk: RiskLevel): boolean {
  return RISK_ORDER[risk] <= RISK_ORDER.medium;
}

export function maxAttemptsForRisk(risk: RiskLevel): number {
  if (risk === "low") return 3;
  if (risk === "medium") return 2;
  return 1;
}

export function leaseExpiry(now = new Date(), leaseMs = 15 * 60 * 1000): Date {
  return new Date(now.getTime() + leaseMs);
}

export function claimedTaskData(workerId: string, now = new Date(), leaseMs?: number): Prisma.TaskUpdateInput {
  return {
    status: "claimed",
    claimedBy: workerId,
    claimedAt: now,
    heartbeatAt: now,
    leaseExpiresAt: leaseExpiry(now, leaseMs),
    statusReason: "worker_claimed"
  };
}

export function runningTaskData(workerId: string, now = new Date(), leaseMs?: number): Prisma.TaskUpdateInput {
  return {
    status: "running",
    claimedBy: workerId,
    claimedAt: now,
    heartbeatAt: now,
    leaseExpiresAt: leaseExpiry(now, leaseMs),
    statusReason: "worker_running"
  };
}

export function verifyingTaskData(reason = "verification_required"): Prisma.TaskUpdateInput {
  return { status: "verifying", verificationStatus: "pending", statusReason: reason };
}

export function verifiedCompletionTaskData(input: { verifiedBy: string; evidence: Record<string, unknown>; now?: Date; nextAction?: string | null; summary?: string | null }): Prisma.TaskUpdateInput {
  const completedAt = (input.now ?? new Date()).toISOString();
  return {
    status: "completed",
    verificationStatus: "passed",
    statusReason: `verified_by:${input.verifiedBy}`,
    blocker: null,
    nextAction: input.nextAction ?? `Verified completed at ${completedAt}`,
    summary: input.summary ?? undefined,
    leaseExpiresAt: null,
    currentStep: "completed"
  };
}

export function completionVerificationCreate(input: { taskId: string; verifier: string; checks: unknown[]; evidence: Record<string, unknown>; traceId?: string | null }): Prisma.VerificationCreateArgs["data"] {
  return {
    taskId: input.taskId,
    verifier: input.verifier,
    status: "passed",
    checks: input.checks as Prisma.InputJsonValue,
    evidence: input.evidence as Prisma.InputJsonValue,
    traceId: input.traceId ?? undefined
  };
}

export function requiresVerificationBeforeCompletion(status: TaskStatus, verificationStatus?: VerificationStatus | null): boolean {
  return status === "completed" && verificationStatus !== "passed" && verificationStatus !== "not_required";
}
