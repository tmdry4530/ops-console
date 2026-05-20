import type { HarnessCheckResult } from "./types";
export function scoreResult(checks: HarnessCheckResult[]): { score: number; pass: boolean; failureClass?: string } {
  const failed = checks.find((check) => !check.ok) as Extract<HarnessCheckResult, { ok: false }> | undefined;
  if (failed) return { score: 0, pass: false, failureClass: failed.failureClass };
  return { score: 1, pass: true };
}
