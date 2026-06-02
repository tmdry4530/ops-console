import { NextResponse, type NextRequest } from "next/server";
import { readOperatorIdentity } from "@/lib/auth";
import { deleteProjectCascade } from "@/server/project-deletion";

function statusForProjectDeletionError(message: string) {
  if (message === "exact_project_id_confirmation_required") return 400;
  if (message === "project_not_found") return 404;
  if (message === "protected_project_cannot_be_deleted") return 403;
  return 500;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const identity = readOperatorIdentity(request);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const confirm = typeof body.confirm === "string" ? body.confirm : "";
  try {
    const result = await deleteProjectCascade({ projectId: id, confirm, actorEmail: identity.email });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "project_delete_failed";
    return NextResponse.json({ error: message }, { status: statusForProjectDeletionError(message) });
  }
}
