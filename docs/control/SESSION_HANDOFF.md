## Latest ops handoff — 2026-05-21 20:17 KST

Resolved the remaining orchestration-state risk by adding real TaskStatus enum values instead of using `queued` as a delegated parent fallback.

Changed:

- `prisma/schema.prisma` and migration `20260521110500_add_orchestration_task_statuses` — added `waiting_children`, `aggregation_pending`, and `awaiting_verifier` to `TaskStatus`.
- `src/server/ops-monitor.ts` / `.test.ts` — parent runtime transitions now persist explicit statuses: child execution => `waiting_children`, all children terminal/aggregation open => `aggregation_pending`, aggregation complete but verifier missing => `awaiting_verifier`, verifier passed => `completed`.
- `src/server/autonomy-orchestration.ts` / `.test.ts` — dispatch and aggregation planning now emit explicit parent statuses.
- `src/server/control-center.ts`, `src/lib/korean-labels.ts`, `src/lib/project-workspace.ts`, `src/components/status-badge.tsx`, `src/components/project-workspace.tsx` and tests — UI/projection helpers understand the new non-running parent states.
- `docs/control/DECISIONS.md` and `docs/control/PROGRESS.md` — replaced the old queued-fallback note with the explicit status model.

Runtime/deploy:

- Synced source to `/Users/domclaw/ops-console-runtime`, preserving runtime `.env`.
- Applied Prisma migration with `pnpm prisma:deploy`.
- Rebuilt runtime and restarted `ai.company.ops-console.app`; proxy health stayed OK.
- Ran `syncHqOrchestrationRuntime()` once after migration. Existing parents now show `aggregation_pending` / `awaiting_verifier`; `main-agent` and `hq-agent` remain idle/currentTask null.

Verification:

- RED confirmed first: updated ops-monitor expectations failed while code still returned `queued`.
- Full source verification passed: `pnpm test` — 35 files / 119 tests.
- `pnpm typecheck` passed.
- `pnpm build` passed.
- `pnpm prisma:validate` passed.
- `pnpm docker:config` passed.
- `pnpm lint` passed with the existing custom-font warning only.
- Runtime migration/build/health passed: `127.0.0.1:3000/api/health`, `127.0.0.1:3010/api/health`, and `/control` returned 200 after restarting the app service with regenerated Prisma client.

Safety:

- No public bind/routing change.
- No verifier bypass; `awaiting_verifier` remains non-completed.
- Secret/token/cookie/browser-storage/private key/DB URL values were not printed or logged.

## Latest ops handoff — 2026-05-21 20:02 KST

Fixed the HQ/main orchestration runtime regression where parent tasks and parent agents returned to `running` while delegated child tasks were still executing.

Changed:

- `src/server/ops-monitor.ts` / `.test.ts` — extracted runtime transition planning, changed child-in-progress parent target from `running` to delegated/waiting equivalent (`queued` + metadata/nextAction because `TaskStatus` has no `waiting_children`), forces parent HQ/main agent to `idle/currentTask=null`, creates queued aggregation task when all child tasks are terminal, and prevents parent completion before aggregation verifier evidence.
- `src/server/autonomy-orchestration.ts` / `.test.ts` — dispatch plan now records parent as waiting for children, not running; aggregation plan creates queued aggregation work and leaves main-agent idle until the queued aggregation task is actually picked up.
- `src/server/control-center.ts` — active task derivation ignores delegated orchestration parents so HQ/main agents do not look busy during child execution.
- `src/lib/korean-labels.ts` / `.test.ts` — added operational task status label and child progress label helpers for delegated parents.
- `src/app/(app)/control/page.tsx` and `src/app/(app)/tasks/[id]/page.tsx` — parent rows/details show delegated/waiting state and child terminal progress count instead of raw `running`.
- `docs/control/DECISIONS.md` and `docs/control/PROGRESS.md` — recorded the non-running parent orchestration model and verifier-gated aggregation boundary.

Runtime/deploy:

- Synced source to `/Users/domclaw/ops-console-runtime`, preserving runtime `.env`.
- Rebuilt runtime and restarted/kickstarted private app/proxy services.
- Ran runtime `syncHqOrchestrationRuntime()` once; reconciled existing orchestration parents into aggregation-pending delegated state and queued aggregation tasks.
- No Prisma schema migration and no public bind/routing change.

Verification:

- Focused tests passed: `pnpm test -- src/server/ops-monitor.test.ts src/server/autonomy-orchestration.test.ts src/lib/korean-labels.test.ts`.
- Full source verification passed: `pnpm test` — 35 files / 119 tests.
- `pnpm typecheck` passed.
- `pnpm build` passed.
- `pnpm lint` passed with existing custom-font warning only.
- Runtime build passed.
- Health smoke passed: `GET http://127.0.0.1:3000/api/health`, `GET http://127.0.0.1:3010/api/health`.
- `/control` private proxy marker smoke passed.
- Runtime DB smoke shows `main-agent` and `hq-agent` idle/currentTask null after reconcile.

Safety:

- Parent completion remains blocked until aggregation verifier evidence exists.
- Discord stays report-only; no routine child progress reports were added.
- Secret/token/cookie/browser-storage/private key/DB URL values were not printed or logged.

## Latest ops handoff — 2026-05-21 15:44 KST

Fixed the Project Workspace role-card readability regression shown in the operator screenshot.

Changed:

