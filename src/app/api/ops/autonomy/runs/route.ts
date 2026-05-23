import { NextResponse, type NextRequest } from "next/server";
import { createAutonomyRunDraft, getAutonomyRuns } from "@/server/autonomous-company-mode-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ runs: await getAutonomyRuns() });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const run = await createAutonomyRunDraft({
    runType: typeof body.runType === "string" ? body.runType : "service_improvement_radar",
    primaryAgent: typeof body.primaryAgent === "string" ? body.primaryAgent : undefined,
    riskLevel: ["low", "medium", "high", "critical"].includes(body.riskLevel) ? body.riskLevel : "medium"
  });
  return NextResponse.json({ run }, { status: 201 });
}
