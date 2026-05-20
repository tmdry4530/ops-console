import { validateOutput } from "./validateOutput";
import type { HarnessCheckResult } from "./types";

function semanticAgentCheck(agentSlug: string, output: Record<string, unknown>): HarnessCheckResult | null {
  if (agentSlug === "dev-agent") {
    const tests = Array.isArray(output.tests) ? output.tests as Array<Record<string, unknown>> : [];
    if (tests.length === 0 || tests.some((t) => t.status === "skipped" && !t.reasonIfSkipped)) return { ok: false, reason: "dev_requires_test_or_skip_reason", failureClass: "NO_TEST" };
  }
  if (agentSlug === "research-agent") {
    const claims = Array.isArray(output.claims) ? output.claims as Array<Record<string, unknown>> : [];
    if (claims.some((claim) => !Array.isArray(claim.evidence) || claim.evidence.length === 0)) return { ok: false, reason: "research_claim_without_evidence", failureClass: "NO_EVIDENCE" };
  }
  if (agentSlug === "docs-agent" && output.rawChatLog === true) return { ok: false, reason: "raw_chat_log_not_durable_doc", failureClass: "POLICY_VIOLATION" };
  if (agentSlug === "content-agent" && output.factualityStatus !== "passed") return { ok: false, reason: "content_factuality_not_passed", failureClass: "NO_EVIDENCE" };
  if (agentSlug === "design-agent" && !output.feHandoffPath) return { ok: false, reason: "design_requires_fe_handoff", failureClass: "NO_ARTIFACT" };
  return null;
}

export async function runVerifier(agentSlug: string, output: Record<string, unknown>): Promise<HarnessCheckResult> {
  const semantic = semanticAgentCheck(agentSlug, output);
  if (semantic) return semantic;
  const schema = await validateOutput(agentSlug, output);
  if (!schema.ok) return schema;
  return { ok: true, reason: "verifier_passed" };
}
