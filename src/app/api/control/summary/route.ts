import { NextResponse } from "next/server";
import { getControlCenterSummary } from "@/server/control-center";

export const dynamic = "force-dynamic";

export async function GET() {
  const summary = await getControlCenterSummary();
  return NextResponse.json(summary);
}
