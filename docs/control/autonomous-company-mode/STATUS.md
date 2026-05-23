---
task_id: autonomous-company-mode-mvp
trace_id: trace-autonomy-company-mode-mvp-20260524
secret_safe: true
artifact_type: implementation_evidence
owner: main-agent
visibility: internal
---
# STATUS — Autonomous Company Mode Scoped Implementation

Date: 2026-05-24 KST
Branch: `work/ops-console-realtime-control-plane-2026-05-22`
Scope: local/work-branch implementation only. No production/public deploy.
Approval: `@company approve extend: Autonomous Company Mode scoped implementation approval valid until 2026-05-24 KST end of day`

## Status

Implemented and verified on the work branch.

Implementation commit: `29fea01` (`feat: add autonomous company mode mvp`).

## Included

- Additive Prisma draft surface for Company autonomy:
  - `AutonomyPolicy`
  - `AutonomyRun`
  - `OpportunityCandidate`
  - `ImprovementCandidate`
  - `ProjectDraft`
  - `OwnerDecisionRequest`
- Pure policy/factory helpers in `src/server/autonomous-company-mode.ts`:
  - low/medium internal actions may be auto-planned/executed according to policy;
  - high/critical, public/external/paid/production/main-branch/config/credential/secret-like actions require owner or manual gate;
  - no agent can expand its own authority.
- DB-backed read/store helpers in `src/server/autonomous-company-mode-store.ts`.
- Ops API endpoints:
  - `GET /api/ops/autonomy/summary`
  - `POST /api/ops/autonomy/policies/evaluate`
  - `GET /api/ops/autonomy/runs`
  - `GET /api/ops/opportunities`
  - `GET /api/ops/improvements`
  - `GET /api/ops/owner-inbox`
- UI surfaces:
  - `/control/autonomy`
  - `/projects/opportunities`
  - `/projects/improvements`
  - `/decisions/owner-inbox`
  - `/observe/autonomy-runs`
- TDD coverage: `src/server/autonomous-company-mode.test.ts`.

## Not included

- No production deploy.
- No public deploy or external send/publishing.
- No live DB migration command was run.
- No runtime credential/env/config change.
- No secret/token/cookie/browser storage/private key inspection.
- No live trading/order execution or paid action.
- No main branch modification.
- No Auth/Crypto/Alpha/X-CDP scope expansion.

## Current operating boundary

Autonomous Company Mode is a scoped implementation draft on the work branch. It creates the model/API/UI path for L5 Fully Autonomous Within Scope, but activation against live runtime still requires a separate deploy/migration approval.

Runtime persistence note: the local test database has not had the new Autonomy tables migrated/applied. Store/API tests therefore verify the documented fallback draft-object path when `AutonomyRun`, `OpportunityCandidate`, `ImprovementCandidate`, `ProjectDraft`, or `OwnerDecisionRequest` tables are absent. Real DB-backed persistence is blocked until a separately approved migration is applied.

Final commit status: implementation changes were committed only from the scoped Autonomous Company Mode file list. Unrelated existing worktree changes were intentionally left unstaged.
