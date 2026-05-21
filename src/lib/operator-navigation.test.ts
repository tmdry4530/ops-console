import { describe, expect, it } from "vitest";
import { operatorNavigationItems, retiredOperatorRoutes } from "./operator-navigation";

describe("operator navigation", () => {
  it("uses four workflow-mode operator surfaces", () => {
    expect(operatorNavigationItems.map((item) => item.href)).toEqual(["/control", "/projects", "/decisions", "/observe"]);
    expect(operatorNavigationItems.map((item) => item.mode)).toEqual(["control", "operations", "decision", "observe"]);
  });

  it("keeps forbidden CRUD routes retired with workflow replacements", () => {
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
    expect(Object.fromEntries(retiredOperatorRoutes.map((route) => [route.href, route.replacement]))).toEqual({
      "/agents": "/observe/agents",
      "/approvals": "/decisions",
      "/events": "/observe",
      "/artifacts": "/projects",
      "/dashboard": "/observe",
      "/reports": "/projects",
      "/settings": "/control",
      "/policies": "/control"
    });
  });
});
