import { logInfo } from "@/lib/logger";
import { processNextQueuedCommand } from "@/server/command-executor";

const summary = await processNextQueuedCommand();
logInfo("command worker completed", { status: summary.status, reason: summary.reason ?? "none" });
