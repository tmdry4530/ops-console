import type { HarnessCheckResult, HarnessPreflightInput } from "./types";
export function validateInput(input: HarnessPreflightInput): HarnessCheckResult {
  if (!input.taskId || !input.title) return { ok: false, reason: "missing_task_identity", failureClass: "BAD_INPUT_SCHEMA" };
  return { ok: true, reason: "input_valid" };
}
