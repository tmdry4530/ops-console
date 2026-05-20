# Progress

## 2026-05-20 — Operator menu pruning

- Removed dead/duplicate sidebar menus: Dashboard, Reports, Settings, and Policies.
- `/control` is now the default root operator surface; `/events` carries audit/report evidence.
- Removed non-functional project creation button from `/projects`; project creation remains workflow/API-driven until a real audited action exists.
- Added `src/lib/operator-navigation.ts` as the canonical live-menu policy plus tests.


## 2026-05-20 — Hermes Workspace retired; Company-native monitor/manage surface

- Retired Hermes Workspace from live Company operation: launchd service removed, active path removed, Company Router `workspace` service removed, and `/workspace` + `/operations` now return `410 retired_surface`.
- Added `src/server/local-system-monitor.ts` and `GET /api/control/local-systems` for active system contracts without `hermes-workspace`.
- Extended `/control` with `Company-native Monitor / Manage`, showing system scope, state, route, reference pattern, risk gate, and operator action.
- Preserved useful Workspace structure as reference-only IA in dom-company docs; Ops Console DB/API remains canonical.
- Verification passed: focused tests, typecheck, lint warning-only, build, runtime smoke for `/control`, `/api/control/local-systems`, router `/api/services`, and retired routes.

## 2026-05-14 — Workspace console commands/agents read-only bridge

- Added read-only ops-console bridge collectors/routes for command queue and active agents:
  - `GET /api/bridge/commands?limit=N`
  - `GET /api/bridge/agents?limit=N`
- Payloads expose only normalized safe fields and omit command `payload`/`result` plus agent `metadata`.
- Added Workspace proxy collectors/routes:
  - `GET /api/company-console/commands?limit=N`
  - `GET /api/company-console/agents?limit=N`
- Extended Workspace `company_console` dashboard card with read-only `Command queue` and `Active agents` panels.
- Verification passed: focused bridge tests, full ops-console tests 23 files / 82 tests, typecheck, lint with existing font warning only, Prisma validate, build, docker config; full Workspace tests 105 files / 679 tests, build, temp loopback smoke for summary/approvals/tasks/events/commands/agents, direct Workspace collector smoke for commands/agents. No production restart/deploy or routing change.

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
- Auth gate: `/control` without `x-ops-operator-email` returns `401`; with the header returns `200`.
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
  - `ai.company.tailscale.userspace` runs Tailscale in userspace mode without root TUN privileges and keeps the tailnet session alive.
- Runtime smoke passed:
  - `GET /api/health` returned OK.
  - `GET /control` with operator header returned OK.
  - `GET http://127.0.0.1:3010/control` returned OK for local browser use.
  - LAN URL is `http://192.168.35.36:3010/control`; non-allowlisted client IPs receive `403 Forbidden` at the proxy.
  - Tailnet-only HTTPS URL is `https://mac-mini-ops-console.tail2e580b.ts.net/`, served through Tailscale Serve to `http://127.0.0.1:3010`.
  - Added live Mac mini status ingestion:
  - `ai.company.ops-console.live-status` writes safe launchd status files for process-backed monitoring agents under ignored `ops/status/*.json` every 60 seconds.
  - The Agents tab is the Company agent control plane: it includes hq/main/research/projects/dev/content/trading/docs department agents plus process-backed monitoring agents such as auth health and crypto signal collection. Gateway/proxy/app infrastructure is intentionally hidden from the agent command center and remains covered by healthcheck/logs.

  - Added `ai.company.ops-console.command-worker`; it polls queued safe commands every 15 seconds and completed the existing `revenue_outreach` queued command. `immunefi_submit` remains `waiting_manual_handoff` by policy.
  - Added the first console-native instruction path: each Agent detail page now has a `콘솔 지시` form. Operator instructions create a linked Task, Approval, and Event so all work can be routed through the existing approval/command/manual-handoff workflow instead of being managed only by chat.
  - Added HQ orchestration routing: when the instruction target is `hq-agent`, Ops Console creates the HQ parent Task/Approval/Event plus queued subtasks for role-matched Company department agents (`research`, `projects`, `dev`, `content`, `trading`, `docs`, `main`). Broad Company-wide instructions fan out to all department agents; ambiguous instructions default to research/dev/docs. On approval, the command worker now activates the delegated child tasks and marks target agents running/currentTask so the console reflects assigned execution. Discord report intents are recorded as `discord.report.queued` events with target channel metadata for the Company Discord gateway/reporter path.
  - Added the autonomous agent worker path: `main/research/projects/dev/content/trading/docs` agents now have a DB-driven worker loop (`pnpm worker:agents`, `ops/mac-mini/start-agent-worker.sh`) that picks running delegated tasks, executes low/medium internal work autonomously, records `agent.autonomy.*` audit events, and queues Discord **result/status** reports only. High/critical work is converted into a pending Ops Console approval and the task/agent move to `waiting_approval`; Discord only says that console action is needed and never carries the approval action itself.
  - Upgraded the autonomous worker to adapter v1: `AgentCapability` stores initial execution contracts for `docs-agent`, `research-agent`, `dev-agent`, and `main-agent`; safe adapter runs now create linked `Artifact` records plus `agent.adapter.*` events instead of only flipping task status. Current adapters are artifact/proposal-only and do not perform external submissions, deploys, wallet/KYC, live trading, or paid actions.
  - Console instruction safety policy: low/medium internal instructions can be approved into the safe queue; deploy, bounty submission, wallet/KYC, live trading, paid action, public disclosure, and high/critical risk instructions remain approval/manual-gate controlled.

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

