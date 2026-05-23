import { NextResponse, type NextRequest } from "next/server";
import { evaluateAutonomyPolicy } from "@/server/autonomous-company-mode";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  return NextResponse.json(evaluateAutonomyPolicy({
    actionType: typeof body.actionType === "string" ? body.actionType : "unknown",
    riskLevel: ["low", "medium", "high", "critical"].includes(body.riskLevel) ? body.riskLevel : "medium",
    visibility: ["private", "internal", "external", "public"].includes(body.visibility) ? body.visibility : "internal",
    scopeApproved: body.scopeApproved !== false,
    gates: typeof body.gates === "object" && body.gates ? body.gates : {},
    primaryAgent: typeof body.primaryAgent === "string" ? body.primaryAgent : undefined
  }));
}
