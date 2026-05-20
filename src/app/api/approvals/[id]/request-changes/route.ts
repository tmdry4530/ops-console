import { NextResponse, type NextRequest } from "next/server";
import { requireWriteAccess } from "@/lib/write-rbac";
import { requestApprovalChanges } from "@/server/approvals";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWriteAccess(request, "approval:decide");
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => ({ note: undefined }));
  const { id } = await params;
  const approval = await requestApprovalChanges(id, typeof body.note === "string" ? body.note : undefined, auth.identity.email, auth.traceId);
  return NextResponse.json({ approval, traceId: auth.traceId });
}
