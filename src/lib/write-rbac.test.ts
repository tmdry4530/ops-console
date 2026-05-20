import { describe, expect, it } from "vitest";
import { isRoleAllowed } from "./write-rbac";

describe("write RBAC", () => {
  it("requires approver for approval decisions", () => {
    expect(isRoleAllowed("operator", "approval:decide")).toBe(false);
    expect(isRoleAllowed("approver", "approval:decide")).toBe(true);
  });

  it("requires admin for harness management", () => {
    expect(isRoleAllowed("approver", "harness:manage")).toBe(false);
    expect(isRoleAllowed("admin", "harness:manage")).toBe(true);
  });
});
