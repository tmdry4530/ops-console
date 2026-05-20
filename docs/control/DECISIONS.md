# Decisions

- Use `pnpm` at the repo root because the repo was empty and the goal allowed defaults unless existing code forced another choice.
- Use Next.js App Router, TypeScript, Tailwind CSS, Prisma, PostgreSQL, Redis-compatible workers, Docker Compose, and Caddy private HTTPS as the production-private baseline.
- Use `Event` as the canonical audit/event log for now; add a separate `AuditLog` only if later requirements require different retention or access controls.
- Do not store passwords in the baseline auth model. The skeleton uses operator/session-compatible records and leaves concrete auth flow implementation for the feature phase.
- Deploy the Mac mini runtime as production-private services: Colima/Docker for Postgres+Redis, launchd for the standalone Next.js app bound to `127.0.0.1:3000`, and a LAN auth proxy on `0.0.0.0:3010` that injects the private operator header but only allows client `192.168.35.244` plus local loopback. Do not expose this proxy publicly.
- Company department agents should be autonomous where safe: a DB worker may execute low/medium internal running tasks and queue Discord result/status reports, but any high/critical or external-risk action must create an Ops Console approval/manual handoff. Discord is not an approval or command surface.
- Department autonomy should be capability/adapter based, not only status based: `AgentCapability` records each adapter contract (`inputSchema`, `allowedTools`, `maxRisk`, expected artifact, success/failure criteria), and adapter v1 must create linked Artifacts/events while staying proposal-only until safer execution adapters are explicitly added.
- Agent Harness rollout uses dom-company `agents/<agentSlug>/` as durable harness source of truth and Ops Console Runtime Harness Kernel as enforcement: preflight capability/policy gate, output schema validation, verifier gate, eval result recording, and rollback-capable harness version records.
## 2026-05-20 — Agent Harness P2

- Added agent quality dashboard data to `/agents` using `/api/agents/performance`.
- Added P2 policy helpers for quality bands, rollback decisions, failure feedback routing, and weekly regression run slugs.
- Added rollback API: `POST /api/agents/harness/rollback`.
- Added weekly regression API/script: `POST /api/agents/harness/regression/run` and `src/agent-harness/runWeeklyRegressionEval.ts`.
- Failure feedback loop routes failures into spec patch / skill candidate / memory candidate / eval case flags and creates regression eval cases for schema/verifier failures.
- Verification: lint passed with existing font warning, tests 98 passed, build passed.
