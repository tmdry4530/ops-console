import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { db } from "@/lib/db";

const execFileAsync = promisify(execFile);

type DiscordEvent = {
  id: string;
  type: string;
  message: string;
  metadata: unknown;
};

function metadataRecord(metadata: unknown): Record<string, unknown> | null {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata as Record<string, unknown> : null;
}

export function isSendableDiscordReport(event: DiscordEvent): boolean {
  if (event.type !== "discord.report.queued") return false;
  const metadata = metadataRecord(event.metadata);
  if (!metadata) return false;
  if (typeof metadata.deliveredAt === "string") return false;
  return typeof metadata.channel === "string" && metadata.channel.length > 0 && typeof metadata.message === "string" && metadata.message.length > 0;
}

export function buildDiscordReportPrompt(event: DiscordEvent): string {
  const metadata = metadataRecord(event.metadata) ?? {};
  const channel = String(metadata.channel ?? "hq");
  const message = String(metadata.message ?? event.message);
  return [
    "너는 Company Discord 보고 브릿지다.",
    `Ops Console Event ID: ${event.id}`,
    `아래 메시지를 실제 Discord ${channel} 채널로 전송해라.`,
    "메시지는 그대로 보내되, secret/token/env 값은 포함하지 마라.",
    "",
    message
  ].join("\n");
}

export type DiscordReportResult = {
  status: "completed" | "failed" | "skipped";
  reason?: string;
  eventId?: string;
};

async function sendViaHermes(event: DiscordEvent): Promise<{ status: "completed" | "failed"; stdout: string; stderr: string }> {
  const hermes = process.env.OPS_AGENT_HERMES_CLI ?? "/Users/domclaw/.hermes/hermes-agent/venv/bin/hermes";
  const companyRoot = process.env.COMPANY_DATA_ROOT ?? "/Users/domclaw/dom-company";
  const timeout = Number(process.env.OPS_DISCORD_OUTBOX_TIMEOUT_MS ?? 180000);
  try {
    const { stdout, stderr } = await execFileAsync(hermes, ["--profile", "company", "chat", "-q", buildDiscordReportPrompt(event)], {
      cwd: companyRoot,
      timeout,
      maxBuffer: 1024 * 1024
    });
    return { status: "completed", stdout, stderr };
  } catch (error) {
    const err = error as { stdout?: string | Buffer; stderr?: string | Buffer; message?: string };
    return { status: "failed", stdout: String(err.stdout ?? ""), stderr: String(err.stderr ?? err.message ?? "discord_delivery_failed") };
  }
}

export async function processNextDiscordReport(): Promise<DiscordReportResult> {
  if (process.env.OPS_DISCORD_OUTBOX_ENABLED !== "true") return { status: "skipped", reason: "disabled" };
  const candidates = await db.event.findMany({ where: { type: "discord.report.queued" }, orderBy: { createdAt: "asc" }, take: 25, select: { id: true, type: true, message: true, metadata: true } });
  const event = candidates.find(isSendableDiscordReport);
  if (!event) return { status: "skipped", reason: "no_sendable_reports" };

  const result = await sendViaHermes(event);
  const metadata = metadataRecord(event.metadata) ?? {};
  if (result.status === "completed") {
    await db.event.update({ where: { id: event.id }, data: { metadata: { ...metadata, deliveredAt: new Date().toISOString(), deliveryMode: "hermes_company_discord_bridge" } } });
    await db.event.create({ data: { type: "discord.report.delivered", severity: "info", message: `Discord report delivered: ${String(metadata.channel ?? "hq")}`, metadata: { sourceEventId: event.id } } });
    return { status: "completed", eventId: event.id };
  }

  await db.event.update({ where: { id: event.id }, data: { metadata: { ...metadata, deliveryFailedAt: new Date().toISOString(), deliveryError: result.stderr.slice(0, 500) } } });
  await db.event.create({ data: { type: "discord.report.delivery_failed", severity: "warning", message: `Discord report delivery failed: ${String(metadata.channel ?? "hq")}`, metadata: { sourceEventId: event.id } } });
  return { status: "failed", reason: "delivery_failed", eventId: event.id };
}
