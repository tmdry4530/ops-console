import { describe, expect, it } from "vitest";
import { buildDiscordReportPrompt, deadLetterMetadata, discordReportCutoffDate, isDeadLetterDiscordReport, isSendableDiscordReport } from "./discord-outbox";

const event = {
  id: "event_1",
  type: "discord.report.queued",
  message: "Discord result report queued: research-agent",
  metadata: {
    channel: "research",
    message: "상태: 완료\n작업: 레퍼런스 조사",
    purpose: "result_report"
  }
};

describe("discord report outbox", () => {
  it("sends only queued reports that have channel/message and no deliveredAt", () => {
    expect(isSendableDiscordReport(event)).toBe(true);
    expect(isSendableDiscordReport({ ...event, metadata: { ...event.metadata, deliveredAt: "2026-05-07T00:00:00.000Z" } })).toBe(false);
    expect(isSendableDiscordReport({ ...event, metadata: { channel: "research" } })).toBe(false);
  });

  it("dead-letters reports after repeated delivery failures", () => {
    const dead = deadLetterMetadata({ ...event.metadata, deliveryAttempts: 3 }, "network timeout", new Date("2026-05-07T00:00:00.000Z"));
    expect(dead).toMatchObject({ deliveryStatus: "dead_letter", deliveryAttempts: 3, deliveryError: "network timeout" });
    expect(isDeadLetterDiscordReport({ ...event, metadata: dead })).toBe(true);
    expect(isSendableDiscordReport({ ...event, metadata: dead })).toBe(false);
  });

  it("uses a recent cutoff so stale delivered backlog cannot starve fresh reports", () => {
    expect(discordReportCutoffDate(new Date("2026-05-08T07:00:00.000Z"), 30).toISOString()).toBe("2026-05-08T06:30:00.000Z");
  });
});
