import { NextResponse, type NextRequest } from "next/server";
import { createMarketOpportunityRadarRun, getOpportunityCandidates } from "@/server/autonomous-company-mode-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ opportunities: await getOpportunityCandidates() });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const result = await createMarketOpportunityRadarRun({ signals: Array.isArray(body.signals) ? body.signals : undefined });
  return NextResponse.json({ run: result.run, opportunities: result.opportunities }, { status: 201 });
}
