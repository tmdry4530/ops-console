import { getAgentPerformance } from "@/server/agent-performance";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getAgentPerformance(30));
}
