import { describe, expect, it } from "vitest";
import { alphaReadOnlyDecision, enforceScopeBoundary, isSecretLikePath, scopeForProfile, xCdpBoundaryDecision } from "./scope-boundary";

describe("scope boundary enforcement", () => {
  it("maps profiles to mechanical scopes", () => {
    expect(scopeForProfile("company")).toBe("company");
    expect(scopeForProfile("auth-manager")).toBe("auth");
    expect(scopeForProfile("crypto-signal")).toBe("crypto");
    expect(scopeForProfile("alpha-terminal")).toBe("alpha");
  });

  it("blocks secret-like paths regardless of scope", () => {
    expect(isSecretLikePath(".env.local")).toBe(true);
    expect(isSecretLikePath("browser storage/Local Storage")).toBe(true);
    expect(enforceScopeBoundary({ actorScope: "company", targetScope: "company", operation: "read", pathOrName: ".env" })).toMatchObject({ allowed: false, reason: "secret_like_path_blocked" });
  });

  it("denies cross-scope Company/Auth/Crypto/Alpha access", () => {
    expect(enforceScopeBoundary({ actorScope: "company", targetScope: "crypto", operation: "read" })).toMatchObject({ allowed: false, reason: "cross_scope_denied:company->crypto" });
    expect(enforceScopeBoundary({ actorScope: "auth", targetScope: "company", operation: "write" })).toMatchObject({ allowed: false, reason: "cross_scope_denied:auth->company" });
  });

  it("keeps Alpha terminal read-only", () => {
    expect(alphaReadOnlyDecision({ operation: "read health" })).toMatchObject({ allowed: true });
    expect(alphaReadOnlyDecision({ operation: "deploy backend" })).toMatchObject({ allowed: false, reason: "alpha_read_only_boundary" });
  });

  it("keeps X-CDP public-only and blocks account/browser storage", () => {
    expect(xCdpBoundaryDecision({ operation: "collect public timeline", requiresAccountSession: false })).toMatchObject({ allowed: true });
    expect(xCdpBoundaryDecision({ operation: "collect account feed", requiresAccountSession: true })).toMatchObject({ allowed: false, reason: "x_cdp_account_session_blocked" });
    expect(xCdpBoundaryDecision({ operation: "read", pathOrName: "Default/Cookies" })).toMatchObject({ allowed: false });
  });
});
