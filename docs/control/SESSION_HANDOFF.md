# Session Handoff

Current state: production-ready skeleton files have been added, but the goal is not complete.

Next recommended work:

1. Install dependencies and generate the Prisma client.
2. Fix any skeleton lint/type/build issues.
3. Add auth gate and database-backed route loaders.
4. Implement Bounty Submission Approval end-to-end.
5. Run the full verification checklist from `docs/control/TEST_PLAN.md`.

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
- Browser URL from Mac mini itself: `http://127.0.0.1:3010/dashboard`
- LAN URL for allowlisted clients `192.168.35.244` and `192.168.0.31`: `http://192.168.35.36:3010/dashboard`
- Tailnet URL for Tailscale clients: `https://mac-mini-ops-console.tail2e580b.ts.net/`
- Tailscale node IP: `100.94.36.17`; access is via Tailscale Serve proxying to `http://127.0.0.1:3010`, not by opening app port `3000` publicly.
- Direct app URL: `http://127.0.0.1:3000` with `x-ops-operator-email` header; app is loopback-only.
- LaunchAgents:
  - `ai.company.ops-console.app`
  - `ai.company.ops-console.proxy`
  - `ai.company.ops-console.live-status` updates safe local process-backed monitoring status every 60 seconds and ingests it into the Ops Console database. Gateway/proxy/app infrastructure is not shown as an operator-manageable agent.
  - `ai.company.ops-console.command-worker` polls queued safe commands every 15 seconds and executes the DB workflow (`queued → running → completed/failed`). Manual-handoff actions stay blocked.
  - `ai.company.ops-console.agent-worker` should run `ops/mac-mini/start-agent-worker.sh` when enabled; it polls running Company department tasks every 30 seconds. Low/medium internal tasks are executed by the autonomous worker and reported to Discord as result/status events only. High/critical tasks create pending Ops Console approvals and move the task/agent to `waiting_approval`.
  - `ai.company.tailscale.userspace` runs Tailscale userspace networking with socket `/Users/domclaw/.tailscale/tailscaled.sock` and keeps Tailscale Serve available.
- Logs:
  - `~/Library/Logs/ops-console/app.out.log`
  - `~/Library/Logs/ops-console/app.err.log`
  - `~/Library/Logs/ops-console/proxy.out.log`
  - `~/Library/Logs/ops-console/proxy.err.log`
  - `~/Library/Logs/ops-console/live-status.out.log`
  - `~/Library/Logs/ops-console/live-status.err.log`
  - `~/Library/Logs/ops-console/command-worker.out.log`
  - `~/Library/Logs/ops-console/command-worker.err.log`
  - `~/Library/Logs/ops-console/tailscale-userspace.out.log`
  - `~/Library/Logs/ops-console/tailscale-userspace.err.log`
- Health check: `bash /Users/domclaw/ops-console/ops/mac-mini/healthcheck.sh`
- Data ingestion: local Ops Console `ops/status/*.json` for process-backed monitoring status, plus shared Company data under `/Users/domclaw/dom-company` by default (`docs/INDEX.md`, `hq/decisions/Company-Decision-Log.md`, `projects/saas/data/revenue_pipeline.csv`, `trading/status/*.md`, `trading/reports/*.md`). Seeded Company department agents cover `hq`, `main`, `research`, `projects`, `dev`, `content`, `trading`, and `docs`; each can receive console instructions from its Agent detail page. Override with `COMPANY_DATA_ROOT` if needed.
- Console instruction control: Agent detail pages include a `콘솔 지시` form. Submitting a directive creates linked Task/Approval/Event records; operators then use the Approvals tab to approve safe queued execution or record manual handoff. HQ Agent instructions additionally create role-matched subtasks for Company department agents and `discord.report.queued` events for hq/role channel reporting; after approval the command worker activates the delegated subtasks and marks target agents running/currentTask. The autonomous agent worker then picks up running department tasks, self-executes safe low/medium internal work through adapter v1, or creates pending Ops Console approvals for high/critical work. Adapter v1 currently seeds `AgentCapability` contracts for docs/research/dev/main agents and creates linked Artifact + `agent.adapter.*` events; it is artifact/proposal-only and does not perform external side effects. Discord is result/status reporting only and is not an approval surface. High-risk categories remain manual-gated even on the private LAN/tailnet.
- Data services: Docker Compose Postgres/Redis, local-only published ports `55432` and `56379`.

Operational caveat: this is private LAN plus private tailnet deployment. The browser proxy listens on `0.0.0.0:3010` but only allows `127.0.0.1`, `::1`, `192.168.35.244`, and `192.168.0.31`; other client IPs receive `403 Forbidden`. Tailscale access uses tailnet-only HTTPS Serve at `https://mac-mini-ops-console.tail2e580b.ts.net/`, which forwards locally to the proxy as loopback. Do not expose `3010` or `3000` publicly without replacing the header proxy with real auth/SSO and public hardening.

## Documentation organization update

Frontend UI guidance now lives at `docs/frontend/UI_GUIDE.md`, with `docs/INDEX.md` as the documentation index. Root control documents remain at the repo root intentionally for goal/agent compatibility.



## Markdown organization update

Root markdown is intentionally limited to `README.md` and `AGENTS.md`. Control docs now live in `docs/control/`; deployment, backup/restore, and security docs live in `docs/operations/`.

## Agent Harness Kernel update — 2026-05-20

- `DOM_COMPANY_ROOT/agents/<agentSlug>/` is the durable harness source.
- Run `DOM_COMPANY_ROOT=/Users/domclaw/dom-company pnpm tsx src/agent-harness/seedHarnessRegistry.ts` after migration to seed AgentCapability, AgentHarness, AgentHarnessVersion, and AgentEvalCase rows.
- Runtime worker blocks capability/policy failures before execution and blocks `completed` if output schema/verifier fails.
- API: `GET /api/agents/performance` returns harness quality status for Control Center.
