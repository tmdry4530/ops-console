import { describe, expect, it } from "vitest";
import { buildLocalSystemMonitor, LOCAL_SYSTEM_CONTRACTS } from "./local-system-monitor";

describe("local system monitor", () => {
  it("tracks Company-native surfaces without Hermes Workspace", () => {
    const slugs = LOCAL_SYSTEM_CONTRACTS.map((system) => system.slug);

    expect(slugs).toContain("company-router");
    expect(slugs).toContain("ops-console");
    expect(slugs).toContain("developer-job-dashboard");
    expect(slugs).toContain("alpha-terminal");
    expect(slugs).toContain("auth-manager");
    expect(slugs).toContain("crypto-signal");
    expect(slugs).not.toContain("hermes-workspace");
    expect(slugs).not.toContain("workspace");
  });

  it("summarizes service health, risk gates, and operator actions for the control page", () => {
    const monitor = buildLocalSystemMonitor({
      now: new Date("2026-05-20T06:30:00.000Z"),
      checks: {
        "company-router": { state: "ok", latencyMs: 21 },
        "ops-console": { state: "ok", latencyMs: 43 },
        "developer-job-dashboard": { state: "ok", latencyMs: 31 },
        "alpha-terminal": { state: "degraded", latencyMs: 250, detail: "backend health slow" },
        "auth-manager": { state: "ok", latencyMs: 11 },
        "crypto-signal": { state: "unknown", detail: "collector is process-backed" }
      }
    });

    expect(monitor.summary.total).toBe(6);
    expect(monitor.summary.ok).toBe(4);
    expect(monitor.summary.degraded).toBe(1);
    expect(monitor.summary.unknown).toBe(1);
    expect(monitor.summary.workspaceRetired).toBe(true);
    expect(monitor.systems.find((system) => system.slug === "alpha-terminal")?.operatorAction).toMatch(/확인/);
    expect(monitor.systems.every((system) => system.referenceOnly !== true || system.slug !== "hermes-workspace")).toBe(true);
  });
});
