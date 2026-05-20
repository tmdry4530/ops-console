import { NextResponse, type NextRequest } from "next/server";
import { requireWriteAccess } from "@/lib/write-rbac";
import { db } from "@/lib/db";
import { createAgentInstruction } from "@/server/agent-instructions";
import type { RiskLevel } from "@prisma/client";

export async function POST(request: NextRequest) {
  const auth = await requireWriteAccess(request, "agent:instruct");
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const instruction = typeof record.instruction === "string" ? record.instruction : typeof record.goal === "string" ? record.goal : "";
  const riskLevel = typeof record.riskLevel === "string" ? (record.riskLevel as RiskLevel) : "medium";
  const projectId = typeof record.projectId === "string" && record.projectId.trim() ? record.projectId.trim() : null;
  const discordChannel = typeof record.channel === "string" ? record.channel : "main-agent";
  const actorEmail = `discord:${discordChannel}`;

  try {
    const mainAgent = await db.agent.findUniqueOrThrow({ where: { slug: "main-agent" }, select: { id: true } });
    const result = await createAgentInstruction(
      mainAgent.id,
      { instruction, actionType: "operator_instruction", riskLevel, projectId },
      actorEmail,
      auth.traceId
    );
    return NextResponse.json({
      task: result.task,
      approval: result.approval,
      delegations: result.delegations,
      discordReports: result.discordReports,
      mode: "auto_multi_agent",
      traceId: auth.traceId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "discord_goal_failed";
    const status = message === "instruction_required" ? 400 : 500;
    return NextResponse.json({ error: message, traceId: auth.traceId }, { status });
  }
}
