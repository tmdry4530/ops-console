export const COMMON_FAILURE_CLASSES = ["ROUTING_ERROR","RISK_MISCLASSIFICATION","TOOL_NOT_ALLOWED","POLICY_VIOLATION","APPROVAL_BYPASS","MISSING_CONTEXT","BAD_INPUT_SCHEMA","BAD_OUTPUT_SCHEMA","NO_EVIDENCE","NO_TEST","NO_ARTIFACT","HALLUCINATED_SOURCE","UNRELATED_DIFF","SCOPE_VIOLATION","MEMORY_POLLUTION","COST_OVER_BUDGET","LATENCY_OVER_BUDGET","VERIFIER_FAILED","VERIFIER_INCONCLUSIVE","STALE_CONTEXT","DUPLICATE_WORK"] as const;
export function classifyFailure(reason?: string): string {
  if (!reason) return "VERIFIER_INCONCLUSIVE";
  if (reason.includes("tool_not_allowed")) return "TOOL_NOT_ALLOWED";
  if (reason.includes("scope")) return "SCOPE_VIOLATION";
  if (reason.includes("schema")) return "BAD_OUTPUT_SCHEMA";
  if (reason.includes("approval")) return "APPROVAL_BYPASS";
  if (reason.includes("evidence")) return "NO_EVIDENCE";
  if (reason.includes("test")) return "NO_TEST";
  return "POLICY_VIOLATION";
}
