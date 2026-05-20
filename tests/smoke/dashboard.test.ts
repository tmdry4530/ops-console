import { describe, expect, it } from "vitest";
import { ingestionSources } from "@/server/ingest";

describe("dashboard skeleton smoke", () => {
  it("declares active Company ingestion source classes and excludes cancelled lanes", () => {
    expect(ingestionSources).toContain("ops/status/*.json");
    expect(ingestionSources).toContain("hq/decisions/Company-Decision-Log.md");
    expect(ingestionSources).toContain("docs/INDEX.md");
    expect(ingestionSources).not.toContain("trading/reports/*.md");
  });
});
