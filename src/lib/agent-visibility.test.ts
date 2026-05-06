import { describe, expect, it } from "vitest";
import { compareCompanyAgents, isWorkAgent } from "./agent-visibility";

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

  it("keeps Company department agents visible", () => {
    expect(isWorkAgent("hq-agent")).toBe(true);
    expect(isWorkAgent("dev-agent")).toBe(true);
    expect(isWorkAgent("research-agent")).toBe(true);
    expect(isWorkAgent("content-agent")).toBe(true);
    expect(isWorkAgent("docs-agent")).toBe(true);
  });

  it("sorts Company department agents before process-backed monitors", () => {
    const sorted = [
      { slug: "crypto-signal" },
      { slug: "dev-agent" },
      { slug: "hq-agent" },
      { slug: "research-agent" },
      { slug: "auth-manager" }
    ].sort(compareCompanyAgents);

    expect(sorted.map((agent) => agent.slug)).toEqual(["hq-agent", "research-agent", "dev-agent", "crypto-signal", "auth-manager"]);
  });
});
