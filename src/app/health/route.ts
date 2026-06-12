import { GET as getApiHealth } from "../api/health/route";

export const dynamic = "force-dynamic";

export function GET() {
  return getApiHealth();
}
