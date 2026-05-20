import Ajv, { type ErrorObject } from "ajv";
import { loadOutputSchema } from "./loadAgentHarness";
import type { HarnessCheckResult } from "./types";

const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });

type JsonSchema = Record<string, unknown>;
function isSchema(value: unknown): value is JsonSchema { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function formatErrors(errors: ErrorObject[] | null | undefined) {
  return (errors ?? []).map((err) => `${err.instancePath || "/"} ${err.message ?? err.keyword}`).join("; ").slice(0, 500);
}

export function validateAgainstSchema(output: Record<string, unknown>, schema: unknown): HarnessCheckResult {
  if (!isSchema(schema)) return { ok: false, reason: "invalid_json_schema", failureClass: "BAD_OUTPUT_SCHEMA" };
  try {
    const validate = ajv.compile(schema);
    const ok = validate(output);
    if (!ok) return { ok: false, reason: `json_schema_invalid:${formatErrors(validate.errors)}`, failureClass: "BAD_OUTPUT_SCHEMA" };
    return { ok: true, reason: "json_schema_valid" };
  } catch (error) {
    return { ok: false, reason: `json_schema_compile_failed:${error instanceof Error ? error.message : "unknown"}`.slice(0, 500), failureClass: "BAD_OUTPUT_SCHEMA" };
  }
}

export async function validateOutput(agentSlug: string, output: Record<string, unknown>): Promise<HarnessCheckResult> {
  const schema = await loadOutputSchema(agentSlug);
  return validateAgainstSchema(output, schema);
}
