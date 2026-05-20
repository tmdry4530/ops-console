import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - 15 * 60 * 1000);
  const [counts, unverifiedCompleted, staleLeases, recentIncidents, pendingVerifications] = await Promise.all([
    db.task.groupBy({ by: ["systemScope", "status"], _count: { _all: true } }),
    db.task.count({ where: { status: "completed", verificationStatus: { notIn: ["passed", "not_required"] } } }),
    db.task.count({ where: { status: { in: ["claimed", "running", "tool_wait"] }, leaseExpiresAt: { lt: now } } }),
    db.incident.count({ where: { status: { not: "closed" } } }),
    db.verification.count({ where: { status: "pending" } })
  ]);

  const status = unverifiedCompleted === 0 && staleLeases === 0 ? "ok" : "degraded";
  return NextResponse.json({
    status,
    service: "company-ops-console",
    deployment: "production-private",
    timestamp: now.toISOString(),
    checks: {
      database: "ok",
      unverifiedCompleted,
      staleLeases,
      recentIncidents,
      pendingVerifications,
      taskCounts: counts.map((item) => ({ systemScope: item.systemScope, status: item.status, count: item._count._all }))
    },
    policy: {
      verificationGate: unverifiedCompleted === 0 ? "enforced" : "violated",
      staleLeaseThreshold: staleBefore.toISOString()
    }
  }, { status: status === "ok" ? 200 : 503 });
}
