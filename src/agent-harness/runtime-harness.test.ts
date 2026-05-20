import { describe, expect, it } from "vitest";
import { validateAgainstSchema } from "./validateOutput";
import { runVerifier } from "./runVerifier";

describe("runtime harness kernel", () => {
  it("blocks outputs missing required schema keys", () => {
    const result = validateAgainstSchema({ decision: "approve" }, { required: ["decision", "riskLevel"], properties: { decision: {}, riskLevel: {} }, additionalProperties: false });
    expect(result).toMatchObject({ ok: false, failureClass: "BAD_OUTPUT_SCHEMA" });
  });

  it("requires dev-agent tests before verifier pass", async () => {
    const result = await runVerifier("dev-agent", { repo: "ops-console", branch: "b", changedFiles: [], diffSummary: "x", tests: [], verification: "passed", remainingRisk: [], rollbackPlan: "revert" });
    expect(result).toMatchObject({ ok: false, failureClass: "NO_TEST" });
  });

  it("requires research claims to cite evidence", async () => {
    const result = await runVerifier("research-agent", { question: "q", sources: [{ title: "s", urlOrPath: "p", sourceType: "official", relevance: 1, credibility: 1 }], claims: [{ claim: "c", status: "supported", evidence: [], confidence: 0.5 }], gaps: [], recommendation: "r" });
    expect(result).toMatchObject({ ok: false, failureClass: "NO_EVIDENCE" });
  });
});
