import { NextResponse } from "next/server";
import { buildLocalSystemMonitor } from "@/server/local-system-monitor";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(buildLocalSystemMonitor(), {
    headers: {
      "cache-control": "no-store",
      "x-company-surface": "ops-console-control-center"
    }
  });
}
