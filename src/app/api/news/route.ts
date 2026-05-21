import { NextResponse } from "next/server";
import { loadNewsDashboardSummary } from "@/server/news-dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(loadNewsDashboardSummary());
}
