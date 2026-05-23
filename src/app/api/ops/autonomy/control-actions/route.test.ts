import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/ops/autonomy/control-actions", () => {
  it("allows pause/lower/emergency controls and gates resume/raise", async () => {
    const pauseResponse = await POST(new Request("http://test.local/api/ops/autonomy/control-actions", {
      method: "POST",
      body: JSON.stringify({ action: "pause", currentLevel: "L5" })
    }) as never);
    expect(pauseResponse.status).toBe(201);
    const pause = await pauseResponse.json();
    expect(pause.control).toMatchObject({ decision: "allow", nextState: "paused" });

    const resumeResponse = await POST(new Request("http://test.local/api/ops/autonomy/control-actions", {
      method: "POST",
      body: JSON.stringify({ action: "raise_autonomy", currentLevel: "L3", requestedLevel: "L5" })
    }) as never);
    expect(resumeResponse.status).toBe(202);
    const resume = await resumeResponse.json();
    expect(resume.control).toMatchObject({ decision: "require_owner_approval", nextState: "approval_required" });
  });

  it("accepts form posts from the /control/autonomy page", async () => {
    const response = await POST(new Request("http://test.local/api/ops/autonomy/control-actions", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "action=lower_autonomy&requestedLevel=L3"
    }) as never);
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.control).toMatchObject({ decision: "allow", nextLevel: "L3" });
  });
});
