import { describe, expect, it } from "vitest";
import { isWorkAgent } from "./agent-visibility";

describe("agent visibility", () => {
  it("hides infrastructure gateway/proxy/app services from the work-agent console", () => {
    expect(isWorkAgent("company-gateway")).toBe(false);
    expect(isWorkAgent("auth-gateway")).toBe(false);
    expect(isWorkAgent("crypto-gateway")).toBe(false);
    expect(isWorkAgent("ops-console-app")).toBe(false);
    expect(isWorkAgent("ops-console-proxy")).toBe(false);
  });

  it("keeps actual work agents visible", () => {
    expect(isWorkAgent("crypto-signal")).toBe(true);
    expect(isWorkAgent("auth-manager")).toBe(true);
    expect(isWorkAgent("trading-bounty")).toBe(true);
  });
});
