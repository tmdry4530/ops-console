import { db } from "@/lib/db";
import { workAgentWhereClause } from "@/lib/agent-visibility";
import type { Agent, AgentCapability, RiskLevel } from "@prisma/client";

export type RegistryAgent = Agent & { capabilities: AgentCapability[] };

export async function getAgentRegistry() {
  return db.agent.findMany({
    where: workAgentWhereClause(),
    include: { capabilities: { orderBy: { capabilityKey: "asc" } } },
    orderBy: { slug: "asc" }
  });
}

export async function getRegistryAgentById(id: string): Promise<RegistryAgent | null> {
  return db.agent.findFirst({ where: { ...workAgentWhereClause(), id }, include: { capabilities: { orderBy: { capabilityKey: "asc" } } } });
}

export async function getRegistryAgentBySlug(slug: string): Promise<RegistryAgent | null> {
  return db.agent.findFirst({ where: { ...workAgentWhereClause(), slug }, include: { capabilities: { orderBy: { capabilityKey: "asc" } } } });
}

export function agentHarnessSummary(agent: RegistryAgent) {
  const outputSchemas = agent.capabilities.map((cap) => ({ capabilityKey: cap.capabilityKey, outputSchema: cap.outputSchema, inputSchema: cap.inputSchema }));
  return {
    agentId: agent.id,
    slug: agent.slug,
    name: agent.name,
    status: agent.status,
    health: agent.health,
    capabilityCount: agent.capabilities.length,
    requiresApprovalCount: agent.capabilities.filter((cap) => cap.requiresApproval).length,
    maxRisk: agent.capabilities.reduce<RiskLevel>((max, cap) => {
      const weight = { low: 1, medium: 2, high: 3, critical: 4 } as const;
      return weight[cap.maxRisk] > weight[max] ? cap.maxRisk : max;
    }, "low" as const),
    outputSchemas
  };
}
