import { describe, expect, it } from "vitest";
import { POST as postImprovements } from "./improvements/route";
import { POST as postOpportunities } from "./opportunities/route";

const request = (path: string, body: unknown) => new Request(`http://test.local/api/ops/${path}`, { method: "POST", body: JSON.stringify(body) });

describe("Autonomous Company Mode radar APIs", () => {
  it("starts service improvement radar runs and returns trace-linked candidates", async () => {
    const response = await postImprovements(request("improvements", { services: [{ name: "Ops Console", area: "latency", symptom: "slow control page", confidence: "medium" }] }) as never);
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.run.runType).toBe("service_improvement_radar");
    expect(json.improvements[0].traceId).toContain("trace-imp");
    expect(json.run.candidateIds).toContain(json.improvements[0].id);
  });

  it("starts market opportunity radar runs and filters memecoin noise", async () => {
    const response = await postOpportunities(request("opportunities", { signals: [
      { title: "AI ops copilot", summary: "internal workflow demand", source: "trusted-a", confidence: "medium" },
      { title: "AI ops copilot", summary: "competitor traction", source: "trusted-b", confidence: "medium" },
      { title: "Pepe bot", summary: "memecoin pump", source: "social", confidence: "high" }
    ] }) as never);
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.run.runType).toBe("market_opportunity_radar");
    expect(json.opportunities.some((item: any) => item.status === "ready_for_review")).toBe(true);
    expect(json.opportunities.some((item: any) => item.excludedReason?.includes("memecoin"))).toBe(true);
  });
});
