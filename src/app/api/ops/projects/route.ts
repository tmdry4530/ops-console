import { NextResponse, type NextRequest } from "next/server";
import { readOperatorIdentity } from "@/lib/auth";
import { db } from "@/lib/db";
import { createProjectIntake } from "@/server/project-intake";
import { findOptionalControlRecords, redactOpsRecord, secretSafeMetadata } from "@/server/ops-control-plane";

export const dynamic = "force-dynamic";

function statusForError(message: string) {
  if (["project_name_required", "instruction_required"].includes(message)) return 400;
  if (message === "project_slug_exists") return 409;
  if (message === "hq_agent_missing") return 503;
  return 500;
}

export async function POST(request: NextRequest) {
  const identity = readOperatorIdentity(request);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const result = await createProjectIntake(body, identity.email, "ops_console");
    return NextResponse.json({
      project: redactOpsRecord({ ...result.project, metadata: secretSafeMetadata(result.project.metadata) }),
      intakeEvent: redactOpsRecord(result.intakeEvent),
      task: result.instruction.task ? redactOpsRecord(result.instruction.task) : null,
      approval: result.instruction.approval ? redactOpsRecord(result.instruction.approval) : null,
      delegations: result.instruction.delegations,
      router: result.router
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "project_intake_failed";
    return NextResponse.json({ error: message }, { status: statusForError(message) });
  }
}

export async function GET() {
  const projects = await db.project.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { tasks: true, approvals: true, artifacts: true, events: { orderBy: { createdAt: "desc" }, take: 5 } }
  });
  const runs = await findOptionalControlRecords(() => db.orchestrationRun.findMany({ orderBy: { updatedAt: "desc" }, take: 100 }));
  return NextResponse.json({
    projects: projects.map((project) => ({
      id: project.id,
      slug: project.slug,
      name: project.name,
      status: project.status,
      revenueType: project.revenueType,
      nextAction: project.nextAction ? "set" : null,
      blocker: project.blocker ? "set" : null,
      metadata: secretSafeMetadata(project.metadata),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      activeTasks: project.tasks
        .filter((task) => !["completed", "failed"].includes(task.status))
        .map((task) => redactOpsRecord({ id: task.id, slug: task.slug, title: task.title, status: task.status, riskLevel: task.riskLevel, agentId: task.agentId, projectId: task.projectId, blocker: task.blocker, nextAction: task.nextAction, updatedAt: task.updatedAt })),
      openApprovals: project.approvals
        .filter((approval) => ["pending", "approved_waiting_execution", "manual_handoff", "needs_changes"].includes(approval.status))
        .map((approval) => redactOpsRecord({ id: approval.id, type: approval.type, status: approval.status, riskLevel: approval.riskLevel, title: approval.title, requestedBy: approval.requestedBy, projectId: approval.projectId, taskId: approval.taskId, updatedAt: approval.updatedAt })),
      restrictedArtifacts: project.artifacts.filter((artifact) => artifact.restricted).length,
      runs: runs.filter((run) => run.projectId === project.id).map(redactOpsRecord),
      events: project.events.map(redactOpsRecord)
    }))
  });
}
