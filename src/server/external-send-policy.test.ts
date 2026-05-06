import { describe, expect, it } from "vitest";
import { evaluateExternalSendPermission } from "./external-send-policy";

describe("evaluateExternalSendPermission", () => {
  it("blocks revenue outreach sends when the agent external-send kill switch is off", () => {
    const decision = evaluateExternalSendPermission({
      actionType: "revenue_outreach",
      riskLevel: "medium",
      payload: {
        externalSendAuthorized: true,
        channel: "email",
        recipientBatchId: "agroup-20260506",
        draftArtifactId: "artifact_1",
        idempotencyKey: "send-agroup-20260506"
      },
      env: { OPS_AGENT_EXTERNAL_SEND_ENABLED: "false" }
    });

    expect(decision).toMatchObject({ allowed: false, reason: "external_send_disabled" });
  });

  it("requires a complete send plan before an agent may send externally", () => {
    const decision = evaluateExternalSendPermission({
      actionType: "revenue_outreach",
      riskLevel: "medium",
      payload: { externalSendAuthorized: true, channel: "email" },
      env: { OPS_AGENT_EXTERNAL_SEND_ENABLED: "true" }
    });

    expect(decision).toMatchObject({ allowed: false, reason: "external_send_plan_required" });
  });

  it("allows dry-run external sends with a complete plan", () => {
    const decision = evaluateExternalSendPermission({
      actionType: "revenue_outreach",
      riskLevel: "medium",
      payload: {
        externalSendAuthorized: true,
        channel: "email",
        recipientBatchId: "agroup-20260506",
        draftArtifactId: "artifact_1",
        idempotencyKey: "send-agroup-20260506"
      },
      env: { OPS_AGENT_EXTERNAL_SEND_ENABLED: "true", OPS_AGENT_EXTERNAL_SEND_MODE: "dry_run" }
    });

    expect(decision).toMatchObject({
      allowed: true,
      mode: "dry_run",
      channel: "email",
      recipientBatchId: "agroup-20260506",
      idempotencyKey: "send-agroup-20260506"
    });
  });

  it("blocks high-risk external sends even when enabled", () => {
    const decision = evaluateExternalSendPermission({
      actionType: "revenue_outreach",
      riskLevel: "high",
      payload: {
        externalSendAuthorized: true,
        channel: "email",
        recipientBatchId: "agroup-20260506",
        draftArtifactId: "artifact_1",
        idempotencyKey: "send-agroup-20260506"
      },
      env: { OPS_AGENT_EXTERNAL_SEND_ENABLED: "true", OPS_AGENT_EXTERNAL_SEND_MODE: "dry_run" }
    });

    expect(decision).toMatchObject({ allowed: false, reason: "risk_too_high" });
  });
});
