export type LocalSystemState = "ok" | "degraded" | "error" | "unknown" | "retired";

export type LocalSystemContract = { slug: string; name: string; scope: "Company" | "Auth" | "Crypto" | "Alpha" | "Shared"; owner: string; route: string; localUrl: string | null; healthUrl: string | null; source: string; referencePattern: string; riskGate: string; };
export type LocalSystemCheck = { state: Exclude<LocalSystemState, "retired">; latencyMs?: number | null; statusCode?: number | null; detail?: string | null; };

export const LOCAL_SYSTEM_CONTRACTS: LocalSystemContract[] = [
  { slug: "company-router", name: "Company Router", scope: "Company", owner: "Company HQ / Main", route: "/", localUrl: "http://127.0.0.1:15175/", healthUrl: "http://127.0.0.1:15175/api/health", source: "services/company-services.json", referencePattern: "Google Status matrix + router service cards", riskGate: "manifest-backed routes only" },
  { slug: "ops-console", name: "Ops Console", scope: "Company", owner: "Company Ops", route: "/ops /control", localUrl: "http://127.0.0.1:3010/", healthUrl: "http://127.0.0.1:3000/api/health", source: "Postgres + worker events + approvals", referencePattern: "LaunchDarkly traces + Windmill queue controls", riskGate: "approval-gated write/control" },
  { slug: "developer-job-dashboard", name: "Developer Job Dashboard", scope: "Company", owner: "Research / Dev Jobs", route: "/jobs", localUrl: "http://127.0.0.1:15174/", healthUrl: "http://127.0.0.1:15174/", source: "developer-job-scout reports", referencePattern: "Glean activity feed + Depot run summary", riskGate: "read-only local job data" },
  { slug: "alpha-terminal", name: "Alpha Terminal", scope: "Alpha", owner: "Alpha / Crypto Signal", route: "/terminal /alpha", localUrl: "http://127.0.0.1:15173/", healthUrl: "http://127.0.0.1:18787/health", source: "Alpha backend health + market collectors", referencePattern: "Netdata resource strip + incident indicators", riskGate: "watchlist/read-only; no live trading" },
  { slug: "auth-manager", name: "Auth Manager", scope: "Auth", owner: "Auth Manager", route: "isolated", localUrl: null, healthUrl: null, source: "launchd health/model-auth monitors", referencePattern: "Google Status row; secrets never shown", riskGate: "status-only; no token/cookie/secret reads" },
  { slug: "crypto-signal", name: "Crypto Signal", scope: "Crypto", owner: "Crypto Signal", route: "isolated", localUrl: "http://127.0.0.1:8765/", healthUrl: "http://127.0.0.1:8765/health", source: "collector/CDP process status + artifacts", referencePattern: "Middleware log lane + Netdata process health", riskGate: "monitoring only; Company scope cannot trade" }
];

const STATE_WEIGHT: Record<LocalSystemState, number> = { ok: 0, unknown: 1, degraded: 2, error: 3, retired: 4 };
export function operatorActionForState(state: LocalSystemState) { if (state === "ok") return "정상 관찰"; if (state === "degraded") return "최근 이벤트와 health detail 확인"; if (state === "error") return "incident/worker log 확인 후 승인 게이트로 조치"; if (state === "retired") return "라우팅/런타임에서 제거됨; 구조 문서만 참고"; return "상태 근거 추가 수집"; }

export async function probeLocalSystem(contract: LocalSystemContract, timeoutMs = 1200): Promise<LocalSystemCheck> {
  if (!contract.healthUrl) return { state: "unknown", detail: "no safe probe endpoint configured" };
  const controller = new AbortController();
  const started = Date.now();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(contract.healthUrl, { signal: controller.signal, cache: "no-store" });
    const latencyMs = Date.now() - started;
    const state = response.ok ? "ok" : response.status >= 500 ? "error" : "degraded";
    return { state, latencyMs, statusCode: response.status, detail: `probe:${contract.healthUrl}` };
  } catch (error) {
    return { state: "error", latencyMs: Date.now() - started, statusCode: null, detail: error instanceof Error ? `probe_failed:${error.name}` : "probe_failed" };
  } finally { clearTimeout(timer); }
}

export async function probeLocalSystems() {
  const entries = await Promise.all(LOCAL_SYSTEM_CONTRACTS.map(async (contract) => [contract.slug, await probeLocalSystem(contract)] as const));
  return Object.fromEntries(entries);
}

export function buildLocalSystemMonitor({ now = new Date(), checks = {} }: { now?: Date; checks?: Record<string, LocalSystemCheck>; } = {}) {
  const systems = LOCAL_SYSTEM_CONTRACTS.map((contract) => {
    const check = checks[contract.slug];
    const state: LocalSystemState = check?.state ?? "unknown";
    return { ...contract, state, latencyMs: check?.latencyMs ?? null, statusCode: check?.statusCode ?? null, detail: check?.detail ?? (state === "unknown" ? "runtime probe not attached" : null), operatorAction: operatorActionForState(state), referenceOnly: false };
  }).sort((a, b) => STATE_WEIGHT[b.state] - STATE_WEIGHT[a.state] || a.slug.localeCompare(b.slug));
  const summary = systems.reduce((acc, system) => { acc[system.state] += 1; return acc; }, { total: systems.length, ok: 0, degraded: 0, error: 0, unknown: 0, retired: 0, workspaceRetired: true });
  return { generatedAt: now, summary, systems, retiredSurfaces: [{ slug: "hermes-workspace", name: "Hermes Workspace", state: "retired" as const, reason: "Ops Console /control is now the Company-native monitoring and management surface.", keptAsReference: "dom-company system docs and design reference boards only" }] };
}
export type LocalSystemMonitor = ReturnType<typeof buildLocalSystemMonitor>;
