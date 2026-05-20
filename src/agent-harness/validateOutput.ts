import { loadOutputSchema } from "./loadAgentHarness";
import type { HarnessCheckResult } from "./types";

type Schema = { required?: string[]; properties?: Record<string, unknown>; additionalProperties?: boolean };
function hasValue(value: unknown): boolean { return value !== undefined && value !== null && value !== ""; }
export function validateAgainstSchema(output: Record<string, unknown>, schema: Schema): HarnessCheckResult {
  for (const key of schema.required ?? []) {
    if (!hasValue(output[key])) return { ok: false, reason: `missing_required:${key}`, failureClass: "BAD_OUTPUT_SCHEMA" };
  }
  if (schema.additionalProperties === false && schema.properties) {
    for (const key of Object.keys(output)) {
      if (!(key in schema.properties)) return { ok: false, reason: `unexpected_property:${key}`, failureClass: "BAD_OUTPUT_SCHEMA" };
    }
  }
  return { ok: true, reason: "schema_valid" };
}
export async function validateOutput(agentSlug: string, output: Record<string, unknown>): Promise<HarnessCheckResult> {
  const schema = await loadOutputSchema(agentSlug) as Schema;
  return validateAgainstSchema(output, schema);
}
