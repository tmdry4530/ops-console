import { NextResponse, type NextRequest } from "next/server";
import { readOperatorIdentity } from "@/lib/auth";
import { getConsoleBridgeSummary } from "@/server/console-bridge";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const identity = readOperatorIdentity(request);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const summary = await getConsoleBridgeSummary();
  return NextResponse.json(summary, {
    headers: {
      "Cache-Control": "private, max-age=5, stale-while-revalidate=15"
    }
  });
}
