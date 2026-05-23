import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/ops/project-drafts", () => {
  it("runs idea→project factory and creates owner decision requests", async () => {
    const response = await POST(new Request("http://test.local/api/ops/project-drafts", { method: "POST", body: JSON.stringify({}) }) as never);
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.run.runType).toBe("idea_project_factory");
    expect(json.projectDrafts.length).toBeGreaterThan(0);
    expect(json.ownerDecisionRequests.length).toBeGreaterThan(0);
    expect(json.ownerDecisionRequests[0].requestedByAgent ?? "main-agent").toBe("main-agent");
  });
});