- `src/components/project-workspace.tsx` — role title/agent now live in `.workspace-role-primary`; status badge moved to `.workspace-role-status` below the title row so badges no longer squeeze labels.
- `src/app/globals.css` — role grid now uses responsive `auto-fit` card columns instead of a forced 7-column row; card/ring spacing increased; horizontal role-grid scroll removed.
- `src/components/project-workspace.test.tsx` — regression test for title/status separation.

Runtime/deploy:

- Applied the same patch to `/Users/domclaw/ops-console-runtime`.
- Rebuilt runtime and restarted `ai.company.ops-console.app` only.
- No Prisma schema migration and no public bind/routing change.

Verification:

- Source: `pnpm test:unit` passed, `pnpm typecheck` passed, `pnpm lint` passed with existing custom-font warning only, `pnpm prisma:validate` passed, `pnpm docker:config` passed, `pnpm build` passed.
- Runtime: `pnpm test:unit` passed, `pnpm typecheck` passed, `pnpm prisma:validate` passed, `pnpm docker:config` passed, `pnpm build` passed, `GET http://127.0.0.1:3000/api/health` passed.
- Runtime lint remains blocked by pre-existing generated backup files under `.next-backup-control-20260520-134821`; source lint is clean except the existing font warning.
- Playwright live check on `/projects/cmoss0dt5000v2g0j6c9f9dun`: `bodyOverflowX: 0`, `clippedLabels: []`, screenshot `/tmp/project-workspace-fixed.png`.

Safety:

- UI-only change; no secret/token/cookie/browser-storage values inspected or logged.

## Latest ops handoff — 2026-05-21 12:15 KST

Implemented, verified, and deployed Autonomy Governor + audited Control Center intervention.

Changed:

- `src/server/autonomy-governor.ts` / `.test.ts` — L0–L6 autonomy levels and decision function for `allow_auto`, `allow_plan_only`, `require_approval`, `require_manual_handoff`, `block`, `pause_scope`, and `escalate_hq`.
- `src/server/autonomy-orchestration.ts` / `.test.ts` — HQ parent `delegated/waiting_children`, main/HQ idle-after-dispatch, child-terminal aggregation planning.
- `src/server/agent-autonomy.ts` — autonomous task execution now consults Governor and creates Ops Console approval/manual handoff instead of auto-running high/critical or forbidden work.
- `src/server/agent-instructions.ts` / `hq-orchestration.ts` — parent/child state flow and concise delegation-completed Discord reporting.
- `src/server/agent-control.ts`, `src/app/api/agents/[id]/actions/route.ts`, `src/server/command-executor.ts` — CommandQueue-backed pause/resume/cancel/reprioritize/reassign/scope-limit; rollback/restart/kill stay approval-gated.
- `src/server/control-center.ts`, `src/app/(app)/control/page.tsx`, `src/components/live-intervention-panel.tsx` — Autonomy Dashboard, Policy Matrix, Live Intervention Panel, Pending Human Decisions.

Runtime/deploy:

- Synced source to `/Users/domclaw/ops-console-runtime`, preserving runtime `.env`.
- Rebuilt runtime and restarted `ai.company.ops-console.app` only; no public bind/routing change.
- No Prisma schema migration.

Verification:

- Focused tests passed: Autonomy Governor/orchestration/control/command/HQ/autonomy tests, 29 tests.
- Full `pnpm test` passed: 32 files / 109 tests.
- `pnpm typecheck` passed.
- `pnpm lint` passed with existing custom-font warning only.
- `pnpm build` passed.
- `pnpm prisma:validate` passed.
- Runtime health passed: `GET http://127.0.0.1:3000/api/health`.
- `/control` rendered Autonomy Dashboard, Live Intervention Panel, Autonomy Policy Matrix, Pending Human Decisions with private operator header.
- Intervention API smoke queued a `scope-limit` command, then cleaned up the smoke command/event and restored the agent state.

Safety:

- High/critical risk auto execution is blocked by tests and Governor logic.
- Discord remains report-only, not an approval surface.
- Secret/token/cookie/browser storage/DB URL/private key values were not inspected or logged.

## Latest ops handoff — 2026-05-21 10:54 KST

Closed the remaining Discord gap: Company Discord `main-agent` now has an opt-in gateway hook that mirrors prefixed main-channel project instructions into Ops Console.

Changed:

- Hermes source: `gateway/platforms/discord.py` adds `discord.ops_console_intake` hook on Discord processing start.
- Hermes source: `gateway/config.py` bridges `discord.ops_console_intake` from profile config into adapter `extra`.
- Company profile config: enabled hook only for main-agent channel `1503190214439600228` with safe prefixes `프로젝트:`, `새 프로젝트:`, `/project `.
- Target endpoint: local/private `http://127.0.0.1:3000/api/discord/main-agent/goals`.
- Operator identity is non-secret local service identity `company-discord-main@local`.

Verification:

- `python3 -m py_compile gateway/platforms/discord.py gateway/config.py` passed.
- `hermes --profile company config check` passed.
- `hermes --profile company gateway restart` succeeded; gateway running PID `59712`.
- Synthetic Discord main-channel hook smoke created Project + HQ parent + 7 role-agent child tasks through the real Ops Console endpoint, then smoke rows were deleted.

Usage:

- In Discord main-agent channel, start a new tracked project with: `프로젝트: <지시 내용>` or `새 프로젝트: <지시 내용>`.
- Normal main-channel chatter does not create projects, to avoid DB spam.

## Latest ops handoff — 2026-05-21 10:47 KST

Implemented and deployed full New Project intake + HQ/Discord auto-distribution path.

Changed:

