import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auditWriteEvent, requireWriteAccess } from "@/lib/write-rbac";
import { buildAgentControlPlan, type AgentControlAction } from "@/server/agent-control";
import { enforcePolicyForAction } from "@/server/policy-enforcement";

export const dynamic = "force-dynamic";

const ACTIONS = new Set(["pause", "resume", "retry", "restart", "kill"]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWriteAccess(request, "agent:control");
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "") as AgentControlAction;
  if (!ACTIONS.has(action)) return NextResponse.json({ error: "invalid action", traceId: auth.traceId }, { status: 400 });
  const agent = await db.agent.findUnique({ where: { id }, select: { id: true, name: true, slug: true } });
  if (!agent) return NextResponse.json({ error: "not found", traceId: auth.traceId }, { status: 404 });

  const plan = buildAgentControlPlan(action, agent);
  const policy = await enforcePolicyForAction({ actionType: plan.commandActionType, riskLevel: plan.riskLevel, systemScope: "company" });
  if (policy.decision === "block") {
    await auditWriteEvent({ type: "agent.control.blocked", severity: "warning", message: `Agent control blocked: ${agent.slug} ${action}`, actorEmail: auth.identity.email, traceId: auth.traceId, agentId: agent.id, metadata: { action, policy } });
    return NextResponse.json({ status: "blocked", policy, traceId: auth.traceId }, { status: 403 });
  }

  if (plan.status === "approval_required" || policy.decision === "require_approval" || policy.decision === "require_manual_handoff") {
    const approval = await db.approval.create({
      data: { type: "other", status: "pending", riskLevel: plan.riskLevel, title: plan.approvalTitle, summary: `${plan.approvalSummary}\n\nPolicy: ${policy.decision} (${policy.reason})`, requestedBy: auth.identity.email },
      select: { id: true }
    });
    await auditWriteEvent({ type: plan.eventType, severity: "warning", message: `Agent control approval requested: ${agent.slug} ${action}`, actorEmail: auth.identity.email, traceId: auth.traceId, agentId: agent.id, approvalId: approval.id, metadata: { action, approvalId: approval.id, mode: "gated_agent_control", policy } });
    return NextResponse.json({ status: "approval_required", approvalId: approval.id, policy, traceId: auth.traceId });
  }

  const command = await db.commandQueue.create({ data: { actionType: plan.commandActionType, status: "queued", riskLevel: plan.riskLevel, traceId: auth.traceId, payload: { agentId: agent.id, agentSlug: agent.slug, action, mode: "agent_control" } }, select: { id: true } });
  await auditWriteEvent({ type: plan.eventType, severity: "info", message: `Agent control queued: ${agent.slug} ${action}`, actorEmail: auth.identity.email, traceId: auth.traceId, agentId: agent.id, commandQueueId: command.id, metadata: { action, commandId: command.id, mode: "agent_control", policy } });
  return NextResponse.json({ status: "queued", commandId: command.id, policy, traceId: auth.traceId });
}
