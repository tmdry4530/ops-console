import type { HarnessCheckResult, HarnessPreflightInput } from "./types";
const SECRET_PATTERNS = [/secret/i, /token/i, /cookie/i, /browser storage/i, /DATABASE_URL/i, /db url/i, /private key/i];
export function checkPolicy(input: HarnessPreflightInput): HarnessCheckResult {
  const text = `${input.title}
${input.summary ?? ""}`;
  if (SECRET_PATTERNS.some((pattern) => pattern.test(text))) return { ok: false, reason: "secret_like_context_requested", failureClass: "POLICY_VIOLATION" };
  return { ok: true, reason: "policy_allowed" };
}
