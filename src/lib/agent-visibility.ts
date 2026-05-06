import type { Prisma } from "@prisma/client";

const INFRA_AGENT_SLUGS = new Set([
  "company-gateway",
  "auth-gateway",
  "crypto-gateway",
  "ops-console-app",
  "ops-console-proxy"
]);

const INFRA_AGENT_PATTERNS = [/-gateway$/, /-proxy$/, /^ops-console-/];

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
