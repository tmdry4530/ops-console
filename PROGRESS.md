# Progress

## 2026-05-05

- Re-read `AGENTS.md` and `.codex/goals/company-ops-console-production.md`.
- Created the production-ready project skeleton baseline before feature implementation.
- Added package/config, App Router shell, Prisma schema, seed scaffold, worker entrypoints, Docker Compose/Caddy deployment baseline, and documentation/runbook skeletons.

## Remaining

- Implement auth gate and RBAC.
- Implement database-backed dashboard, approvals, projects, agents, artifacts, policies, settings, events, and SSE.
- Implement idempotent ingestion and command/manual handoff workflows.
- Complete Bounty Submission Approval and Revenue Manual Outreach slices.
- Run full verification and document blockers.

## Skeleton validation results

Passed:

- `pnpm install`
- `pnpm prisma:generate`
- `DATABASE_URL='postgresql://ops_console:ops_console@localhost:5432/ops_console?schema=public' pnpm prisma:validate`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `DATABASE_URL='postgresql://ops_console:ops_console@localhost:5432/ops_console?schema=public' pnpm build`
- `pnpm docker:config`
- `docker compose --profile workers --profile proxy config`

Not yet run:

- `pnpm prisma:migrate` and `pnpm prisma:seed` against a live Postgres instance.
- `docker compose build`.
- App runtime smoke via browser or HTTP against a running `next dev`/container.

## Feature validation results

Passed:

- Compose clean DB path: `docker compose down -v`, `docker compose up -d postgres redis`, `docker compose --profile tools run --rm migrate`, `docker compose --profile tools run --rm seed`, `docker compose up -d app`.
- Runtime health: `curl http://127.0.0.1:3000/api/health`.
- Auth gate: `/dashboard` without `x-ops-operator-email` returns `401`; with the header returns `200`.
- Bounty Submission Approval slice: approval detail renders, approve creates a `waiting_manual_handoff` command record, manual submission records report ID, project moves to `submitted`, task moves to `completed`, and timeline events are created.
- Revenue Manual Outreach path: seeded pending approval and project visible.
- Ingestion idempotency: repeated `/api/ingest/run` calls skip unchanged sample artifacts.
- Backup/restore drill: clean `pg_dump --clean --if-exists` backup restored with `ON_ERROR_STOP=1`; dashboard still returns `200` after restore.
- Docker build: `docker compose build app ingestion-worker command-worker migrate seed`.
- App container healthcheck reached `healthy` after setting `HOSTNAME=0.0.0.0`/`PORT=3000` in Compose app environment.
- Status JSON ingestion now persists agent/project/task/artifacts/approval records for `ops/status/*.json` contracts.
- Final rebuild/recreate after status ingestion support passed: lint, typecheck, tests, production build, Docker build, app health, dashboard smoke, app healthcheck `healthy`.
