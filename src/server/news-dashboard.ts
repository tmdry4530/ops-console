import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

export type NewsDomainStatus = "active" | "paused" | "draft";

export type NewsDomain = {
  slug: string;
  displayName: string;
  status: NewsDomainStatus;
  priority: "critical" | "high" | "medium" | "low" | string;
  freshnessWindow: string;
  maxCards: number;
  sourceIds: string[];
  includeKeywords: string[];
  excludeKeywords: string[];
  languageRegionPreference: string;
  externalPublishingApproval: string;
  scoringProfile: string;
  missingSourceIds: string[];
};

export type NewsDashboardSummary = {
  status: "pending_config" | "configured" | "blocked";
  generatedAt: string;
  configRoot: string;
  requiredPaths: string[];
  configHash: string | null;
  issue: {
    runKey: string;
    dailyTimeKst: "08:00";
    state: "pending_config" | "configured_no_daily_issue";
    cardCount: number;
    archiveCount: number;
  };
  domains: NewsDomain[];
  sourceCount: number;
  missingSourceRefs: { domainSlug: string; sourceIds: string[] }[];
  nextAction: string;
};

const REQUIRED_FILES = ["active-domains.md", "sources.yaml", "exclusions.md"];

function vaultRoot() {
  return process.env.COMPANY_VAULT_PATH ?? "/Users/domclaw/dom-company";
}

function domainConfigRoot(root = vaultRoot()) {
  return join(root, "research/news/domain-config");
}

function todayKstRunKey(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
  return `news-daily-${formatter.format(now)}-0800-kst`;
}

function extractYamlBlocks(markdown: string) {
  return [...markdown.matchAll(/```yaml\n([\s\S]*?)\n```/g)].map((match) => match[1]);
}

function scalar(block: string, key: string, fallback = "") {
  const match = block.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim().replace(/^['"]|['"]$/g, "") ?? fallback;
}

function numberScalar(block: string, key: string, fallback: number) {
  const value = Number(scalar(block, key, String(fallback)));
  return Number.isFinite(value) ? value : fallback;
}

function listUnder(block: string, key: string) {
  const lines = block.split("\n");
  const result: string[] = [];
  const start = lines.findIndex((line) => line.trim() === `${key}:`);
  if (start === -1) return result;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^[a-zA-Z_][\w_]*:/.test(line)) break;
    const item = line.match(/^\s*-\s*(.+)$/);
    if (item) result.push(item[1].trim().replace(/^['"]|['"]$/g, ""));
  }
  return result;
}

function sourceList(block: string) {
  const lines = block.split("\n");
  const result: string[] = [];
  const start = lines.findIndex((line) => line.trim() === "source_list:");
  if (start === -1) return result;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^[a-zA-Z_][\w_]*:/.test(line)) break;
    const item = line.match(/^\s*-\s*([a-zA-Z0-9_-]+)\s*$/);
    if (item) result.push(item[1]);
  }
  return result;
}

function sourceIdsFromSourcesYaml(text: string) {
  return [...text.matchAll(/^\s*-\s*source_id:\s*([a-zA-Z0-9_-]+)\s*$/gm)].map((match) => match[1]);
}

function configHash(parts: string[]) {
  return createHash("sha256").update(parts.join("\n---\n")).digest("hex");
}

export function loadNewsDashboardSummary(root = vaultRoot(), now = new Date()): NewsDashboardSummary {
  const configRoot = domainConfigRoot(root);
  const requiredPaths = REQUIRED_FILES.map((file) => join(configRoot, file));
  const missingRequired = requiredPaths.filter((path) => !existsSync(path));
  const generatedAt = now.toISOString();

  if (missingRequired.length > 0) {
    return {
      status: "pending_config",
      generatedAt,
      configRoot,
      requiredPaths,
      configHash: null,
      issue: { runKey: todayKstRunKey(now), dailyTimeKst: "08:00", state: "pending_config", cardCount: 0, archiveCount: 0 },
      domains: [],
      sourceCount: 0,
      missingSourceRefs: [],
      nextAction: "research-agent Domain Config 생성 필요"
    };
  }

  const activeText = readFileSync(join(configRoot, "active-domains.md"), "utf8");
  const sourcesText = readFileSync(join(configRoot, "sources.yaml"), "utf8");
  const exclusionsText = readFileSync(join(configRoot, "exclusions.md"), "utf8");
  const blocks = extractYamlBlocks(activeText);
  const sourceIds = sourceIdsFromSourcesYaml(sourcesText);
  const sourceSet = new Set(sourceIds);

  const domains = blocks.map((block): NewsDomain => {
    const refs = sourceList(block);
    const slug = scalar(block, "domain_slug");
    return {
      slug,
      displayName: scalar(block, "display_name", slug),
      status: scalar(block, "status", "draft") as NewsDomainStatus,
      priority: scalar(block, "priority", "medium"),
      freshnessWindow: scalar(block, "freshness_window", "24h"),
      maxCards: numberScalar(block, "max_cards_per_domain", 5),
      sourceIds: refs,
      includeKeywords: listUnder(block, "include_keywords"),
      excludeKeywords: listUnder(block, "exclude_keywords"),
      languageRegionPreference: scalar(block, "language_region_preference", "unspecified"),
      externalPublishingApproval: scalar(block, "external_publishing_approval", "required"),
      scoringProfile: scalar(block, "scoring_profile", "default"),
      missingSourceIds: refs.filter((id) => !sourceSet.has(id))
    };
  }).filter((domain) => domain.status === "active");

  const missingSourceRefs = domains
    .filter((domain) => domain.missingSourceIds.length > 0)
    .map((domain) => ({ domainSlug: domain.slug, sourceIds: domain.missingSourceIds }));

  const status = domains.length === 0 ? "pending_config" : missingSourceRefs.length > 0 ? "blocked" : "configured";

  return {
    status,
    generatedAt,
    configRoot,
    requiredPaths,
    configHash: configHash([activeText, sourcesText, exclusionsText]),
    issue: {
      runKey: todayKstRunKey(now),
      dailyTimeKst: "08:00",
      state: status === "pending_config" ? "pending_config" : "configured_no_daily_issue",
      cardCount: 0,
      archiveCount: 0
    },
    domains,
    sourceCount: sourceIds.length,
    missingSourceRefs,
    nextAction: status === "configured" ? "collector/card pipeline 구현 전: configured 상태로 대시보드 표시" : status === "blocked" ? "missing source refs 보완 필요" : "research-agent Domain Config 생성 필요"
  };
}
