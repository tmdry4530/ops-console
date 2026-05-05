import { describe, expect, it } from "vitest";
import { scanForSecretLikeContent } from "./secrets";

describe("scanForSecretLikeContent", () => {
  it("restricts private-key-like content", () => {
    const result = scanForSecretLikeContent("-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----");
    expect(result.restricted).toBe(true);
  });

  it("allows normal artifact references", () => {
    const result = scanForSecretLikeContent("Report path: trading/reports/sample.md commit 9fba2ad");
    expect(result.restricted).toBe(false);
  });
});
