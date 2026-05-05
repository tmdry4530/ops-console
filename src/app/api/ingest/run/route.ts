import { NextResponse, type NextRequest } from "next/server";
import { readOperatorIdentity } from "@/lib/auth";
import { runIngestionSkeleton } from "@/server/ingest";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const identity = readOperatorIdentity(request);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = await runIngestionSkeleton();
  return NextResponse.json({ summary });
}
