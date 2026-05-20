import { NextResponse, type NextRequest } from "next/server";
import { requireWriteAccess } from "@/lib/write-rbac";
import { markManualSubmitted } from "@/server/approvals";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWriteAccess(request, "approval:decide");
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => ({ manualReportId: "", note: undefined }));
  if (typeof body.manualReportId !== "string" || body.manualReportId.length < 3) {
    return NextResponse.json({ error: "manualReportId is required", traceId: auth.traceId }, { status: 400 });
  }
  const { id } = await params;
  const approval = await markManualSubmitted(id, body.manualReportId, typeof body.note === "string" ? body.note : undefined, auth.identity.email, auth.traceId);
  return NextResponse.json({ approval, traceId: auth.traceId });
}
