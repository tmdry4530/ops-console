import { afterEach, describe, expect, it } from "vitest";
import { determineApprovalOutcome } from "./approvals";

const originalExternalSendEnabled = process.env.OPS_AGENT_EXTERNAL_SEND_ENABLED;

afterEach(() => {
  if (originalExternalSendEnabled === undefined) {
    delete process.env.OPS_AGENT_EXTERNAL_SEND_ENABLED;
  } else {
    process.env.OPS_AGENT_EXTERNAL_SEND_ENABLED = originalExternalSendEnabled;
  }
});

describe("determineApprovalOutcome", () => {
  it("forces external submissions and revenue outreach into manual handoff when external-send is disabled", () => {
    process.env.OPS_AGENT_EXTERNAL_SEND_ENABLED = "false";

    expect(determineApprovalOutcome("immunefi_submit", "medium")).toBe("manual_handoff");
    expect(determineApprovalOutcome("revenue_outreach", "medium")).toBe("manual_handoff");
  });

  it("allows revenue outreach to queue only when agent external-send is explicitly enabled", () => {
    process.env.OPS_AGENT_EXTERNAL_SEND_ENABLED = "true";

    expect(determineApprovalOutcome("revenue_outreach", "medium")).toBe("approved_waiting_execution");
  });

  it("allows low-risk internal actions to queue", () => {
    expect(determineApprovalOutcome("internal_sync", "low")).toBe("approved_waiting_execution");
  });
});
