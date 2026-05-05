import { describe, expect, it } from "vitest";
import { determineApprovalOutcome } from "./approvals";

describe("determineApprovalOutcome", () => {
  it("forces Immunefi submissions into manual handoff", () => {
    expect(determineApprovalOutcome("immunefi_submit", "medium")).toBe("manual_handoff");
  });

  it("allows low-risk internal actions to queue", () => {
    expect(determineApprovalOutcome("internal_sync", "low")).toBe("approved_waiting_execution");
  });
});
