import { NextResponse, type NextRequest } from "next/server";
import { readOperatorIdentity } from "@/lib/auth";
import { createAgentInstruction } from "@/server/agent-instructions";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const identity = readOperatorIdentity(request);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { id } = await params;

  try {
    const result = await createAgentInstruction(id, body, identity.email);
    return NextResponse.json({ task: result.task, approval: result.approval, delegations: result.delegations, discordReports: result.discordReports });
  } catch (error) {
    const message = error instanceof Error ? error.message : "instruction_failed";
    const status = message === "instruction_required" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
