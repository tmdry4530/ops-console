import { NextResponse } from "next/server";
import { getAutonomyRuns } from "@/server/autonomous-company-mode-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ runs: await getAutonomyRuns() });
}
