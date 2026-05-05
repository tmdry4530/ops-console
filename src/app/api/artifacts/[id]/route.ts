import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const artifact = await db.artifact.findUnique({ where: { id } });
  if (!artifact) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (artifact.restricted) {
    return NextResponse.json({ id: artifact.id, title: artifact.title, type: artifact.type, restricted: true, restrictionReason: artifact.restrictionReason });
  }
  return NextResponse.json({ artifact });
}
