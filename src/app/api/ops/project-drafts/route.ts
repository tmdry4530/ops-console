import { NextResponse, type NextRequest } from "next/server";
import { createIdeaProjectFactoryRun } from "@/server/autonomous-company-mode-store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const result = await createIdeaProjectFactoryRun({ candidates: Array.isArray(body.candidates) ? body.candidates : undefined });
  return NextResponse.json({ run: result.run, projectDrafts: result.projectDrafts, ownerDecisionRequests: result.ownerDecisionRequests }, { status: 201 });
}
