import { describe, expect, it } from "vitest";

import { GET as getApiHealth } from "../api/health/route";
import { GET as getRootHealth } from "./route";

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("root /health route", () => {
  it("matches the canonical /api/health private Ops Console payload", async () => {
    const [apiPayload, rootPayload] = await Promise.all([
      readJson(getApiHealth()),
      readJson(getRootHealth())
    ]);

    expect(rootPayload).toMatchObject({
      status: "ok",
      service: "company-ops-console",
      deployment: "production-private"
    });
    expect(rootPayload.status).toBe(apiPayload.status);
    expect(rootPayload.service).toBe(apiPayload.service);
    expect(rootPayload.deployment).toBe(apiPayload.deployment);
    expect(typeof rootPayload.timestamp).toBe("string");
  });
});
