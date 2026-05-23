import { NextResponse, type NextRequest } from "next/server";
import { evaluateAutonomyControlAction, sanitizeOwnerDecisionInput } from "@/server/autonomous-company-mode";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await parseControlBody(request);
  const action = ["pause", "resume", "lower_autonomy", "raise_autonomy", "emergency_stop"].includes(body.action as string) ? body.action as "pause" | "resume" | "lower_autonomy" | "raise_autonomy" | "emergency_stop" : "pause";
  const control = evaluateAutonomyControlAction({
    action,
    currentLevel: typeof body.currentLevel === "string" ? body.currentLevel : "L5",
    requestedLevel: typeof body.requestedLevel === "string" ? body.requestedLevel : undefined
  });
  const audit = sanitizeOwnerDecisionInput({
    title: `Autonomy control: ${action}`,
    ownerQuestion: control.decision === "require_owner_approval" ? "자율성 재개/상향을 승인할까?" : "Containment control recorded",
    contextSummary: typeof body.reason === "string" ? body.reason : "Autonomy control action requested from /control/autonomy.",
    requestedByAgent: "main-agent",
    gates: { highCritical: action === "emergency_stop", scopeExpansion: action === "raise_autonomy" }
  });
  return NextResponse.json({ control, audit }, { status: control.decision === "allow" ? 201 : 202 });
}

async function parseControlBody(request: NextRequest): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return await request.json().catch(() => ({}));
  if (contentType.includes("form")) {
    const form = await request.formData().catch(() => undefined);
    if (!form) return {};
    return Object.fromEntries(form.entries());
  }
  return await request.json().catch(() => ({}));
}
