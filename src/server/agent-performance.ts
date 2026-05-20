import { TARGET_AGENT_SLUGS } from "@/agent-harness";
import { db } from "@/lib/db";
import { classifyQualityBand, rollbackDecision } from "@/agent-harness/p2-policy";

export type AgentPerformanceRow = Awaited<ReturnType<typeof getAgentPerformance>>["agents"][number];

export async function getAgentPerformance(windowDays = 30) {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const agents = await db.agent.findMany({ where: { slug: { in: TARGET_AGENT_SLUGS } }, select: { slug: true, status: true, health: true } });
  const [evals, failures, harnesses, versions] = await Promise.all([
    db.agentEvalResult.groupBy({ by: ["agentSlug", "pass"], _avg: { score: true }, _count: { _all: true }, where: { createdAt: { gte: since } } }),
    db.agentFailure.groupBy({ by: ["agentSlug", "failureClass"], _count: { _all: true }, where: { createdAt: { gte: since } } }),
    db.agentHarness.findMany({ where: { agentSlug: { in: TARGET_AGENT_SLUGS }, status: "active" }, select: { agentSlug: true, version: true } }).catch(() => []),
    db.agentHarnessVersion.findMany({ where: { agentSlug: { in: TARGET_AGENT_SLUGS } }, orderBy: [{ agentSlug: "asc" }, { promotedAt: "desc" }, { createdAt: "desc" }], select: { agentSlug: true, version: true, status: true, promotedAt: true } }).catch(() => [])
  ]);
  const harnessBySlug = new Map(harnesses.map((h) => [h.agentSlug, h.version]));
  const rows = TARGET_AGENT_SLUGS.map((slug) => {
    const agent = agents.find((item) => item.slug === slug);
    const evalRows = evals.filter((item) => item.agentSlug === slug);
    const evalCount = evalRows.reduce((sum, item) => sum + item._count._all, 0);
    const passCount = evalRows.filter((item) => item.pass).reduce((sum, item) => sum + item._count._all, 0);
    const evalScore = evalCount === 0 ? null : evalRows.reduce((sum, item) => sum + (item._avg.score ?? 0) * item._count._all, 0) / evalCount;
    const failureRows = failures.filter((item) => item.agentSlug === slug).sort((a, b) => b._count._all - a._count._all);
    const failureCount = failureRows.reduce((sum, item) => sum + item._count._all, 0);
    const harnessVersion = harnessBySlug.get(slug) ?? versions.find((v) => v.agentSlug === slug && v.status === "active")?.version ?? "unknown";
    const previousVersion = versions.find((v) => v.agentSlug === slug && v.version !== harnessVersion)?.version ?? null;
    const evalPassRate = evalCount === 0 ? null : passCount / evalCount;
    const qualityBand = classifyQualityBand({ score: evalScore, passRate: evalPassRate, failureCount });
    return {
      agentSlug: slug,
      status: agent?.status ?? "unknown",
      health: agent?.health ?? "unknown",
      harnessVersion,
      previousVersion,
      evalScore,
      evalCount,
      evalPassRate,
      qualityBand,
      rollback: rollbackDecision({ currentVersion: harnessVersion, previousVersion, qualityBand }),
      topFailureClass: failureRows[0]?.failureClass ?? null,
      failureCount
    };
  });
  return { status: "ok", windowDays, agents: rows, generatedAt: new Date().toISOString(), note: "Agent Performance API for Control Center dashboard." };
}
