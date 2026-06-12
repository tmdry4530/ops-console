import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findOptionalControlRecords, redactOpsRecord, secretSafeMetadata } from "@/server/ops-control-plane";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const project = await db.project.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      tasks: { include: { agent: true, approvals: true, artifacts: true, events: { orderBy: { createdAt: "desc" }, take: 10 } }, orderBy: { updatedAt: "desc" } },
      approvals: { orderBy: { updatedAt: "desc" } },
      artifacts: { orderBy: { updatedAt: "desc" } },
      events: { orderBy: { createdAt: "desc" }, take: 80 }
    }
  });
  if (!project) return NextResponse.json({ error: "project_not_found" }, { status: 404 });
  const [runs, spans, modelCalls, toolCalls] = await Promise.all([
    findOptionalControlRecords(() => db.orchestrationRun.findMany({ where: { projectId: project.id }, orderBy: { updatedAt: "desc" }, take: 50 })),
    findOptionalControlRecords(() => db.traceSpan.findMany({ where: { taskId: { in: project.tasks.map((task) => task.id) } }, orderBy: { updatedAt: "desc" }, take: 100 })),
    findOptionalControlRecords(() => db.modelCall.findMany({ where: { taskId: { in: project.tasks.map((task) => task.id) } }, orderBy: { createdAt: "desc" }, take: 50 })),
    findOptionalControlRecords(() => db.toolCall.findMany({ where: { taskId: { in: project.tasks.map((task) => task.id) } }, orderBy: { createdAt: "desc" }, take: 50 }))
  ]);
  return NextResponse.json({
    project: {
      id: project.id,
      slug: project.slug,
      name: project.name,
      status: project.status,
      revenueType: project.revenueType,
      nextAction: project.nextAction ? redactOpsRecord({ nextAction: project.nextAction }).nextAction : null,
      blocker: project.blocker ? redactOpsRecord({ blocker: project.blocker }).blocker : null,
      metadata: secretSafeMetadata(project.metadata),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      tasks: project.tasks.map((task) => redactOpsRecord({ ...task, events: task.events.map(redactOpsRecord), approvals: task.approvals.map(redactOpsRecord), artifacts: task.artifacts.map(redactOpsRecord) })),
      approvals: project.approvals.map(redactOpsRecord),
      artifacts: project.artifacts.map(redactOpsRecord),
      events: project.events.map(redactOpsRecord),
      orchestrationRuns: runs.map(redactOpsRecord),
      traceSpans: spans.map(redactOpsRecord),
      modelCalls: modelCalls.map(redactOpsRecord),
      toolCalls: toolCalls.map(redactOpsRecord)
    }
  });
}
