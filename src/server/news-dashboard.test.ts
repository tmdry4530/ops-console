import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { loadNewsDashboardSummary } from "./news-dashboard";

function configRoot() {
  const root = mkdtempSync(join(tmpdir(), "news-config-"));
  mkdirSync(join(root, "research/news/domain-config"), { recursive: true });
  return root;
}

describe("loadNewsDashboardSummary", () => {
  it("returns pending_config when research-agent Domain Config is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "news-missing-"));
    const summary = loadNewsDashboardSummary(root, new Date("2026-05-21T00:00:00Z"));
    expect(summary.status).toBe("pending_config");
    expect(summary.issue.state).toBe("pending_config");
    expect(summary.domains).toEqual([]);
  });

  it("loads active domains and source refs from Vault config without hardcoded fallback domains", () => {
    const root = configRoot();
    const dir = join(root, "research/news/domain-config");
    writeFileSync(join(dir, "active-domains.md"), `# domains\n\n\`\`\`yaml\ndomain_slug: custom_domain\ndisplay_name: Custom Domain\nstatus: active\npriority: high\nsource_list:\n  primary:\n    - source_a\nfreshness_window: 72h\nmax_cards_per_domain: 3\nlanguage_region_preference: en first\nexternal_publishing_approval: required\ninclude_keywords:\n  - custom\nexclude_keywords:\n  - spam\nscoring_profile: custom_profile\n\`\`\`\n`);
    writeFileSync(join(dir, "sources.yaml"), `sources:\n  - source_id: source_a\n    name: Source A\n`);
    writeFileSync(join(dir, "exclusions.md"), `# exclusions\n`);
    const summary = loadNewsDashboardSummary(root, new Date("2026-05-21T00:00:00Z"));
    expect(summary.status).toBe("configured");
    expect(summary.domains).toHaveLength(1);
    expect(summary.domains[0]?.slug).toBe("custom_domain");
    expect(summary.domains[0]?.sourceIds).toEqual(["source_a"]);
    expect(summary.missingSourceRefs).toEqual([]);
    expect(summary.issue.state).toBe("configured_no_daily_issue");
  });

  it("blocks when active domain references a missing source", () => {
    const root = configRoot();
    const dir = join(root, "research/news/domain-config");
    writeFileSync(join(dir, "active-domains.md"), `\`\`\`yaml\ndomain_slug: custom_domain\ndisplay_name: Custom Domain\nstatus: active\npriority: high\nsource_list:\n  primary:\n    - missing_source\nfreshness_window: 72h\nmax_cards_per_domain: 3\n\`\`\`\n`);
    writeFileSync(join(dir, "sources.yaml"), `sources: []\n`);
    writeFileSync(join(dir, "exclusions.md"), `# exclusions\n`);
    const summary = loadNewsDashboardSummary(root);
    expect(summary.status).toBe("blocked");
    expect(summary.missingSourceRefs).toEqual([{ domainSlug: "custom_domain", sourceIds: ["missing_source"] }]);
  });
});