## 2026-05-09 — Dev automation/validation hardening

- Hardened `src/server/task-observability.ts` artifact preview allowlist matching so paths must be the exact allowed root or a descendant, preventing prefix collisions such as `/Users/domclaw/ops-console-archive` from being treated as `/Users/domclaw/ops-console`.
- Added regression coverage in `src/server/task-observability.test.ts` for allowed descendants, sibling-prefix denial, and blocked preview behavior.
- Verification passed: `pnpm install --frozen-lockfile`, `pnpm lint` (existing font warning only), `pnpm typecheck`, `pnpm test`, `pnpm prisma:validate`, `pnpm build`, `pnpm docker:config`.

## 2026-05-14 — Company worker handoff bridge

- Connected Ops Console Hermes execution to dom-company's safe worker handoff runner (`scripts/company_worker_handoff.py`) instead of invoking the `company` Discord gateway profile directly.
- Added `design-agent` to seed data, autonomous worker routing, HQ orchestration, idle standing work, capability registry, and agent ordering.
- Removed standalone `trading-agent` from supported autonomous/Hermes routing; trading channel/context can remain in Company Discord, but no worker profile is launched from Ops Console.
- Hermes bridge now writes an Ops Console task-card prompt under `projects/task-cards/ops-console-<task>.md` and stores worker output under `<role>/ops-console-runs/<task>.md` with the dom-company runner's `.run.json` sidecar.
- Applied live DB seed so `design-agent` exists in the running Ops Console database.
- Restarted live app and agent-worker LaunchAgents; `/api/health` returned OK afterward.
- Verification passed: `pnpm lint` (existing font warning only), `pnpm typecheck`, `pnpm test` (22 files, 76 tests), `pnpm prisma:validate`, `pnpm build`, `pnpm docker:config`, `pnpm prisma:seed`, live `/api/health`.

## 2026-05-14 — Hermes task detail observability UI

- Upgraded `/tasks/[id]` so Hermes/Company worker runs show report path, `.run.json` sidecar, `output_mode`, return code, stderr count, git-publish state, bridge stdout, separated Hermes CLI transcript, and artifact previews.
- Added `hermesRunSidecars`/sidecar path helpers to `src/server/task-observability.ts` so worker-authored reports and `<output>.stdout.log` are visible from the console without mixing transcript into the report.
- Added regression coverage for `.run.json` and `stdout_log_path` handling.
- Restarted the live app LaunchAgent and verified the known design-agent smoke task page renders the new sections with the private operator header.
- Verification passed: targeted task-observability test, full `pnpm test` (22 files, 78 tests), `pnpm typecheck`, `pnpm lint` (existing font warning only), `pnpm prisma:validate`, `pnpm build`, `pnpm docker:config`, live `/api/health`.

## 2026-05-14 — Company Kanban DB adapter

- Added `dom-company/scripts/company_kanban.py`, a namespaced Company Kanban adapter for `~/.hermes/kanban.db` because the installed Hermes CLI currently has no native `hermes kanban` command.
- Ops Console Hermes bridge now builds Kanban payloads and syncs status transitions: `ready` before handoff, `running` during handoff, `review` on success, and `blocked` on failure.
- Worker success intentionally does not mark Kanban `done`; `main`, `project`, or `hq` review remains required.
- `/tasks/[id]` now surfaces Kanban sync metadata beside report/run/transcript metadata.
- Verification passed: `company_kanban.py` temp-DB smoke, `pnpm test src/server/hermes-bridge.test.ts`, `pnpm typecheck`.

## 2026-05-14 — Workspace console read-only bridge

- Added `GET /api/bridge/summary` as a read-only backend bridge for Hermes Workspace, summarizing pending approvals, blocked/waiting tasks, critical events, queued/running commands, and active agents.
- Added `src/server/console-bridge.ts` plus regression coverage in `src/server/console-bridge.test.ts`.
- No write/control action was added; approve/reject/manual-submit/agent instruction routes remain outside the Workspace bridge.
- Verification passed: focused bridge test, full `pnpm test` (23 files, 80 tests), `pnpm typecheck`, `pnpm lint` (existing font warning only), `pnpm prisma:validate`, `pnpm build`, `pnpm docker:config`, and loopback `/api/bridge/summary` smoke on temporary dev port.

