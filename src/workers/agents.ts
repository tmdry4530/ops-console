import { logInfo } from "@/lib/logger";
import { processNextAutonomousTask } from "@/server/agent-autonomy";
import { syncHqOrchestrationRuntime } from "@/server/ops-monitor";
import { recoverStaleWorkerLeases } from "@/server/worker-recovery";

const maxIterations = Math.max(1, Number(process.env.AGENT_WORKER_MAX_ITERATIONS ?? "5"));
const recovery = await recoverStaleWorkerLeases();
const before = await syncHqOrchestrationRuntime();
const results = [];
for (let i = 0; i < maxIterations; i += 1) {
  const summary = await processNextAutonomousTask();
  results.push(summary);
  if (summary.status === "skipped" && summary.reason === "no_queued_task") break;
}
const after = await syncHqOrchestrationRuntime();
logInfo("autonomous agent worker loop completed", {
  iterations: results.length,
  statuses: results.map((item) => item.status).join(","),
  taskIds: results.map((item) => item.taskId ?? "none").join(","),
  agentSlugs: results.map((item) => item.agentSlug ?? "none").join(","),
  reconciledBefore: before.reconciled,
  reconciledAfter: after.reconciled,
  recoveredStaleLeases: recovery.recovered
});
