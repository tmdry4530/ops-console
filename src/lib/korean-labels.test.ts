import { describe, expect, it } from "vitest";
import {
  formatDateTimeKo,
  labelForApprovalType,
  labelForEventMessage,
  labelForHealth,
  labelForRisk,
  labelForRouteSegment,
  labelForStatus
} from "./korean-labels";

describe("korean-friendly labels", () => {
  it("renders operator-facing agent statuses in Korean", () => {
    expect(labelForStatus("running")).toBe("실행 중");
    expect(labelForStatus("active")).toBe("진행 중");
    expect(labelForStatus("project")).toBe("프로젝트");
    expect(labelForStatus("manual outreach")).toBe("수동 아웃리치");
    expect(labelForStatus("waiting_approval")).toBe("승인 대기");
    expect(labelForStatus("queued")).toBe("큐 대기");
    expect(labelForStatus("executing")).toBe("실행 중");
    expect(labelForStatus("waiting_manual_handoff")).toBe("수동 처리 대기");
    expect(labelForStatus("blocked")).toBe("차단됨");
    expect(labelForStatus("custom_state")).toBe("custom state");
  });

  it("renders health states in Korean", () => {
    expect(labelForHealth("ok")).toBe("정상");
    expect(labelForHealth("degraded")).toBe("주의");
    expect(labelForHealth("failing")).toBe("장애");
  });

  it("renders risk, approval types, and route segments in Korean", () => {
    expect(labelForRisk("medium")).toBe("중간");
    expect(labelForRisk("critical")).toBe("긴급");
    expect(labelForApprovalType("bounty_submission")).toBe("바운티 제출");
    expect(labelForApprovalType("revenue_outreach")).toBe("매출 아웃리치");
    expect(labelForRouteSegment("dashboard")).toBe("대시보드");
    expect(labelForRouteSegment("events")).toBe("이벤트");
    expect(labelForEventMessage("Status ingested: ops/status/auth-manager.json")).toBe("상태 수집됨: ops/status/auth-manager.json");
    expect(labelForEventMessage("Command execution started: revenue_outreach")).toBe("명령 실행 시작: revenue_outreach");
    expect(labelForEventMessage("Command execution completed: revenue_outreach")).toBe("명령 실행 완료: revenue_outreach");
    expect(labelForEventMessage("Approval accepted: Approve revenue manual outreach")).toBe("승인됨: Approve revenue manual outreach");
    expect(labelForEventMessage("Manual submission recorded: 2222222")).toBe("외부 제출 기록됨: 2222222");
  });

  it("formats timestamps for Korean operators", () => {
    expect(formatDateTimeKo(new Date("2026-05-05T16:03:06.553Z"))).toMatch(/2026/);
    expect(formatDateTimeKo(null)).toBe("보고 없음");
  });
});
