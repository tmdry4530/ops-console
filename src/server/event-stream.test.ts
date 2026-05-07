import { describe, expect, it } from "vitest";
import { formatSseFrame, shouldPollEvents } from "./event-stream";

describe("event stream helpers", () => {
  it("formats named SSE frames", () => {
    expect(formatSseFrame("snapshot", { ok: true })).toBe('event: snapshot\ndata: {"ok":true}\n\n');
  });

  it("keeps realtime event streams open with polling", () => {
    expect(shouldPollEvents(0)).toBe(true);
    expect(shouldPollEvents(30)).toBe(false);
  });
});
