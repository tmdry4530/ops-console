import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findOptionalControlRecords, redactOpsRecord } from "@/server/ops-control-plane";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function metadataHasTrace(metadata: unknown, traceId: string) {
  return Boolean(metadata && typeof metadata === "object" && !Array.isArray(metadata) && (metadata as Record<string, unknown>).traceId === traceId);
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const task = await db.task.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: { agent: true, project: true, approvals: true, artifacts: true, events: { orderBy: { createdAt: "desc" }, take: 80 } }
  });
  if (!task) return NextResponse.json({ error: "task_not_found" }, { status: 404 });
  const traceIds = task.events
    .map((event) => event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata) ? (event.metadata as Record<string, unknown>).traceId : null)
    .filter((traceId): traceId is string => typeof traceId === "string");
  const [runs, spans, runSteps, modelCalls, toolCalls, commandQueues, controlActions] = await Promise.all([
    findOptionalControlRecords(() => db.orchestrationRun.findMany({ where: { OR: [{ rootTaskId: task.id }, { traceId: { in: traceIds } }] }, orderBy: { updatedAt: "desc" }, take: 30 })),
    findOptionalControlRecords(() => db.traceSpan.findMany({ where: { OR: [{ taskId: task.id }, { traceId: { in: traceIds } }] }, orderBy: { updatedAt: "desc" }, take: 100 })),
    findOptionalControlRecords(() => db.runStep.findMany({ where: { taskId: task.id }, orderBy: { sequence: "asc" }, take: 100 })),
    findOptionalControlRecords(() => db.modelCall.findMany({ where: { taskId: task.id }, orderBy: { createdAt: "desc" }, take: 50 })),
    findOptionalControlRecords(() => db.toolCall.findMany({ where: { taskId: task.id }, orderBy: { createdAt: "desc" }, take: 50 })),
    findOptionalControlRecords(() => db.commandQueue.findMany({ orderBy: { createdAt: "desc" }, take: 100 })),
    findOptionalControlRecords(() => db.controlAction.findMany({ where: { taskId: task.id }, orderBy: { updatedAt: "desc" }, take: 50 }))
  ]);
  return NextResponse.json({
    task: redactOpsRecord({
      ...task,
      events: task.events.map(redactOpsRecord),
      approvals: task.approvals.map(redactOpsRecord),
      artifacts: task.artifacts.map(redactOpsRecord),
      orchestrationRuns: runs.map(redactOpsRecord),
      traceSpans: spans.map(redactOpsRecord),
      runSteps: runSteps.map(redactOpsRecord),
      modelCalls: modelCalls.map(redactOpsRecord),
      toolCalls: toolCalls.map(redactOpsRecord),
      commandQueues: commandQueues.filter((command) => traceIds.some((traceId) => metadataHasTrace(command.payload, traceId))).map(redactOpsRecord),
      controlActions: controlActions.map(redactOpsRecord)
    })
  });
}
