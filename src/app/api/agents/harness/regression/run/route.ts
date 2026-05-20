import { runWeeklyRegressionEval } from "@/agent-harness/runWeeklyRegressionEval";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const result = await runWeeklyRegressionEval();
  return NextResponse.json({ status: "ok", ...result });
}
