import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/ops/autonomy/runs", () => {
  it("creates a scheduled service-improvement autonomy run draft with linkage metadata", async () => {
    const response = await POST(new Request("http://test.local/api/ops/autonomy/runs", {
      method: "POST",
      body: JSON.stringify({ runType: "service_improvement_radar", primaryAgent: "projects-agent" })
    }) as never);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.run).toMatchObject({ runType: "service_improvement_radar", primaryAgent: "projects-agent" });
    expect(body.run.traceId).toContain("trace-autonomy-service-improvement-radar");
    expect(body.run.eventIds.length).toBeGreaterThan(0);
    expect(body.run.artifactIds.length).toBeGreaterThan(0);
    expect(body.run.verificationIds.length).toBeGreaterThan(0);
  });
});
