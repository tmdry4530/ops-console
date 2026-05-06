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
- `DATABASE_URL='[REDACTED_LOCAL_POSTGRES_URL]' pnpm prisma:validate`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `DATABASE_URL='[REDACTED_LOCAL_POSTGRES_URL]' pnpm build`
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

## Mac mini deployment

Passed:

- Installed Docker CLI, Docker Compose, and Colima via Homebrew.
- Started Colima as a Homebrew service for login persistence.
- Deployed repo at `/Users/domclaw/ops-console`.
- Started Postgres and Redis via Docker Compose; both report `healthy`.
- Applied Prisma migrations and seed against the live local Postgres instance.
- Built the standalone Next.js production output.
- Installed launchd agents:
  - `ai.company.ops-console.app` runs the standalone Next.js app on `127.0.0.1:3000` only.
  - `ai.company.ops-console.proxy` listens on `0.0.0.0:3010` for LAN browser access and only allows `127.0.0.1`, `::1`, `192.168.35.244`, and `192.168.0.31`.
- Runtime smoke passed:
  - `GET /api/health` returned OK.
  - `GET /dashboard` with operator header returned OK.
  - `GET http://127.0.0.1:3010/dashboard` returned OK for local browser use.
  - LAN URL is `http://192.168.35.36:3010/dashboard`; non-allowlisted client IPs receive `403 Forbidden` at the proxy.
- Added live Mac mini status ingestion:
  - `ai.company.ops-console.live-status` writes safe launchd service status files under ignored `ops/status/*.json` every 60 seconds.
  - Ingestion now surfaces Company/Auth/Crypto gateways, crypto signal collector, and Ops Console app/proxy in the Agents tab.
  - Ingestion also reads shared Company data from `/Users/domclaw/dom-company` by default: docs index, decision log, SaaS revenue pipeline CSV, trading status, and trading reports.
  - Added `ai.company.ops-console.command-worker`; it polls queued safe commands every 15 seconds and completed the existing `revenue_outreach` queued command. `immunefi_submit` remains `waiting_manual_handoff` by policy.

## File/folder organization pass

- Moved the frontend UI composition guide into `docs/frontend/UI_GUIDE.md`.
- Added `docs/INDEX.md` so documentation is discoverable by operators and the ingestion contract.
- Updated `README.md` with documentation pointers.
- Kept required root control documents in place because `AGENTS.md` and the production goal reference them directly.


## Markdown folder organization pass

- Moved root control markdown into `docs/control/`.
- Moved operational runbooks into `docs/operations/`.
- Kept only `README.md` and `AGENTS.md` at repo root for standard discovery and agent loading.
- Updated `docs/INDEX.md` and `README.md` to point to the new locations.
