import { promises as fs } from "node:fs";
import path from "node:path";
import type { AgentHarnessSpec } from "./types";

const TARGET_AGENTS = ["hq-agent", "main-agent", "research-agent", "projects-agent", "dev-agent", "docs-agent", "content-agent", "design-agent"] as const;
export const TARGET_AGENT_SLUGS = [...TARGET_AGENTS];

export function domCompanyRoot(): string {
  return process.env.DOM_COMPANY_ROOT || "/Users/domclaw/dom-company";
}
export function agentHarnessDir(agentSlug: string): string {
  return path.join(domCompanyRoot(), "agents", agentSlug);
}
export async function loadAgentHarness(agentSlug: string): Promise<AgentHarnessSpec> {
  if (!TARGET_AGENT_SLUGS.includes(agentSlug as (typeof TARGET_AGENTS)[number])) {
    throw new Error(`unsupported_agent:${agentSlug}`);
  }
  const file = path.join(agentHarnessDir(agentSlug), "CAPABILITY.json");
  return JSON.parse(await fs.readFile(file, "utf8")) as AgentHarnessSpec;
}
export async function loadOutputSchema(agentSlug: string): Promise<Record<string, unknown>> {
  const file = path.join(agentHarnessDir(agentSlug), "OUTPUT_SCHEMA.json");
  return JSON.parse(await fs.readFile(file, "utf8")) as Record<string, unknown>;
}
