import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "company-ops-console",
    deployment: "production-private",
    timestamp: new Date().toISOString()
  });
}
