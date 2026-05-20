export type QualityBand = "excellent" | "healthy" | "watch" | "regression";
export type FeedbackAction = "spec_patch" | "skill_candidate" | "memory_candidate" | "eval_case";

export function classifyQualityBand(input: { score: number | null; passRate: number | null; failureCount: number }): QualityBand {
  const score = input.score ?? 0;
  const passRate = input.passRate ?? 0;
  if (input.failureCount >= 5 || score < 0.7 || passRate < 0.75) return "regression";
  if (input.failureCount >= 2 || score < 0.82 || passRate < 0.88) return "watch";
  if (score >= 0.95 && passRate >= 0.98 && input.failureCount === 0) return "excellent";
  return "healthy";
}

export function rollbackDecision(input: { currentVersion: string; previousVersion: string | null; qualityBand: QualityBand }): { required: boolean; targetVersion: string | null } {
  if (input.qualityBand === "regression" && input.previousVersion && input.previousVersion !== input.currentVersion) {
    return { required: true, targetVersion: input.previousVersion };
  }
  return { required: false, targetVersion: null };
}

export function feedbackActionForFailure(failureClass: string): FeedbackAction {
  if (["BAD_OUTPUT_SCHEMA", "VERIFIER_FAILED", "LOW_QUALITY_OUTPUT"].includes(failureClass)) return "eval_case";
  if (["TOOL_PERMISSION_OVERREACH", "CAPABILITY_MISSING", "UNSUPPORTED_TOOL"].includes(failureClass)) return "skill_candidate";
  if (["REPEATED_CONTEXT_GAP", "STALE_MEMORY", "MISSING_STABLE_CONTEXT"].includes(failureClass)) return "memory_candidate";
  return "spec_patch";
}

function isoWeek(date: Date): { year: number; week: number } {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const year = utc.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year, week };
}

export function weeklyRegressionRunSlug(now = new Date()): string {
  const { year, week } = isoWeek(now);
  return `agent-harness-weekly-regression-${year}-W${String(week).padStart(2, "0")}`;
}
