import { NextResponse, type NextRequest } from "next/server";
import { readOperatorIdentity } from "@/lib/auth";
import { markManualSubmitted } from "@/server/approvals";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const identity = readOperatorIdentity(request);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({ manualReportId: "", note: undefined }));
  if (typeof body.manualReportId !== "string" || body.manualReportId.length < 3) {
    return NextResponse.json({ error: "manualReportId is required" }, { status: 400 });
  }
  const { id } = await params;
  const approval = await markManualSubmitted(id, body.manualReportId, typeof body.note === "string" ? body.note : undefined, identity.email);
  return NextResponse.json({ approval });
}
