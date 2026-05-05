import { describe, expect, it } from "vitest";
import { formatDateTimeKo, labelForHealth, labelForStatus } from "./korean-labels";

describe("korean-friendly labels", () => {
  it("renders operator-facing agent statuses in Korean", () => {
    expect(labelForStatus("running")).toBe("실행 중");
    expect(labelForStatus("waiting_approval")).toBe("승인 대기");
    expect(labelForStatus("blocked")).toBe("차단됨");
    expect(labelForStatus("custom_state")).toBe("custom state");
  });

  it("renders health states in Korean", () => {
    expect(labelForHealth("ok")).toBe("정상");
    expect(labelForHealth("degraded")).toBe("주의");
    expect(labelForHealth("failing")).toBe("장애");
  });

  it("formats timestamps for Korean operators", () => {
    expect(formatDateTimeKo(new Date("2026-05-05T16:03:06.553Z"))).toMatch(/2026/);
    expect(formatDateTimeKo(null)).toBe("보고 없음");
  });
});