- `src/server/project-intake.ts` — Project Router intake helper: normalizes name/slug/instruction, records `projectSlug`, `workstream`, `ownerAgentSlug`, `threadKey`, and calls HQ orchestration.
- `src/server/project-intake.test.ts` — regression tests for Ops Console and Discord main-agent intake metadata.
- `src/app/api/projects/route.ts` — authenticated Ops Console project registration endpoint.
- `src/app/api/discord/main-agent/goals/route.ts` — authenticated Discord/main-agent intake endpoint using the same project registration + HQ distribution path.
- `src/components/new-project-form.tsx` and `src/app/(app)/projects/new/page.tsx` — live New Project UI.
- `src/app/(app)/projects/page.tsx` — `+ New project` now opens `/projects/new`.
- `src/server/agent-instructions.ts` / `src/server/hq-orchestration.ts` — safe HQ intake creates a running parent task plus queued role-agent child tasks; millisecond run IDs prevent same-second slug collisions; delegation events now carry project conversation metadata.

Runtime/deploy:

- Synced source to `/Users/domclaw/ops-console-runtime`, preserving runtime `.env`.
- Rebuilt runtime and restarted app/proxy.
- No Prisma schema migration.
- No public bind/routing change.
- External/deploy/wallet/trading/paid/public/high/critical work remains approval-gated.

Verification:

- Source focused tests passed: `project-intake`, `hq-orchestration`, `agent-instructions`.
- Source `pnpm typecheck` passed.
- Source `pnpm build` passed.
- Source `pnpm lint` passed with the existing custom-font warning only.
- Runtime focused tests passed: 5 files / 16 tests.
- Runtime `pnpm typecheck` and `pnpm build` passed.
- Runtime health passed: `GET http://127.0.0.1:3000/api/health`.
- `/projects/new` marker smoke passed.
- `POST /api/projects` smoke created Project + HQ parent + 7 child tasks, then smoke rows were deleted.
- `POST /api/discord/main-agent/goals` smoke created Project + HQ parent + 7 child tasks, then smoke rows were deleted.
- Live sidebar parse still exactly `['Control', '프로젝트']`.

## Latest ops handoff — 2026-05-21 10:41 KST

Created Card News Dashboard docs-agent verifier artifact.

Changed:

- `/Users/domclaw/ops-console/artifacts/ops-console/card-news-dashboard/VERIFIER_REPORT.md` — final plan, verifier checklist, PASS/BLOCKED criteria, hq-agent risk boundary.
- `/Users/domclaw/ops-console/docs/INDEX.md` — artifact link.
- `/Users/domclaw/ops-console/docs/control/PROGRESS.md` — progress entry.
- `/Users/domclaw/dom-company/docs/INDEX.md` — Company wiki link.
- `/Users/domclaw/dom-company/log.md` — log entry.

Verification:

- File readback passed for verifier report, Ops Console `docs/INDEX.md`, Company `log.md`, and this handoff entry.
- No app code/schema/runtime changes; no deploy/restart/external send/secret access.

## Latest ops handoff — 2026-05-21 10:26 KST

Fixed deployment regression where retired standalone menu items reappeared.

Root cause:

- The deploy used broad source-to-runtime `src/` sync.
- The source repo still had resurrected standalone route/menu code from older/untracked work.
- That overwrote the runtime deletion boundary: `SidebarNav` no longer used `operatorNavigationItems`, and runtime-only `src/lib/operator-navigation.ts` was removed by `--delete`.

Fix:

- Restored `src/lib/operator-navigation.ts` and its regression test.
- Restored sidebar to canonical operator surfaces only: `Control`, `프로젝트`.
- Removed retired standalone route directories: agents, approvals, artifacts, dashboard, events, policies, reports, settings.
- Redirected `/` to `/control` and changed stale links to `/control` anchors.
- Rebuilt/redeployed runtime and restarted app/proxy.

Verification:

- Focused tests passed: `src/lib/operator-navigation.test.ts`, `src/lib/project-workspace.test.ts`.
- `pnpm typecheck` passed.
- `pnpm build` passed.
- Runtime health passed.
- Live nav parse from `/control` returned exactly `['Control', '프로젝트']`.

## Latest ops handoff — 2026-05-21 10:19 KST

Deployed approved Project Workspace v1 to production-private runtime and restarted Ops Console services.

Deployment:

- Source synced from `/Users/domclaw/ops-console` to `/Users/domclaw/ops-console-runtime` for app-relevant paths, preserving runtime `.env`.
- Runtime start script now resolves its own app dir via `OPS_CONSOLE_APP_DIR` fallback instead of hardcoding the source repo path.
- Runtime rebuild passed: `pnpm prisma:validate`, `pnpm docker:config`, `pnpm build`.
- Restarted launchd services: `ai.company.ops-console.app`, `ai.company.ops-console.proxy`, `ai.company.ops-console.command-worker`, `ai.company.ops-console.agent-worker`, `ai.company.ops-console.report-worker`.

Live verification:

- `GET http://127.0.0.1:3000/api/health` passed.
- `GET http://127.0.0.1:3010/api/health` passed.
- `GET http://127.0.0.1:3000/projects/cmoss0dt5000v2g0j6c9f9dun` with private operator header rendered `Project Workspace`, role bubbles, and honest sync label.
- Final states: app/proxy/command-worker/agent-worker/report-worker all `running`.

Runtime/safety:

- No public bind/routing change.
- No credential/token/cookie/browser-storage access.
- No Prisma schema migration added for this Project Workspace slice.

