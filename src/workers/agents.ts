import { logInfo } from "@/lib/logger";
import { processNextAutonomousTask } from "@/server/agent-autonomy";
import { syncHqOrchestrationRuntime } from "@/server/ops-monitor";
import { recoverStaleWorkerLeases } from "@/server/worker-recovery";

const recovery = await recoverStaleWorkerLeases();
const before = await syncHqOrchestrationRuntime();
const summary = await processNextAutonomousTask();
const after = await syncHqOrchestrationRuntime();
logInfo("autonomous agent worker completed", {
  status: summary.status,
  reason: summary.reason ?? "none",
  taskId: summary.taskId ?? "none",
  agentSlug: summary.agentSlug ?? "none",
  reconciledBefore: before.reconciled,
  reconciledAfter: after.reconciled,
  recoveredStaleLeases: recovery.recovered
});
