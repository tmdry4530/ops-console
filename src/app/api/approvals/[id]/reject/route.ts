import { NextResponse, type NextRequest } from "next/server";
import { readOperatorIdentity } from "@/lib/auth";
import { rejectApproval } from "@/server/approvals";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const identity = readOperatorIdentity(request);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({ note: undefined }));
  const { id } = await params;
  const approval = await rejectApproval(id, typeof body.note === "string" ? body.note : undefined, identity.email);
  return NextResponse.json({ approval });
}
