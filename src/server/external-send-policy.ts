export type ExternalSendMode = "dry_run" | "live";
export type ExternalSendChannel = "email" | "kakao" | "instagram" | "line";

export type ExternalSendDecision =
  | {
      allowed: true;
      mode: ExternalSendMode;
      channel: ExternalSendChannel;
      recipientBatchId: string;
      draftArtifactId: string;
      idempotencyKey: string;
    }
  | { allowed: false; reason: string };

type EnvLike = Partial<Record<string, string | undefined>>;

type Input = {
  actionType: string;
  riskLevel: string;
  payload: unknown;
  env?: EnvLike;
};

const allowedChannels = new Set(["email", "kakao", "instagram", "line"]);

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function isAgentExternalSendEnabled(env: EnvLike = process.env): boolean {
  return env.OPS_AGENT_EXTERNAL_SEND_ENABLED === "true";
}

export function externalSendMode(env: EnvLike = process.env): ExternalSendMode {
  return env.OPS_AGENT_EXTERNAL_SEND_MODE === "live" ? "live" : "dry_run";
}

export function evaluateExternalSendPermission(input: Input): ExternalSendDecision {
  const env = input.env ?? process.env;
  if (input.actionType !== "revenue_outreach") {
    return { allowed: false, reason: "unsupported_action_type" };
  }
  if (!isAgentExternalSendEnabled(env)) {
    return { allowed: false, reason: "external_send_disabled" };
  }
  if (input.riskLevel === "high" || input.riskLevel === "critical") {
    return { allowed: false, reason: "risk_too_high" };
  }

  const payload = readRecord(input.payload);
  const channel = typeof payload.channel === "string" ? payload.channel : "";
  const recipientBatchId = typeof payload.recipientBatchId === "string" ? payload.recipientBatchId : "";
  const draftArtifactId = typeof payload.draftArtifactId === "string" ? payload.draftArtifactId : "";
  const idempotencyKey = typeof payload.idempotencyKey === "string" ? payload.idempotencyKey : "";

  if (payload.externalSendAuthorized !== true || !allowedChannels.has(channel) || !recipientBatchId || !draftArtifactId || !idempotencyKey) {
    return { allowed: false, reason: "external_send_plan_required" };
  }

  const mode = externalSendMode(env);
  if (mode === "live" && !env.OPS_AGENT_EXTERNAL_SEND_PROVIDER) {
    return { allowed: false, reason: "external_send_provider_not_configured" };
  }

  return {
    allowed: true,
    mode,
    channel: channel as ExternalSendChannel,
    recipientBatchId,
    draftArtifactId,
    idempotencyKey
  };
}