## 2026-05-14 — Workspace console drill-down bridge

- Added read-only drill-down backend bridge routes: `GET /api/bridge/approvals`, `GET /api/bridge/tasks`, and `GET /api/bridge/events`.
- Extended `src/server/console-bridge.ts` with limit-clamped approval/task/event list collectors and normalized secret-safe list payloads.
- Verification passed: focused bridge tests, full `pnpm test` (23 files, 81 tests), `pnpm typecheck`, `pnpm lint` (existing font warning only), `pnpm prisma:validate`, `pnpm build`, `pnpm docker:config`, and loopback smoke for summary/approvals/tasks/events on temporary dev port.

## 2026-05-11 — Company Discord spam stopgap

- Disabled repeating Company autonomous/report workers by default through `OPS_CONSOLE_AGENT_WORKER_ENABLED=false` and `OPS_CONSOLE_REPORT_WORKER_ENABLED=false` gates.
- Disabled idle standing-work creation, Hermes bridge execution, Company git publishing, Discord outbox sending/event creation, and direct Company reporter sends unless explicitly re-enabled.
- Removed autonomous prompts/config instructions that told spawned Company agents to post task-complete Discord reports.
- Verification passed: `pnpm typecheck`, `pnpm test` (74 passed), `pnpm lint` (existing font warning only), `hermes --profile company config check`, reporter live-send check returns `company_discord_reporter_disabled`.

## 2026-05-16 — Project/agent conversation surfaces

- Added `src/server/project-conversations.ts`, a derived conversation registry with stable `projectSlug/agentSlug/workstream` thread keys, active Company-scope guard (`ops-console`, `alpha-terminal`), role-profile memory/context ownership, and task/event/artifact message grouping.
- Added `/projects/[id]/conversations` as a Discord-like project thread UI: left reusable thread list, selected conversation pane, message cards, empty/disabled states, and visible `threadPolicy`/`memoryOwner`/`contextOwner` metadata.
- Added a project detail CTA to the conversation surface.
- Routed new operator/HQ/adapter report metadata toward stable reusable project-agent threads, including project slug lookup/propagation for project-scoped instructions and autonomous adapter runs; `trading-agent` remains unsupported for worker execution.
- Verification passed: focused `pnpm vitest run src/server/agent-instructions.test.ts src/server/project-conversations.test.ts src/server/department-adapters.test.ts src/server/hq-orchestration.test.ts` (16 tests), full `pnpm test` (24 files / 86 tests), `pnpm typecheck`, `pnpm lint` (existing `src/app/layout.tsx` custom-font warning only), `pnpm prisma:validate`, and `pnpm build`.
- `pnpm docker:config` did not pass in this shell because `/opt/homebrew/bin/docker` is present but has no `docker compose` subcommand available (`docker: unknown command: docker compose`). No production restart/deploy/routing change was performed.

## 2026-05-20 — Local Agent Control Center `/control`

- Added read-only Local Agent Control Center route `/control` using the Ops Console DB/server layer as the canonical source of truth, not Hermes Workspace state.
- Added `src/server/control-center.ts` to normalize agents, tasks, approvals, artifacts, events, health/deep rows, and scope boundary data for both UI and API use.
- Added `GET /api/control/summary` as a force-dynamic read-only summary API.
- Added sidebar navigation and Korean route label for `/control`.
- Added Control Center CSS for dark-first operational density: bento overview, dense tables, health matrix, approval list, event stream, trace timeline preview, and agent graph preview.
- Design handoff artifacts are saved under `/Users/domclaw/dom-company/design/control-center/`; Company report is saved at `/Users/domclaw/dom-company/docs/hq/ops-console/Local-Agent-Control-Center-2026-05-20.md`.
- Verification passed: `pnpm typecheck`, `pnpm lint`, `pnpm prisma:validate`, `pnpm prisma:generate`, `pnpm test -- --runInBand`, `pnpm build`, `pnpm docker:config`, `/control` curl HTML smoke (`200`, title string present), and `/api/control/summary` JSON smoke (`agents=8`, `healthRows=13`, `events=60`, Worker gateway `stopped by design · 정상`).
- Browser screenshot is blocked in this shell because browser/display tooling is unavailable or times out; no production restart/deploy or write/control action was performed.

## 2026-05-20 — `/control` audited approval actions

