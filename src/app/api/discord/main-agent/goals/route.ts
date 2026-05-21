import { NextResponse, type NextRequest } from "next/server";
import { readOperatorIdentity } from "@/lib/auth";
import { createProjectIntake } from "@/server/project-intake";

function statusForError(message: string) {
  if (["project_name_required", "instruction_required"].includes(message)) return 400;
  if (message === "project_slug_exists") return 409;
  if (message === "hq_agent_missing") return 503;
  return 500;
}

function discordActor(request: NextRequest, fallback: string) {
  const user = request.headers.get("x-discord-user") ?? request.headers.get("x-discord-user-id");
  return user ? `discord:${user}` : fallback;
}

export async function POST(request: NextRequest) {
  const identity = readOperatorIdentity(request);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  try {
    const result = await createProjectIntake(body, discordActor(request, identity.email), "discord_main_agent");
    return NextResponse.json({
      status: "registered",
      project: result.project,
      intakeEvent: result.intakeEvent,
      task: result.instruction.task,
      delegations: result.instruction.delegations,
      discordReports: result.instruction.discordReports,
      router: result.router
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "discord_project_intake_failed";
    return NextResponse.json({ error: message }, { status: statusForError(message) });
  }
}
