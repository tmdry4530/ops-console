import { logInfo } from "@/lib/logger";
import { processNextQueuedCommand } from "@/server/command-executor";

const maxIterations = Math.max(1, Number(process.env.COMMAND_WORKER_MAX_ITERATIONS ?? "5"));
const results = [];
for (let i = 0; i < maxIterations; i += 1) {
  const summary = await processNextQueuedCommand();
  results.push(summary);
  if (summary.reason === "no_queued_command") break;
}
logInfo("command worker loop completed", { iterations: results.length, statuses: results.map((item) => item.status).join(","), reasons: results.map((item) => item.reason ?? "none").join(",") });