- After explicit operator approval, upgraded the `/control` Approval console from drill-down-only to compact audited action controls for pending approvals.
- Reused existing approval API routes (`approve`, `reject`) and `ApprovalActions`; no new high-risk executor, external send, secret access, or browser storage access was added.
- High/critical approvals show a stronger `high-risk · manual gate respected` affordance; approving still follows existing policy and can land in manual handoff instead of direct execution.
- Added `src/components/approval-actions.test.tsx` with RED/GREEN coverage for compact control-center approval controls and API call wiring.
- Verification passed: focused test first failed as expected, then passed; `pnpm typecheck`, `pnpm lint` (existing custom-font warning only), full `pnpm test` (25 files / 87 tests), `pnpm build`, `pnpm docker:config`, and `/control` curl smoke (`200`, title present, approval console present).

## 2026-05-20 — `/control` reference-applied console UI

- Applied the saved agent-console reference direction to `/control`: global command bar, dense observability strip, Agent/Route sidebar, central Session/Run Timeline, Right Inspector, Agent Registry Table, and reference chips for Kiro/FloQast/LaunchDarkly/OpenSea patterns.
- Kept Ops Console DB as the canonical source of truth; no Hermes Workspace state source, schema migration, secret access, external send, deploy, or high-risk action was added.
- Added `src/app/(app)/control/page.reference-ui.test.tsx` to lock the reference-driven layout markers.
- Verification passed: RED/GREEN reference UI test, `pnpm typecheck`, `pnpm lint` (existing custom-font warning only), full discovered `pnpm test` (26 files / 88 tests), `pnpm build`, `pnpm docker:config`, `/control` HTTP smoke (`200`, `110542` bytes, reference markers present), `/api/control/summary` JSON smoke (`agents=8`, `healthRows=13`, `events=60`), and Playwright screenshot visual QA (`/tmp/control-reference-visual-qa.png`, no obvious layout breakage or horizontal overflow).


## 2026-05-20 13:51 KST — production-private `/control` live 반영

- 승인 근거: chamdom `ㅇㅇ 승인함`.
- 반영 방식: `/Users/domclaw/ops-console` 브랜치 `agent/control-center-20260520`에서 `pnpm build` 재실행 후 `.next/standalone`, `.next/static`, `.next/BUILD_ID`만 `/Users/domclaw/ops-console-runtime`에 배포.
- 백업: `/Users/domclaw/ops-console-runtime/.next-backup-control-20260520-134821`.
- restart: `launchctl kickstart -k gui/$(id -u)/ai.company.ops-console.app`.
- live 검증:
  - `/api/health` unauthenticated HTTP 200, deployment `production-private`.
  - `/control` with private operator header HTTP 200, 85890 bytes.
  - `/api/control/summary` with private operator header HTTP 200, agents=8, healthRows=13, events=60.
  - Worker gateway health row: `stopped`, note `stopped by design · 정상`.
  - Playwright visual QA: `/tmp/control-live-visual-qa.png`, no horizontal overflow, command center layout 확인.
- schema/API 변경: 없음. 기존 `/api/control/summary`와 approval API 유지.
- secret/cookie/token/browser storage 접근: 없음.
## 2026-05-20 — AgentOps Control Plane hardening branch

- Branch/worktree: `/tmp/ops-agentops-upgrade` on `feat/agentops-control-plane-upgrade`; main branch was not edited directly.
- Centralized write authorization and audit helpers in `src/lib/write-rbac.ts`; write APIs now use RBAC checks and audited Events for agent actions, instructions, approval decisions, harness rollback/regression, ingest run, and command compile.
- Added Policy table enforcement path in `src/server/policy-enforcement.ts` and wired it into command execution before scope/external-send execution. Missing/unreachable Policy DB falls back to deterministic default policy for tests and safe operation.
- Added canonical DB-backed agent registry helper in `src/server/agent-registry.ts`; Hermes Workspace state is not a canonical source.
- Replaced ad-hoc harness output checks with AJV JSON Schema validation while preserving semantic verifier failure classes such as `NO_TEST` and `NO_EVIDENCE`.
- Added real trace detail route `/traces/[traceId]` backed by Event, Task, Approval, CommandQueue, Run/Step, ModelCall, ToolCall, and Verification records.
- Extended `/agents/[id]` with harness management visibility for versions, evals, and failures.
- Connected `/control` command bar to Command Compiler MVP via `POST /api/control/command/compile`, with compile/queue/policy decision/audit behavior.
- Converted local system monitor and `/control` summary to probe-backed local system status and ModelCall/ToolCall aggregate cost/token/latency metrics.
- Strengthened command and agent workers with bounded iteration loops for queue draining.
- Verification passed before PR: focused command/harness regression, full `pnpm test` (34 files / 109 tests), `pnpm typecheck`, `pnpm lint` (existing custom-font warning only), and `pnpm build`.
- Runtime deploy/PR/Ops records are still pending until branch is committed, reviewed, merged, and smoke-tested against the private runtime.
- Secret/token/cookie/browser storage/DB URL values were not read or recorded; only non-secret placeholder DB connection strings were used for local verification.

