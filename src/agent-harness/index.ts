import { checkCapability } from "./checkCapability";
import { checkPolicy } from "./checkPolicy";
import { loadAgentHarness } from "./loadAgentHarness";
import { runVerifier } from "./runVerifier";
import { scoreResult } from "./scoreResult";
import { validateInput } from "./validateInput";
import type { HarnessPreflightInput, HarnessRunResult } from "./types";

export async function runHarnessPreflight(input: HarnessPreflightInput) {
  const harness = await loadAgentHarness(input.agentSlug);
  const checks = [validateInput(input), checkPolicy(input), await checkCapability(input)];
  const result = scoreResult(checks);
  return { ...result, agentSlug: input.agentSlug, harnessVersion: harness.harnessVersion, checks: checks.map((check) => check.reason ?? (check.ok ? "ok" : "failed")) };
}
export async function runHarnessCompletion(agentSlug: string, output: Record<string, unknown>): Promise<HarnessRunResult> {
  const harness = await loadAgentHarness(agentSlug);
  const checks = [await runVerifier(agentSlug, output)];
  const result = scoreResult(checks);
  return { ...result, agentSlug, harnessVersion: harness.harnessVersion, checks: checks.map((check) => check.reason ?? (check.ok ? "ok" : "failed")) };
}
export * from "./loadAgentHarness";
export * from "./types";
