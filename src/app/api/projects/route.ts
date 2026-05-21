import { NextResponse, type NextRequest } from "next/server";
import { readOperatorIdentity } from "@/lib/auth";
import { createProjectIntake } from "@/server/project-intake";

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
      project: result.project,
      intakeEvent: result.intakeEvent,
      task: result.instruction.task,
      approval: result.instruction.approval,
      delegations: result.instruction.delegations,
      discordReports: result.instruction.discordReports,
      router: result.router
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "project_intake_failed";
    return NextResponse.json({ error: message }, { status: statusForError(message) });
  }
}
