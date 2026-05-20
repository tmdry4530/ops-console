import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auditWriteEvent, requireWriteAccess } from "@/lib/write-rbac";
import { compileCommand } from "@/server/command-compiler";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireWriteAccess(request, "command:compile");
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => ({}));
  const command = typeof body.command === "string" ? body.command : "";
  try {
    const compiled = await compileCommand({ command, actorEmail: auth.identity.email, traceId: auth.traceId });
    let commandId: string | null = null;
    if (compiled.queueable) {
      const queued = await db.commandQueue.create({ data: { actionType: compiled.actionType, riskLevel: compiled.riskLevel, status: "queued", traceId: auth.traceId, payload: compiled.payload as never }, select: { id: true } });
      commandId = queued.id;
    }
    await auditWriteEvent({ type: "command.compiled", severity: compiled.queueable ? "info" : "warning", message: `Command compiled: ${compiled.actionType}`, actorEmail: auth.identity.email, traceId: auth.traceId, commandQueueId: commandId, metadata: { actionType: compiled.actionType, riskLevel: compiled.riskLevel, decision: compiled.decision.decision, queueable: compiled.queueable } });
    return NextResponse.json({ status: compiled.queueable ? "queued" : "compiled_requires_gate", commandId, compiled, traceId: auth.traceId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "compile_failed", traceId: auth.traceId }, { status: 400 });
  }
}
