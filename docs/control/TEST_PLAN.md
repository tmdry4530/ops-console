# Test Plan

## Baseline skeleton checks

- `pnpm install`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm prisma:generate`
- `pnpm prisma:validate`
- `pnpm build`
- `pnpm docker:config`

## Required feature checks to add next

- Approval decision API integration tests.
- Idempotent ingestion tests for status JSON, markdown artifacts, CSV, decision log, docs index, and safe git summaries.
- Restricted artifact tests for secret-like content.
- Dashboard and approval smoke tests against seeded data.
- Docker Compose build and healthcheck validation.

## Skeleton verification evidence — 2026-05-05

Passed locally:

- `pnpm install`
- `pnpm prisma:generate`
- `DATABASE_URL='postgresql://ops_console:ops_console@localhost:5432/ops_console?schema=public' pnpm prisma:validate`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `DATABASE_URL='postgresql://ops_console:ops_console@localhost:5432/ops_console?schema=public' pnpm build`
- `pnpm docker:config`
- `docker compose --profile workers --profile proxy config`

## Runtime verification evidence — feature pass

Passed locally:

- `docker compose down -v`
- `docker compose up -d postgres redis`
- `docker compose --profile tools run --rm migrate`
- `docker compose --profile tools run --rm seed`
- `docker compose up -d app`
- `curl http://127.0.0.1:3000/api/health`
- Auth gate smoke: dashboard `401` without private operator header; `200` with `x-ops-operator-email`.
- Bounty Approval smoke: approval detail `200`, approve API, manual-submit API, DB state `completed/submitted/completed`.
- Events API and SSE snapshot return approval timeline events.
- Backup/restore clean drill using `ops/backups/backup.sh` and `ops/backups/restore.sh`.
- `docker compose build app ingestion-worker command-worker migrate seed`.
