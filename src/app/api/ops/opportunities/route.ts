import { NextResponse } from "next/server";
import { getOpportunityCandidates } from "@/server/autonomous-company-mode-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ opportunities: await getOpportunityCandidates() });
}
