import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildAgentControlPlan, type AgentControlAction } from "@/server/agent-control";

export const dynamic = "force-dynamic";

const ACTIONS = new Set(["pause", "resume", "retry", "restart", "kill"]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "") as AgentControlAction;
  if (!ACTIONS.has(action)) return NextResponse.json({ error: "invalid action" }, { status: 400 });
  const agent = await db.agent.findUnique({ where: { id }, select: { id: true, name: true, slug: true } });
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });

  const plan = buildAgentControlPlan(action, agent);
  if (plan.status === "approval_required") {
    const approval = await db.approval.create({
      data: {
        type: "other",
        status: "pending",
        riskLevel: plan.riskLevel,
        title: plan.approvalTitle,
        summary: plan.approvalSummary,
        requestedBy: "ops-console-agent-control"
      },
      select: { id: true }
    });
    await db.event.create({ data: { type: plan.eventType, severity: "warning", message: `Agent control approval requested: ${agent.slug} ${action}`, agentId: agent.id, approvalId: approval.id, metadata: { action, approvalId: approval.id, mode: "gated_agent_control" } } });
    return NextResponse.json({ status: "approval_required", approvalId: approval.id });
  }

  const command = await db.commandQueue.create({ data: { actionType: plan.commandActionType, status: "queued", riskLevel: plan.riskLevel, payload: { agentId: agent.id, agentSlug: agent.slug, action, mode: "agent_control" } }, select: { id: true } });
  await db.event.create({ data: { type: plan.eventType, severity: "info", message: `Agent control queued: ${agent.slug} ${action}`, agentId: agent.id, commandQueueId: command.id, metadata: { action, commandId: command.id, mode: "agent_control" } } });
  return NextResponse.json({ status: "queued", commandId: command.id });
}
