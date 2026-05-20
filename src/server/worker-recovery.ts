import type { Prisma } from "@prisma/client";

export type WorkerRecoveryPlan = {
  update: Prisma.TaskUpdateInput;
  incident: Prisma.IncidentCreateInput;
};

export function buildWorkerRecoveryPlan(input: { taskId: string; taskTitle: string; claimedBy: string | null; leaseExpiresAt: Date | null; now?: Date; traceId?: string | null; systemScope?: "company" | "crypto" | "auth" | "alpha" | "personal" | "infra" }): WorkerRecoveryPlan | null {
  const now = input.now ?? new Date();
  if (!input.leaseExpiresAt || input.leaseExpiresAt.getTime() > now.getTime()) return null;
  const worker = input.claimedBy || "unknown-worker";
  return {
    update: {
      status: "retry_scheduled",
      statusReason: `lease_expired:${worker}`,
      blocker: `Worker lease expired for ${worker}`,
      attempt: { increment: 1 },
      claimedBy: null,
      claimedAt: null,
      heartbeatAt: null,
      leaseExpiresAt: null,
      currentStep: "worker_recovery"
    },
    incident: {
      type: "worker.lease_expired",
      severity: "warning",
      status: "open",
      title: `Worker lease expired · ${input.taskTitle}`,
      summary: `Task ${input.taskId} was moved to retry_scheduled because ${worker} missed the lease heartbeat.`,
      traceId: input.traceId ?? undefined,
      systemScope: input.systemScope ?? "company",
      taskId: input.taskId
    }
  };
}
