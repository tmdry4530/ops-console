import { db } from "@/lib/db";
import { requireWriteAccess, auditWriteEvent } from "@/lib/write-rbac";
import { TARGET_AGENT_SLUGS } from "@/agent-harness";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireWriteAccess(request, "harness:manage");
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => ({}));
  const agentSlug = String(body.agentSlug ?? "");
  const targetVersion = String(body.targetVersion ?? "");
  const reason = String(body.reason ?? "operator_requested_harness_rollback").slice(0, 500);
  if (!TARGET_AGENT_SLUGS.includes(agentSlug as (typeof TARGET_AGENT_SLUGS)[number])) return NextResponse.json({ error: "invalid agentSlug", traceId: auth.traceId }, { status: 400 });
  if (!targetVersion) return NextResponse.json({ error: "targetVersion required", traceId: auth.traceId }, { status: 400 });
  const target = await db.agentHarnessVersion.findUnique({ where: { agentSlug_version: { agentSlug, version: targetVersion } } });
  if (!target) return NextResponse.json({ error: "target harness version not found", traceId: auth.traceId }, { status: 404 });
  const current = await db.agentHarnessVersion.findFirst({ where: { agentSlug, status: "active" }, orderBy: { promotedAt: "desc" } });
  await db.$transaction(async (tx) => {
    await tx.agentHarnessVersion.updateMany({ where: { agentSlug, status: "active" }, data: { status: "inactive" } });
    await tx.agentHarnessVersion.update({ where: { agentSlug_version: { agentSlug, version: targetVersion } }, data: { status: "active", promotedAt: new Date(), rollbackFrom: current?.version ?? null } });
    await tx.agentHarness.updateMany({ where: { agentSlug }, data: { status: "inactive" } });
    await tx.agentHarness.updateMany({ where: { agentSlug, version: targetVersion }, data: { status: "active" } });
    await tx.event.create({ data: { type: "agent.harness.rollback", severity: "warning", message: `Agent harness rollback: ${agentSlug} -> ${targetVersion}`, traceId: auth.traceId, systemScope: "company", metadata: { agentSlug, targetVersion, previousVersion: current?.version ?? null, reason, actorEmail: auth.identity.email } } });
  });
  return NextResponse.json({ status: "rolled_back", agentSlug, targetVersion, previousVersion: current?.version ?? null, traceId: auth.traceId });
}
