import { describe, expect, it } from "vitest";
import { operatorNavigationItems, retiredOperatorRoutes } from "./operator-navigation";

describe("operator navigation", () => {
  it("keeps only live, useful Company control-plane menus", () => {
    const hrefs = operatorNavigationItems.map((item) => item.href);

    expect(hrefs).toEqual(["/control", "/agents", "/approvals", "/projects", "/artifacts", "/events"]);
    expect(hrefs).not.toContain("/dashboard");
    expect(hrefs).not.toContain("/reports");
    expect(hrefs).not.toContain("/settings");
    expect(hrefs).not.toContain("/policies");
  });

  it("documents removed legacy/menu routes instead of leaving them in the sidebar", () => {
    expect(retiredOperatorRoutes).toEqual(expect.arrayContaining([
      expect.objectContaining({ href: "/dashboard", replacement: "/control" }),
      expect.objectContaining({ href: "/reports", replacement: "/events" }),
      expect.objectContaining({ href: "/settings", replacement: "/control" }),
      expect.objectContaining({ href: "/policies", replacement: "/control" })
    ]));
  });
});
