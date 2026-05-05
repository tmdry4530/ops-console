import { NextResponse, type NextRequest } from "next/server";
import { listEvents } from "@/server/events";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") ?? undefined;
  const events = await listEvents(type);
  return NextResponse.json({ events });
}
