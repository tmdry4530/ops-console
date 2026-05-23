import { NextResponse, type NextRequest } from "next/server";
import { createOwnerDecisionRequest, getOwnerInbox } from "@/server/autonomous-company-mode-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ decisions: await getOwnerInbox() });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const result = await createOwnerDecisionRequest({
    title: typeof body.title === "string" ? body.title : "Owner decision required",
    ownerQuestion: typeof body.ownerQuestion === "string" ? body.ownerQuestion : "승인할까?",
    contextSummary: typeof body.contextSummary === "string" ? body.contextSummary : "Autonomy gate requires owner confirmation.",
    riskLevel: ["low", "medium", "high", "critical"].includes(body.riskLevel) ? body.riskLevel : "medium",
    requestedByAgent: typeof body.requestedByAgent === "string" ? body.requestedByAgent : "main-agent",
    gates: typeof body.gates === "object" && body.gates ? body.gates : {}
  });
  return NextResponse.json({ decision: result }, { status: 201 });
}
