import { describe, expect, it } from "vitest";
import { operatorNavigationItems, retiredOperatorRoutes } from "./operator-navigation";

describe("operator navigation", () => {
  it("keeps only the currently working operator surfaces in the sidebar", () => {
    const hrefs = operatorNavigationItems.map((item) => item.href);

    expect(hrefs).toEqual(["/control", "/projects"]);
    expect(hrefs).not.toContain("/agents");
    expect(hrefs).not.toContain("/approvals");
    expect(hrefs).not.toContain("/events");
    expect(hrefs).not.toContain("/artifacts");
    expect(hrefs).not.toContain("/dashboard");
    expect(hrefs).not.toContain("/reports");
    expect(hrefs).not.toContain("/settings");
    expect(hrefs).not.toContain("/policies");
  });

  it("documents removed standalone menu routes and points operators back to Control", () => {
    expect(retiredOperatorRoutes).toEqual(expect.arrayContaining([
      expect.objectContaining({ href: "/agents", replacement: "/control" }),
      expect.objectContaining({ href: "/approvals", replacement: "/control" }),
      expect.objectContaining({ href: "/events", replacement: "/control" }),
      expect.objectContaining({ href: "/artifacts", replacement: "/control" }),
      expect.objectContaining({ href: "/dashboard", replacement: "/control" }),
      expect.objectContaining({ href: "/reports", replacement: "/control" }),
      expect.objectContaining({ href: "/settings", replacement: "/control" }),
      expect.objectContaining({ href: "/policies", replacement: "/control" })
    ]));
  });
});
