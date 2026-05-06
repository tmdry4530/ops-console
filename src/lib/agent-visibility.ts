import type { Prisma } from "@prisma/client";

const INFRA_AGENT_SLUGS = new Set([
  "company-gateway",
  "auth-gateway",
  "crypto-gateway",
  "ops-console-app",
  "ops-console-proxy"
]);

const INFRA_AGENT_PATTERNS = [/-gateway$/, /-proxy$/, /^ops-console-/];

const COMPANY_AGENT_ORDER = new Map([
  ["hq-agent", 10],
  ["main-agent", 20],
  ["research-agent", 30],
  ["projects-agent", 40],
  ["dev-agent", 50],
  ["content-agent", 60],
  ["trading-agent", 70],
  ["docs-agent", 80],
  ["trading-bounty", 90],
  ["crypto-signal", 100],
  ["auth-manager", 110]
]);

export function isWorkAgent(slug: string): boolean {
  if (INFRA_AGENT_SLUGS.has(slug)) return false;
  return !INFRA_AGENT_PATTERNS.some((pattern) => pattern.test(slug));
}

export function workAgentWhereClause(): Prisma.AgentWhereInput {
  return {
    NOT: [
      { slug: { in: Array.from(INFRA_AGENT_SLUGS) } },
      { slug: { endsWith: "-gateway" } },
      { slug: { endsWith: "-proxy" } },
      { slug: { startsWith: "ops-console-" } }
    ]
  };
}

export function compareCompanyAgents(a: { slug: string; updatedAt?: Date }, b: { slug: string; updatedAt?: Date }): number {
  const aOrder = COMPANY_AGENT_ORDER.get(a.slug) ?? 1000;
  const bOrder = COMPANY_AGENT_ORDER.get(b.slug) ?? 1000;
  if (aOrder !== bOrder) return aOrder - bOrder;
  const aUpdated = a.updatedAt?.getTime() ?? 0;
  const bUpdated = b.updatedAt?.getTime() ?? 0;
  return bUpdated - aUpdated;
}
