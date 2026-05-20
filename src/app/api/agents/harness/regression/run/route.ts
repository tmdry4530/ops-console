import { runWeeklyRegressionEval } from "@/agent-harness/runWeeklyRegressionEval";
import { requireWriteAccess, auditWriteEvent } from "@/lib/write-rbac";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireWriteAccess(request, "harness:manage");
  if (auth instanceof NextResponse) return auth;
  const result = await runWeeklyRegressionEval();
  await auditWriteEvent({ type: "agent.harness.regression.run", message: "Harness regression eval requested", actorEmail: auth.identity.email, traceId: auth.traceId, metadata: result });
  return NextResponse.json({ status: "ok", traceId: auth.traceId, ...result });
}
