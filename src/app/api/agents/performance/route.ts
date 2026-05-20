import { db } from "@/lib/db";
import { TARGET_AGENT_SLUGS } from "@/agent-harness";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const agents = await db.agent.findMany({ where: { slug: { in: TARGET_AGENT_SLUGS } }, select: { slug: true, status: true, health: true } });
  const [tasks, evals, failures, harnesses] = await Promise.all([
    db.task.groupBy({ by: ["agentId", "status"], _count: { _all: true }, where: { updatedAt: { gte: since }, agent: { slug: { in: TARGET_AGENT_SLUGS } } } }),
    db.agentEvalResult.groupBy({ by: ["agentSlug", "pass"], _avg: { score: true }, _count: { _all: true }, where: { createdAt: { gte: since } } }),
    db.agentFailure.groupBy({ by: ["agentSlug", "failureClass"], _count: { _all: true }, where: { createdAt: { gte: since } } }),
    db.agentHarness.findMany({ where: { agentSlug: { in: TARGET_AGENT_SLUGS }, status: "active" }, select: { agentSlug: true, version: true } }).catch(() => [])
  ]);
  const harnessBySlug = new Map(harnesses.map((h) => [h.agentSlug, h.version]));
  const rows = TARGET_AGENT_SLUGS.map((slug) => {
    const agent = agents.find((item) => item.slug === slug);
    const evalRows = evals.filter((item) => item.agentSlug === slug);
    const evalCount = evalRows.reduce((sum, item) => sum + item._count._all, 0);
    const passCount = evalRows.filter((item) => item.pass).reduce((sum, item) => sum + item._count._all, 0);
    const weightedScore = evalCount === 0 ? null : evalRows.reduce((sum, item) => sum + (item._avg.score ?? 0) * item._count._all, 0) / evalCount;
    const failureRows = failures.filter((item) => item.agentSlug === slug).sort((a, b) => b._count._all - a._count._all);
    return {
      agentSlug: slug,
      status: agent?.status ?? "unknown",
      health: agent?.health ?? "unknown",
      harnessVersion: harnessBySlug.get(slug) ?? "2026.05.20",
      evalScore: weightedScore,
      evalCount,
      evalPassRate: evalCount === 0 ? null : passCount / evalCount,
      topFailureClass: failureRows[0]?.failureClass ?? null,
      failureCount: failureRows.reduce((sum, item) => sum + item._count._all, 0)
    };
  });
  return NextResponse.json({ status: "ok", windowDays: 30, agents: rows, generatedAt: new Date().toISOString(), note: "Agent Performance API for Control Center dashboard." });
}