## Latest ops handoff — 2026-05-21 09:53 KST

Implemented approved Project Workspace v1 as a read-only project detail vertical slice.

Changed in `/Users/domclaw/ops-console`:

- `src/lib/project-workspace.ts` — pure role-bubble/progress projection from Project/Task/Approval/Artifact data.
- `src/lib/project-workspace.test.ts` — regression tests for seven bubbles, empty roles, progress, and blocker/failure priority.
- `src/components/project-workspace.tsx` — Project Workspace hero + role-agent bubble grid.
- `src/app/(app)/projects/[id]/page.tsx` — project detail now loads tasks/artifact agents and renders Project Workspace above approvals/artifacts.
- `src/app/globals.css` — responsive workspace/progress/role-ring styles.
- `src/lib/korean-labels.ts` — labels for unassigned/offline/waiting role states.
- `docs/control/DECISIONS.md`, `docs/control/PROGRESS.md`, `docs/control/SESSION_HANDOFF.md` — documentation updates.

Verification:

- `pnpm exec vitest run src/lib/project-workspace.test.ts` passed.
- `pnpm test` passed: 28 files / 94 tests.
- `pnpm typecheck` passed.
- `pnpm lint` passed with existing custom-font warning only.
- `pnpm prisma:validate` passed.
- `pnpm build` passed.
- `pnpm docker:config` passed.
- Temporary runtime smoke on port 3100: `/api/health` OK and `/projects/cmoss0dt5000v2g0j6c9f9dun` with private operator header rendered Project Workspace markers.

Runtime/safety:

- No Prisma schema migration.
- No production-private launchd restart/deploy.
- No public bind/routing change.
- No new executor/management action.
- No credential/token/cookie/browser-storage access.

## Latest ops handoff — 2026-05-20 13:51 KST

Reflected `/control` reference console update to production-private runtime after chamdom approval.

Changed in runtime:

- Runtime path: `/Users/domclaw/ops-console-runtime`.
- Deployed build artifacts only: `.next/standalone`, `.next/static`, `.next/BUILD_ID` from `/Users/domclaw/ops-console` branch `agent/control-center-20260520`.
- Backup before overwrite: `/Users/domclaw/ops-console-runtime/.next-backup-control-20260520-134821`.
- LaunchAgent restarted: `ai.company.ops-console.app` via `launchctl kickstart -k`, final state `running`.

Live verification:

- `GET http://127.0.0.1:3000/api/health` → 200, deployment `production-private`.
- `GET http://127.0.0.1:3000/control` with private operator header → 200, 85890 bytes, reference UI markers present.
- `GET http://127.0.0.1:3000/api/control/summary` with private operator header → 200, agents=8, healthRows=13, events=60.
- Worker gateway health row remains `stopped` with note `stopped by design · 정상`.
- Playwright live visual QA screenshot: `/tmp/control-live-visual-qa.png`, no horizontal overflow.

Runtime/safety:

- No Prisma schema migration.
- No public bind/routing change.
- No new executor/management action/command palette execution.
- No credential/token/cookie/browser-storage access.

## Latest ops handoff — 2026-05-20 13:30 KST

Applied saved agent-console references to `/control` UI.

Changed in `/Users/domclaw/ops-console`:

- `src/app/(app)/control/page.tsx` — added Global Command Bar, Observability Strip copy, Agent/Route rail, Session/Run Timeline, Right Inspector, and reference labels.
- `src/app/globals.css` — added command bar, three-column console frame, route rail, session row, and inspector styles with responsive collapse.
- `src/app/(app)/control/page.reference-ui.test.tsx` — new jsdom/RTL reference-layout regression test.
- `docs/control/DECISIONS.md`, `docs/control/PROGRESS.md`, `docs/control/SESSION_HANDOFF.md` — documentation updates.

Verification:

- Reference UI test passed: `pnpm vitest run 'src/app/(app)/control/page.reference-ui.test.tsx'`.
- `pnpm typecheck` passed.
- `pnpm lint` passed with existing custom-font warning only.
- `pnpm test -- 'src/app/(app)/control/page.reference-ui.test.tsx' src/components/approval-actions.test.tsx src/server/control-center.test.ts` passed full discovered suite: 26 files / 88 tests.
- `pnpm build` passed.
- `pnpm docker:config` passed.
- `/control` smoke passed: HTTP 200, 110542 bytes, reference markers present.
- `/api/control/summary` smoke passed: `summary.agents=8`, `healthRows=13`, `events=60`.
- Playwright visual QA screenshot saved at `/tmp/control-reference-visual-qa.png`; visual review found dark-first command center layout, command bar, observability strip, route rail, session/run list, right inspector, agent registry table, and no obvious layout breakage/horizontal overflow.

Runtime/safety:

- No Prisma schema migration.
- No production-private launchd restart/deploy.
- No public bind or routing change.
- No new executor/management action/command palette execution.
- No credential/token/cookie/browser-storage access.

## Latest ops handoff — 2026-05-20 12:11 KST

Added approved compact audited approval controls directly inside `/control`.

Changed in `/Users/domclaw/ops-console`:

- `src/components/approval-actions.tsx` — added `variant="compact"` and high-risk manual-gate copy for Control Center usage.
- `src/components/approval-actions.test.tsx` — new jsdom/RTL test for compact audited approval controls and API wiring.
- `src/app/(app)/control/page.tsx` — pending approvals now render inline compact approve/reject controls while keeping detail links.
- `src/app/globals.css` — compact decision bar and approval row layout styles.
- `docs/control/DECISIONS.md`, `docs/control/PROGRESS.md`, `docs/control/SESSION_HANDOFF.md` — documentation updates.

