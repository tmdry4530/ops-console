import { describe, expect, it } from "vitest";
import { buildDiscordReportPrompt, isSendableDiscordReport } from "./discord-outbox";

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

  it("builds a Hermes prompt that asks for actual Discord delivery", () => {
    const prompt = buildDiscordReportPrompt(event);
    expect(prompt).toContain("실제 Discord research 채널로 전송");
    expect(prompt).toContain("상태: 완료");
    expect(prompt).toContain("event_1");
  });
});
