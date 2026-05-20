import { NextResponse, type NextRequest } from "next/server";
import { requireWriteAccess } from "@/lib/write-rbac";
import { createAgentInstruction } from "@/server/agent-instructions";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWriteAccess(request, "agent:instruct");
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const { id } = await params;

  try {
    const result = await createAgentInstruction(id, body, auth.identity.email, auth.traceId);
    return NextResponse.json({ task: result.task, approval: result.approval, delegations: result.delegations, discordReports: result.discordReports, traceId: auth.traceId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "instruction_failed";
    const status = message === "instruction_required" ? 400 : 500;
    return NextResponse.json({ error: message, traceId: auth.traceId }, { status });
  }
}
