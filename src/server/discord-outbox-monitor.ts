import { db } from "@/lib/db";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function discordReportStatus(metadata: unknown): "delivered" | "dead_letter" | "retry_pending" | "queued" {
  if (!isRecord(metadata)) return "queued";
  if (metadata.deliveredAt) return "delivered";
  if (metadata.deliveryStatus === "dead_letter") return "dead_letter";
  if (metadata.deliveryStatus === "retry_pending" || metadata.deliveryFailedAt) return "retry_pending";
  return "queued";
}

export async function getDiscordOutboxSummary() {
  const reports = await db.event.findMany({ where: { type: "discord.report.queued" }, orderBy: { createdAt: "desc" }, take: 100 });
  const items = reports.map((event) => ({ event, status: discordReportStatus(event.metadata) }));
  return {
    items,
    totals: {
      queued: items.filter((item) => item.status === "queued").length,
      retryPending: items.filter((item) => item.status === "retry_pending").length,
      deadLetter: items.filter((item) => item.status === "dead_letter").length,
      delivered: items.filter((item) => item.status === "delivered").length
    }
  };
}
