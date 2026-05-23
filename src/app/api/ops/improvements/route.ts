import { NextResponse, type NextRequest } from "next/server";
import { createServiceImprovementRadarRun, getImprovementCandidates } from "@/server/autonomous-company-mode-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ improvements: await getImprovementCandidates() });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const result = await createServiceImprovementRadarRun({ services: Array.isArray(body.services) ? body.services : undefined });
  return NextResponse.json({ run: result.run, improvements: result.improvements }, { status: 201 });
}
