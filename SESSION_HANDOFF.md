# Session Handoff

Current state: production-ready skeleton files have been added, but the goal is not complete.

Next recommended work:

1. Install dependencies and generate the Prisma client.
2. Fix any skeleton lint/type/build issues.
3. Add auth gate and database-backed route loaders.
4. Implement Bounty Submission Approval end-to-end.
5. Run the full verification checklist from `TEST_PLAN.md`.

## Latest verification

Skeleton checks passed: install, Prisma generate/validate, lint, typecheck, unit/smoke tests, production build, default Docker Compose config, and full workers/proxy Compose config.

Precise blockers remaining for the active production goal:

- No live Postgres migration/seed run has been performed yet.
- Auth gate and RBAC are scaffold-level only.
- Bounty Submission Approval is seeded in schema intent but not implemented end-to-end in UI/API.
- Ingestion is a skeleton and does not yet read real files or persist idempotently.
- Command queue/manual handoff workflows are helper-level only.

## Runtime evidence

Validated through Docker Compose with Postgres, Redis, app, migration tool, and seed tool. The current DB contains CapyFi completed/manual-submitted smoke state and Revenue Manual Outreach pending state.

Remaining caveats:

- Auth is a production-private reverse-proxy/header gate plus local bypass; no external SSO provider is configured.
- Rate limiting is scaffolded, not Redis-enforced yet.
- Workers are runnable entrypoints but do not process BullMQ jobs continuously yet.

App container healthcheck is now healthy with Compose `HOSTNAME=0.0.0.0` and `PORT=3000`.

## Mac mini deployment handoff

Current Mac mini deployment is live.

- Repo path: `/Users/domclaw/ops-console`
- Browser URL: `http://127.0.0.1:3010/dashboard`
- Direct app URL: `http://127.0.0.1:3000` with `x-ops-operator-email` header
- LaunchAgents:
  - `ai.company.ops-console.app`
  - `ai.company.ops-console.proxy`
- Logs:
  - `~/Library/Logs/ops-console/app.out.log`
  - `~/Library/Logs/ops-console/app.err.log`
  - `~/Library/Logs/ops-console/proxy.out.log`
  - `~/Library/Logs/ops-console/proxy.err.log`
- Health check: `bash /Users/domclaw/ops-console/ops/mac-mini/healthcheck.sh`
- Data services: Docker Compose Postgres/Redis, local-only published ports `55432` and `56379`.

Operational caveat: this is private-loopback deployment. Do not expose `3010` or `3000` publicly without replacing the header proxy with real auth/SSO and public hardening.
