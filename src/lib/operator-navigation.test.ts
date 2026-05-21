import { describe, expect, it } from "vitest";
import { operatorNavigationItems, retiredOperatorRoutes } from "./operator-navigation";

describe("operator navigation", () => {
  it("keeps only the canonical operator surfaces in the sidebar", () => {
    expect(operatorNavigationItems.map((item) => item.href)).toEqual(["/control", "/projects"]);
  });

  it("records removed standalone routes with Control replacements", () => {
    expect(retiredOperatorRoutes.map((route) => route.href)).toEqual([
      "/agents",
      "/approvals",
      "/events",
      "/artifacts",
      "/dashboard",
      "/reports",
      "/settings",
      "/policies"
    ]);
    expect(retiredOperatorRoutes.every((route) => route.replacement === "/control")).toBe(true);
  });
});