Verification:

- RED test failed before implementation: compact controls were absent.
- GREEN focused test passed: `pnpm vitest run src/components/approval-actions.test.tsx`.
- `pnpm typecheck` passed.
- `pnpm lint` passed with existing custom-font warning only.
- `pnpm test -- src/components/approval-actions.test.tsx src/server/approvals.test.ts` passed full discovered suite: 25 files / 87 tests.
- `pnpm build` passed.
- `pnpm docker:config` passed.
- `/control` curl smoke passed: HTTP 200, 101498 bytes, title present, approval console present.

Runtime/safety:

- No Prisma schema migration.
- No production-private launchd restart/deploy.
- No public bind or routing change.
- No new executor or high-risk bypass. Existing approval APIs still enforce manual handoff for external/high-risk actions.
- No credential/token/cookie/browser-storage access.


## Latest ops handoff — 2026-05-20 11:58 KST

Implemented Local Agent Control Center `/control` on branch `agent/control-center-20260520`.

Changed in `/Users/domclaw/ops-console`:

- `src/server/control-center.ts` — read-only server aggregation for control center summary.
- `src/app/(app)/control/page.tsx` — new Control Center UI route.
- `src/app/api/control/summary/route.ts` — force-dynamic JSON summary API.
- `src/app/globals.css` — Control Center dark operations UI styles.
- `src/components/sidebar-nav.tsx` — `/control` sidebar entry.
- `src/lib/korean-labels.ts` — `control: "컨트롤"`.
- `docs/control/DECISIONS.md`, `docs/control/PROGRESS.md`, `docs/control/SESSION_HANDOFF.md` — documentation updates.

Changed in `/Users/domclaw/dom-company`:

- `design/control-center/handoff.md`
- `design/control-center/reference-board.md`
- `design/control-center/design-tokens.md`
- `design/control-center/component-specs.md`
- `docs/hq/ops-console/Local-Agent-Control-Center-2026-05-20.md`
- `docs/INDEX.md`
- `log.md`

Verification:

- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm prisma:validate && pnpm prisma:generate && pnpm test -- --runInBand` passed.
- `pnpm build` passed.
- `pnpm docker:config` passed.
- `/control` curl HTML smoke passed: HTTP 200, 101503 bytes, `로컬 에이전트 관제센터` present.
- `/api/control/summary` curl JSON smoke passed: `summary.agents=8`, `healthRows=13`, `events=60`, Worker gateway row is `stopped` with note `stopped by design · 정상`.

Runtime/safety:

- No Prisma schema migration.
- No production-private launchd restart/deploy.
- No public bind or routing change.
- No write/control/approval execution action added.
- No credential/token/cookie/browser-storage access.
- Browser screenshot remains blocked by local browser/display constraints; use curl HTML/API evidence until visual QA is available.

Next recommended work:

1. Re-run browser visual QA/screenshot from a display-capable environment.
2. P1: full trace viewer, interactive collaboration graph, incident center, cost/latency/token dashboard.
3. P2: audited management actions and command palette only after explicit approval.

# Session Handoff

## Latest ops handoff — 2026-05-14 22:37 KST

Workspace console read-only bridge now includes command queue and active agents.

Changed in `/Users/domclaw/ops-console`:

- `src/server/console-bridge.ts`
  - Added `getConsoleBridgeCommands` and `getConsoleBridgeAgents`.
  - Command bridge intentionally omits raw `payload` and `result`.
  - Agent bridge intentionally omits raw `metadata`.
- `src/server/console-bridge.test.ts`
  - Added secret-safe command/agent assertions.
- `src/app/api/bridge/commands/route.ts`
- `src/app/api/bridge/agents/route.ts`

Changed in `/Users/domclaw/hermes-workspace`:

- `src/server/company-console-summary.ts`
  - Added command and agent list normalization.
- `src/server/company-console-summary.test.ts`
- `src/routes/api/company-console/commands.ts`
- `src/routes/api/company-console/agents.ts`
- `src/screens/dashboard/components/company-console-summary-card.tsx`
  - Added `Command queue` and `Active agents` panels.
- `src/screens/dashboard/components/company-console-summary-card.test.tsx`
- `src/routeTree.gen.ts`

Verification:

- ops-console focused bridge tests: 3/3 passed.
- ops-console full `pnpm test`: 23/23 files, 82/82 tests passed.
- ops-console `pnpm typecheck`, `pnpm lint`, `pnpm prisma:validate`, `pnpm build`, `pnpm docker:config`: passed. Lint still has the existing custom-font warning only.
- Workspace focused collector/UI tests: 2 files, 6/6 tests passed.
- Workspace full `pnpm test`: 105/105 files, 679/679 tests passed.
- Workspace `pnpm build`: passed.
- Temp loopback smoke on `127.0.0.1:3022`: summary/approvals/tasks/events/commands/agents passed; temp server killed and no listener remained.
- Direct Workspace collector smoke against temp backend for commands/agents passed.

Runtime/safety:

- No production-private app restart/deploy.
- No Tailnet routing change.
- No public bind.
- No write action exposed.
- No approve/reject/manual-submit/retry/pause/resume implementation.
- No credential/token/API key output.

Next safe read-only work:

1. Artifact/detail timeline viewer.
2. Project-level and task-level detail routes/views.
3. Parallel-operation deployment plan. Do not restart live production-private services without explicit approval.

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

## Latest dev handoff — 2026-05-09 07:06 KST

Completed a safe internal observability hardening pass for artifact previews.

Changed files:

- `src/server/task-observability.ts`: artifact preview allowlist now uses exact-root-or-descendant matching via `path.sep`, not raw string prefix matching.
- `src/server/task-observability.test.ts`: added regression coverage for `/Users/domclaw/ops-console-archive` and `/Users/domclaw/dom-company-malicious` sibling-prefix paths.
- `docs/control/PROGRESS.md`: recorded validation results.
- `docs/control/SESSION_HANDOFF.md`: this handoff entry.

Verification passed:

- `pnpm install --frozen-lockfile`
- `pnpm lint` (passes with existing `src/app/layout.tsx` custom font warning)
- `pnpm typecheck`
- `pnpm test` (22 files, 74 tests)
- `pnpm prisma:validate`
- `pnpm build`
- `pnpm docker:config`

Next recommended work:

- Consider moving artifact preview roots into a central config if more safe roots are added.
- The existing Next font lint warning can be cleaned separately; it is unrelated to this change.

## Latest ops handoff — 2026-05-14 15:55 KST

Added the first Kanban DB-centered Company worker flow.

Changed files:

- `/Users/domclaw/dom-company/scripts/company_kanban.py`: namespaced SQLite adapter for `~/.hermes/kanban.db` with `company_tasks` and `company_task_events`.
- `/Users/domclaw/ops-console/src/server/hermes-bridge.ts`: builds Kanban payloads and syncs `ready → running → review` or `blocked` during Hermes worker handoff.
- `/Users/domclaw/ops-console/src/server/agent-autonomy.ts`: stores Kanban sync metadata in Hermes completion/failure events.
- `/Users/domclaw/ops-console/src/app/(app)/tasks/[id]/page.tsx`: shows Kanban sync metadata on task detail.
- `/Users/domclaw/ops-console/src/server/hermes-bridge.test.ts`: added Kanban prompt/payload coverage.
- `/Users/domclaw/dom-company/docs/system/Company-Kanban-DB-Operating-Guide-2026-05-14.md`: operating guide.
- `/Users/domclaw/dom-company/shared/templates/company-task-card-template.md`: added Kanban metadata fields and review rule.
- Updated control docs and Company index/log/runbook.

Important behavior:

- Current installed Hermes CLI has no native `hermes kanban` command, and `~/.hermes/kanban.db` was absent; this adapter creates namespaced Company tables without assuming a future native schema.
- Worker success moves Kanban status to `review`, not `done`; `main`, `project`, or `hq` must accept the task.
- `trading-agent` remains unsupported.
- Broad automation/env gates remain off unless explicitly enabled.

Verification passed:

- `python3 -m py_compile scripts/company_kanban.py`
- `scripts/company_kanban.py init`
- temp DB smoke: upsert → status running → list
- `pnpm test src/server/hermes-bridge.test.ts` — 7 tests passed
- `pnpm typecheck` — passed

Next recommended work:

- Run full Ops Console verification and restart app after final doc pass.
- Add Kanban board UI columns by `ready/running/review/blocked/done`.
- Add review actions: `review → done` or `review → blocked`.

## Latest ops handoff — 2026-05-14 14:27 KST

Added task-detail observability for Hermes/Company worker runs.

Changed files:

- `src/app/(app)/tasks/[id]/page.tsx`: now shows report path, `.run.json` path/content, return code, `output_mode`, stderr count, git-publish state, bridge stdout, separated Hermes CLI transcript, and artifact previews.
- `src/server/task-observability.ts`: added Hermes sidecar helpers for `.run.json` and `<output>.stdout.log`, while retaining allowlisted local path preview behavior.
- `src/server/task-observability.test.ts`: added regression tests for Hermes sidecar path derivation and `stdout_log_path` metadata handling.
- `docs/control/DECISIONS.md`, `docs/control/PROGRESS.md`, `docs/control/SESSION_HANDOFF.md`: documented this UI/observability step.

Runtime actions:

- Restarted `ai.company.ops-console.app`.
- Verified `GET /api/health` on `127.0.0.1:3000` returned OK.
- Verified `/tasks/cmp514jxo00012g1xhjz0ff6x` with `x-ops-operator-email` renders the new sections: `Hermes 실행 결과`, `run.json`, `Hermes CLI transcript`, and `산출물 프리뷰`.

Verification passed:

- `pnpm test src/server/task-observability.test.ts` — 5 tests passed.
- `pnpm test` — 22 files, 78 tests passed.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed with existing `src/app/layout.tsx` font warning only.
- `pnpm prisma:validate` — passed.
- `pnpm build` — passed.
- `pnpm docker:config` — passed.
- Live `curl http://127.0.0.1:3000/api/health` — OK.

Next recommended work:

- Add a small report-quality validator for worker reports before showing them as clean success.
- Keep broad autonomous execution gated; use one-shot or narrow `design-agent`/`docs-agent` runs only until report quality and UI review are comfortable.

## Latest ops handoff — 2026-05-14 13:48 KST

Connected Ops Console to dom-company worker-profile handoff.

Changed files:

