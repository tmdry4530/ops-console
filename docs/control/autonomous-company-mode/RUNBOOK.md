---
task_id: autonomous-company-mode-mvp
trace_id: trace-autonomy-company-mode-mvp-20260524
secret_safe: true
artifact_type: implementation_evidence
owner: main-agent
visibility: internal
---
# RUNBOOK — Autonomous Company Mode

Date: 2026-05-24 KST
Scope: work-branch/local operation only until separate runtime approval.

## Purpose

Autonomous Company Mode lets Company agents discover service improvements, scan market opportunities, create candidate/project-draft records, and run low/medium internal work within approved scope while routing high/critical or externally impactful decisions to the owner through main-agent packets.

## Safety controls

- Emergency stop: lower/pause autonomy immediately; resuming or raising autonomy requires owner approval.
- High/critical gate: high/critical, production-impacting, public, external send, paid, credential/env/config, secret-like, main-branch, wallet/trading/order actions must not execute automatically.
- Scope boundary: Company autonomy does not expand into Auth/Crypto/Alpha/X-CDP.
- Secret safety: UI/API/documentation may expose metadata only; raw secrets/logs/browser storage/private keys must not be read or displayed.
- Traceability: durable runs/candidates/decisions carry `traceId`, `eventIds`, and artifact/verification linkage fields.

## Daily cadence

1. Scheduler drafts bounded jobs for service improvement radar, market opportunity radar, stale-task sweep, evidence pack refresh, UX audit, dev feasibility pass, docs verification, and executive brief.
2. Each job evaluates `AutonomyPolicy` before execution.
3. Allowed low/medium internal work creates or updates candidates/drafts and trace/event metadata.
4. Gated work creates `OwnerDecisionRequest` and appears in `/decisions/owner-inbox`.
5. main-agent aggregates owner decision packets; Discord/chat receives concise status only.

## Weekly cadence

1. Review candidate quality, conversion rate, false positives, blocked/gated work, stale decisions, and verifier failures.
2. Lower autonomy or pause categories with repeated verifier failures.
3. Update docs/runbooks and policy matrix after approval.
4. Keep market/opportunity scans evidence-backed and exclude low-confidence single-source claims.

## Operator screens

- `/control/autonomy`: autonomy level, policy matrix, scheduler draft, emergency/pause/lower-autonomy control intent.
- `/projects/opportunities`: OpportunityCandidate queue and evidence summaries.
- `/projects/improvements`: ImprovementCandidate backlog and autonomy-fit labels.
- `/decisions/owner-inbox`: concise owner packets; no raw logs/secrets.
- `/observe/autonomy-runs`: read-only run timeline with policy decisions and trace IDs.

## Verification before deployment

Run from `/Users/domclaw/ops-console`:

```bash
pnpm exec prisma validate
pnpm exec vitest run src/server/autonomous-company-mode.test.ts
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Then run changed-file secret scan and confirm:

- branch is not `main`;
- migrations are additive and not deployed unless explicitly approved;
- no `.env`, secret, browser storage, token, cookie, private key, or DB URL content is copied into docs/UI/logs;
- all high/critical owner-gated cases still produce `owner_required`/manual/block decisions.

## Rollback

Before runtime approval, rollback is git-only: revert the work-branch commit. No live DB migration or runtime service restart has been performed in this scope.

If later deployed with a migration, rollback must be a separately approved DB/runtime plan with backups and owner confirmation.
