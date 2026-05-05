import { NextResponse, type NextRequest } from "next/server";
import { readOperatorIdentity } from "@/lib/auth";

const publicPaths = ["/api/health"];

export function middleware(request: NextRequest) {
  if (publicPaths.some((path) => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const identity = readOperatorIdentity(request);
  if (!identity) {
    return NextResponse.json(
      { error: "unauthorized", message: "Private operator identity header or local bypass is required." },
      { status: 401 }
    );
  }

  const response = NextResponse.next();
  response.headers.set("x-ops-authenticated-operator", identity.email);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