- `src/server/hermes-bridge.ts`: Hermes execution now writes a task-card prompt and invokes `/Users/domclaw/dom-company/scripts/company_worker_handoff.py --role <worker> --execute --output <role>/ops-console-runs/<task>.md`; it no longer calls the `company` Discord gateway profile directly.
- `src/server/agent-autonomy.ts`: autonomous worker allowlist removes `trading-agent` and adds `design-agent`.
- `src/server/agent-capabilities.ts` and `src/server/department-adapters.ts`: added `design.handoff_review`; removed trading signal adapter support.
- `src/server/idle-work-planner.ts`, `src/server/hq-orchestration.ts`, `src/lib/agent-visibility.ts`: design worker included in planning/order, trading worker removed from active Company department routing.
- `prisma/seed.ts`: seeds `design-agent`.
- Tests updated for design worker support and trading worker unsupported behavior.
- `docs/control/DECISIONS.md`, `docs/control/PROGRESS.md`, `docs/control/SESSION_HANDOFF.md`: documented this bridge.

Runtime actions:

- Ran `pnpm prisma:seed`; live DB now includes `design-agent` and no `trading-agent` row from seed.
- Restarted `ai.company.ops-console.app` and `ai.company.ops-console.agent-worker`; `GET /api/health` returned OK.
- Env gates remain the safety controls: Hermes execution still requires `OPS_AGENT_HERMES_EXEC_ENABLED=true`; repeating agent worker still requires `OPS_CONSOLE_AGENT_WORKER_ENABLED=true`; Discord outbox/report sends remain opt-in.

Verification passed:

- `pnpm lint` — passed with existing `src/app/layout.tsx` font warning only.
- `pnpm typecheck` — passed.
- `pnpm test` — 22 files, 76 tests passed.
- `pnpm prisma:validate` — passed.
- `pnpm build` — passed.
- `pnpm docker:config` — passed.
- `pnpm prisma:seed` — passed.
- Live `curl http://127.0.0.1:3000/api/health` — OK.

Next recommended work:

- If you want live autonomous execution, enable only after confirming the current env gates, then run one Ops Console low-risk `design-agent` or `docs-agent` instruction and inspect the generated `dom-company/<role>/ops-console-runs/*.md` + `.run.json` before enabling broader standing work.
- Keep `trading-agent` unsupported in Ops Console; Crypto Signal remains separate.

## Latest ops handoff — 2026-05-11 18:18 KST

Stopped the Discord spam path shown in Company channels.

Changed files/config:

- `src/server/hermes-bridge.ts`: spawned Company agents are explicitly told not to post to Discord/Slack/Telegram; output stays in Ops Console/files.
- `src/server/agent-autonomy.ts`: idle standing work and `discord.report.queued` event creation are env-gated off by default.
- `ops/mac-mini/start-agent-worker.sh`: repeats only when `OPS_CONSOLE_AGENT_WORKER_ENABLED=true`; otherwise sleeps disabled.
- `ops/mac-mini/start-report-worker.sh`: repeats only when `OPS_CONSOLE_REPORT_WORKER_ENABLED=true`; otherwise sleeps disabled.
- `~/.hermes/profiles/company/config.yaml`: removed per-channel instructions telling agents to run `company_discord_report.py` on every completion.
- `~/.hermes/profiles/company/scripts/company_discord_report.py`: live sends and thread creation require `OPS_COMPANY_DISCORD_REPORTER_ENABLED=true`.
- Env flags set false in `/Users/domclaw/ops-console/.env` and Company profile `.env`: agent worker, report worker, auto work, Hermes execution, git publish, Discord outbox send/event creation, direct reporter send.

Verification passed:

- `pnpm typecheck`
- `pnpm test` (22 files, 74 tests)
- `pnpm lint` (existing `src/app/layout.tsx` custom font warning only)
- `hermes --profile company config check`
- direct reporter live-send attempt returns `company_discord_reporter_disabled` without posting.

Current caveat:

- LaunchAgents for agent/report worker remain loaded but are in disabled sleep mode. Re-enable only with explicit operator approval by flipping the env gates.

## Latest ops handoff — 2026-05-14 21:50 KST

Added the read-only bridge slice for moving Ops Console surfaces into Hermes Workspace.

Changed files:

- `src/server/console-bridge.ts`: summarizes pending approvals, blocked/waiting tasks, critical events, queued/running commands, and active agents.
- `src/app/api/bridge/summary/route.ts`: exposes the summary through the existing private operator auth header path.
- `src/server/console-bridge.test.ts`: covers read-only summary normalization.
- `docs/control/DECISIONS.md` and `docs/control/PROGRESS.md`: record Workspace-as-shell / Ops Console-as-backend migration behavior.

Runtime actions:

- Started a temporary dev server on `127.0.0.1:3022` only for loopback smoke.
- Verified `GET /api/bridge/summary` with `x-ops-operator-email` returned HTTP 200 and counts for current data.
- Stopped the temporary dev server and confirmed port `3022` was no longer listening.
- Did not restart or deploy the live production-private service on `127.0.0.1:3000`.

Verification passed:

- `pnpm vitest run src/server/console-bridge.test.ts --reporter=verbose`
- `pnpm test` — 23 files, 80 tests passed.
- `pnpm typecheck`
- `pnpm lint` — existing `src/app/layout.tsx` custom font warning only.
- `pnpm prisma:validate`
- `pnpm build`
- `pnpm docker:config`

Next recommended work:

- Deploy/restart only after operator approval, then point Workspace at the live bridge URL.
- Add read-only drill-down routes before any gated write actions.

## Latest ops handoff — 2026-05-14 22:04 KST

Added read-only drill-down bridge routes for Workspace.

Changed files:

