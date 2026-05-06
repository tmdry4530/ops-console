import { logInfo } from "@/lib/logger";
import { processNextAutonomousTask } from "@/server/agent-autonomy";

const summary = await processNextAutonomousTask();
logInfo("autonomous agent worker completed", {
  status: summary.status,
  reason: summary.reason ?? "none",
  taskId: summary.taskId ?? "none",
  agentSlug: summary.agentSlug ?? "none"
});
