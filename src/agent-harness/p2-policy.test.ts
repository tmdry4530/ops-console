import { describe, expect, it } from "vitest";
import { classifyQualityBand, feedbackActionForFailure, rollbackDecision, weeklyRegressionRunSlug } from "./p2-policy";

describe("agent harness P2 policy", () => {
  it("classifies quality bands for dashboard", () => {
    expect(classifyQualityBand({ score: 0.97, passRate: 1, failureCount: 0 })).toBe("excellent");
    expect(classifyQualityBand({ score: 0.88, passRate: 0.92, failureCount: 1 })).toBe("healthy");
    expect(classifyQualityBand({ score: 0.74, passRate: 0.8, failureCount: 2 })).toBe("watch");
    expect(classifyQualityBand({ score: 0.5, passRate: 0.5, failureCount: 6 })).toBe("regression");
  });

  it("requires rollback only for real regressions against a previous active version", () => {
    expect(rollbackDecision({ currentVersion: "2026.05.20", previousVersion: "2026.05.19", qualityBand: "regression" })).toEqual({ required: true, targetVersion: "2026.05.19" });
    expect(rollbackDecision({ currentVersion: "2026.05.20", previousVersion: null, qualityBand: "regression" })).toEqual({ required: false, targetVersion: null });
    expect(rollbackDecision({ currentVersion: "2026.05.20", previousVersion: "2026.05.19", qualityBand: "healthy" })).toEqual({ required: false, targetVersion: null });
  });

  it("routes every failure into exactly one feedback action", () => {
    expect(feedbackActionForFailure("BAD_OUTPUT_SCHEMA")).toBe("eval_case");
    expect(feedbackActionForFailure("MISSING_REQUIRED_SOURCE")).toBe("spec_patch");
    expect(feedbackActionForFailure("TOOL_PERMISSION_OVERREACH")).toBe("skill_candidate");
    expect(feedbackActionForFailure("REPEATED_CONTEXT_GAP")).toBe("memory_candidate");
  });

  it("generates stable weekly regression run slugs", () => {
    expect(weeklyRegressionRunSlug(new Date("2026-05-20T05:00:00Z"))).toBe("agent-harness-weekly-regression-2026-W21");
  });
});