- `src/server/console-bridge.ts`: added `getConsoleBridgeApprovals`, `getConsoleBridgeTasks`, and `getConsoleBridgeEvents`.
- `src/app/api/bridge/approvals/route.ts`: read-only approvals list.
- `src/app/api/bridge/tasks/route.ts`: read-only blocked/waiting tasks list.
- `src/app/api/bridge/events/route.ts`: read-only warning/critical events list.
- `src/server/console-bridge.test.ts`: added drill-down list coverage.
- `docs/control/PROGRESS.md`: recorded validation results.

Runtime actions:

- Started a temporary dev server on `127.0.0.1:3022` only for loopback smoke.
- Verified `/api/bridge/summary`, `/api/bridge/approvals`, `/api/bridge/tasks`, and `/api/bridge/events` with `x-ops-operator-email`.
- Stopped the temporary dev server and confirmed port `3022` was no longer listening.
- Did not restart or deploy the live production-private service on `127.0.0.1:3000`.

Verification passed:

- `pnpm vitest run src/server/console-bridge.test.ts --reporter=verbose` — 2 tests passed.
- `pnpm test` — 23 files, 81 tests passed.
- `pnpm typecheck`
- `pnpm lint` — existing `src/app/layout.tsx` custom font warning only.
- `pnpm prisma:validate`
- `pnpm build`
- `pnpm docker:config`

Next recommended work:

- Add Workspace UI drill-down panels/pages that consume these routes.
- Keep all write/control actions disabled until the read-only drill-down UI is stable.

## Latest dev handoff — 2026-05-16 04:30 KST

Implemented the Ops Console project/agent conversation split vertical slice.

Changed files:

- `src/server/project-conversations.ts`: derived registry, stable `projectSlug/agentSlug/workstream` keys, role-profile memory/context owner metadata, active Company project guard, and DB loader.
- `src/server/project-conversations.test.ts`: regression coverage for key routing, metadata, derived grouping, and inactive project guard.
- `src/app/(app)/projects/[id]/conversations/page.tsx`: Discord-like reusable thread UI with project/agent list, selected conversation pane, message cards, and empty/disabled states.
- `src/app/(app)/projects/[id]/page.tsx`: added `대화 표면` link.
- `src/server/agent-instructions.ts` / `.test.ts`: operator instruction events now include reusable conversation metadata and preserve the selected project slug when available.
- `src/server/hq-orchestration.ts` / `.test.ts`: HQ delegated tasks/reports now include project/agent/workstream metadata.
- `src/server/department-adapters.ts` / `.test.ts`: adapter events/artifacts/reports now include reusable thread metadata.
- `src/server/agent-autonomy.ts`: autonomous adapter handoff now selects the project slug and passes it into adapter metadata so `alpha-terminal` and `ops-console` do not collapse into one default surface.
- `docs/control/DECISIONS.md`, `docs/control/PROGRESS.md`, `docs/control/SESSION_HANDOFF.md`: documented the decision, progress, and this handoff.

Verification passed:

- `pnpm vitest run src/server/agent-instructions.test.ts src/server/project-conversations.test.ts src/server/department-adapters.test.ts src/server/hq-orchestration.test.ts` — 16 tests passed.
- `pnpm test` — 24 files / 86 tests passed.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed with existing `src/app/layout.tsx` custom-font warning only.
- `pnpm prisma:validate` — passed.
- `pnpm build` — passed; route list includes `/projects/[id]/conversations`.

Blocked / not run:

- `pnpm docker:config` failed because the current Docker CLI lacks the Compose plugin: `docker: unknown command: docker compose`.
- No live app restart, production deploy, Tailnet routing change, external send, worker gateway start, or Discord deletion/post was performed.

Next recommended work:

1. Add richer workstream inference from task cards or explicit project workstream selectors.
2. Add read-only bridge exposure for conversation surfaces if Hermes Workspace needs to consume this page/data.
3. Optionally add a real persisted Conversation model after validating the derived registry UX against live data.


## Live deployment handoff — 2026-05-20 13:51 KST

- Production-private app reflected after approval.
- Runtime path: `/Users/domclaw/ops-console-runtime`.
- LaunchAgent: `ai.company.ops-console.app`, state verified `running`, pid `60161` after kickstart.
- Deployed artifacts only: `.next/standalone`, `.next/static`, `.next/BUILD_ID`.
- Runtime build backup: `/Users/domclaw/ops-console-runtime/.next-backup-control-20260520-134821`.
- Live verification:
  - `GET http://127.0.0.1:3000/api/health` → 200.
  - `GET http://127.0.0.1:3000/control` + `x-ops-operator-email` → 200, reference UI markers present.
  - `GET http://127.0.0.1:3000/api/control/summary` + `x-ops-operator-email` → 200, agents=8, healthRows=13, events=60.
  - Visual QA screenshot: `/tmp/control-live-visual-qa.png`.
- No Prisma migration/schema change.
- No production public exposure change.

## 2026-05-21 — Control Autonomy/Agent Drawer layout fix
- Fixed Autonomy Dashboard metric cards and level chips crowding at desktop widths by switching the metric row to responsive `auto-fit` cards and wrapping long level chips.
- Fixed Agent Control Drawer status badges occupying the middle of rows by splitting each row into `minmax(0, 1fr)` content + fixed status area.
- Added regression coverage in `src/app/(app)/control/page.reference-ui.test.tsx` for `autonomy-metric-grid`, `autonomy-level-rail`, and `agent-drawer-*` structure.
- Verified source/runtime unit tests, typecheck, and build. Live `/control` Playwright check: `bodyOverflowX=0`, `clipped=[]`, screenshot `/tmp/control-layout-fixed.png`.

