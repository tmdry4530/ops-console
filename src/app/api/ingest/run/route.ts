import { NextResponse, type NextRequest } from "next/server";
import { requireWriteAccess, auditWriteEvent } from "@/lib/write-rbac";
import { runIngestionSkeleton } from "@/server/ingest";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireWriteAccess(request, "ingest:run");
  if (auth instanceof NextResponse) return auth;
  const summary = await runIngestionSkeleton();
  await auditWriteEvent({ type: "ingest.run.requested", message: "Ingestion run requested", actorEmail: auth.identity.email, traceId: auth.traceId, metadata: { summary } });
  return NextResponse.json({ summary, traceId: auth.traceId });
}
