import { describe, expect, it } from "vitest";
import { validateAgainstSchema } from "./validateOutput";

describe("JSON Schema harness validation", () => {
  const schema = {
    type: "object",
    required: ["status", "evidence"],
    properties: {
      status: { enum: ["completed", "blocked"] },
      evidence: { type: "array", minItems: 1, items: { type: "string" } }
    },
    additionalProperties: false
  };

  it("accepts schema-valid output", () => {
    expect(validateAgainstSchema({ status: "completed", evidence: ["artifact:1"] }, schema)).toMatchObject({ ok: true, reason: "json_schema_valid" });
  });

  it("rejects enum/minItems/additionalProperties violations", () => {
    const result = validateAgainstSchema({ status: "done", evidence: [], extra: true }, schema);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("json_schema_invalid");
  });
});
