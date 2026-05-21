import { NextResponse, type NextRequest } from "next/server";
import { readOperatorIdentity } from "@/lib/auth";
import { getConsoleBridgeApprovals } from "@/server/console-bridge";

export const dynamic = "force-dynamic";

function readLimit(request: NextRequest): number | undefined {
  const raw = request.nextUrl.searchParams.get("limit");
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: NextRequest) {
  const operator = readOperatorIdentity(request);
  if (!operator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await getConsoleBridgeApprovals(undefined, { limit: readLimit(request) });
  return NextResponse.json(data, {
    headers: { "cache-control": "private, max-age=5, stale-while-revalidate=15" },
  });
}
