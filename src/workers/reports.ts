import { logInfo } from "@/lib/logger";
import { processNextDiscordReport } from "@/server/discord-outbox";

const summary = await processNextDiscordReport();
logInfo("discord report worker completed", {
  status: summary.status,
  reason: summary.reason ?? "none",
  eventId: summary.eventId ?? "none"
});
