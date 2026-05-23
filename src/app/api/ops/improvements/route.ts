import { NextResponse } from "next/server";
import { getImprovementCandidates } from "@/server/autonomous-company-mode-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ improvements: await getImprovementCandidates() });
}
