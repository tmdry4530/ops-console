import { describe, expect, it } from "vitest";
import { ingestionSources } from "@/server/ingest";

describe("dashboard skeleton smoke", () => {
  it("declares all required ingestion source classes for future dashboard state", () => {
    expect(ingestionSources).toContain("ops/status/*.json");
    expect(ingestionSources).toContain("trading/reports/*.md");
  });
});
