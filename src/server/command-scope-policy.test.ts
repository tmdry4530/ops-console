import { describe, expect, it } from "vitest";
import { commandScopeDecision } from "./command-scope-policy";

describe("command scope policy", () => {
  it("allows same-scope low-risk company commands", () => {
    expect(commandScopeDecision({ actionType: "internal_sync", riskLevel: "low", systemScope: "company", payload: { targetScope: "company" } })).toEqual({ allowed: true, reason: "scope_allowed" });
  });

  it("blocks company commands targeting auth scope", () => {
    expect(commandScopeDecision({ actionType: "internal_sync", riskLevel: "low", systemScope: "company", payload: { targetScope: "auth" } })).toEqual({ allowed: false, reason: "cross_scope_denied:company->auth" });
  });

  it("blocks secret-like paths even in same scope", () => {
    expect(commandScopeDecision({ actionType: "repo_read", riskLevel: "low", systemScope: "company", payload: { targetScope: "company", path: "/Users/domclaw/ops-console/.env" } })).toEqual({ allowed: false, reason: "secret_like_path_blocked" });
  });

  it("blocks critical commands until manual boundary approval", () => {
    expect(commandScopeDecision({ actionType: "deploy", riskLevel: "critical", systemScope: "infra", payload: { targetScope: "infra" } })).toEqual({ allowed: false, reason: "critical_requires_manual_boundary_approval" });
  });
});
