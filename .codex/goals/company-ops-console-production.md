# Company Ops Console — Production Goal

## Objective

Build and prepare Company Ops Console as a production-private web application inside this repository.

The product is an Agent Operations Control Plane for Company/Crypto/Trading/Docs/Content agents. It must let the operator see state, handle approvals, inspect artifacts, track projects, and safely continue agent execution through audited approval and command workflows.

## Non-negotiable product principles

- Artifact-first: store long outputs as repo/artifact links, not pasted chat.
- State-first: prioritize current status, next action, blockers, and approval state over raw logs.
- Approval before risk: outreach, bounty submission, wallet/KYC, live trading, payment, public disclosure, and deploy require approval or manual handoff.
- Audit everything: approval decisions, command execution, policy changes, auth events, and artifact restrictions must create audit events.
- Production, not demo: auth, RBAC, migrations, backup docs, health checks, observability, and recovery docs are required.

## Default technical decisions

Use these defaults unless the existing repo clearly forces a different choice:

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-compatible component structure
- Prisma ORM
- PostgreSQL
- Redis or BullMQ-compatible queue layer
- SSE for realtime events
- Docker Compose production-private deployment
- Caddy or Traefik reverse proxy
- Tailscale/private network first
- No public exposure until auth, HTTPS, audit logging, rate limiting, backups, and restore test are verified

## Required app scope

Implement or scaffold production-quality versions of:

1. Overview dashboard
   - global health
   - pending approvals
   - active tasks
   - failed jobs
   - agent status grid
   - recent artifacts
   - recent critical events
   - highest-priority next action

2. Approvals
   - pending / approved waiting execution / executing / rejected / needs changes / completed
   - approve / reject / request changes
   - manual handoff mode
   - decision audit events
   - command_queue creation after approval when applicable

3. Agents
   - list and detail
   - status, health, heartbeat, current task
   - timeline, artifacts, permissions, logs placeholders

4. Projects
   - list and detail
   - revenue board
   - bounty board
   - crypto signal board
   - project timeline
   - blockers and next actions

5. Artifacts
   - report, PoC, CSV, decision log, Discord thread, GitHub commit, cron output, screenshot, config backup, status file
   - path/url/repo/commit display
   - restricted artifact handling when secret-like content is detected

6. Events
   - filterable event list
   - SSE endpoint for realtime updates

7. Policies
   - allow / require_approval / block / require_manual_handoff
   - default policies for outreach, bounty submission, wallet/KYC, live trading, paid action, deploy, public disclosure

8. Settings
   - environment status
   - integration placeholders
   - notification settings placeholders

## Required data model

Implement Prisma models equivalent to:

- Agent
- Project
- Task
- Approval
- Event
- Artifact
- CommandQueue
- Policy
- User / Session or auth-compatible user model
- AuditLog if not merged into Event

Use enums or constrained string values for statuses and risk levels.

## Required ingestion

Implement idempotent ingestion for:

- ops/status/*.json
- projects/saas/data/revenue_pipeline.csv if present
- trading/status/*.md if present
- trading/reports/*.md if present
- hq/decisions/Company-Decision-Log.md if present
- docs/INDEX.md if present
- git log summary if safely accessible

Rules:

- compute content_hash
- skip unchanged items
- create event on new/changed item
- never render secrets
- if secret-like pattern is detected, mark artifact restricted and create incident/security event

## Required status contract support

Support status JSON shaped like:

{
  "schema_version": "1.0",
  "agent_id": "trading-bounty",
  "project_id": "capyfi-bounty",
  "task_id": "capyfi-oracle-report",
  "status": "waiting_approval",
  "health_status": "ok",
  "summary": "Submission-ready report prepared",
  "current_blocker": "Logged-in Immunefi scope confirmation required",
  "needs_approval": true,
  "approval_type": "bounty_submission",
  "risk_level": "medium",
  "artifacts": [
    {
      "type": "report",
      "path": "trading/reports/CapyFi-ChainlinkPriceOracle-StaleRound-Submission-Ready.md",
      "commit": "9fba2ad"
    }
  ],
  "next_action": "Submit to Immunefi after logged-in scope check",
  "updated_at": "2026-05-05T12:00:00+09:00"
}

## First vertical slice

The first end-to-end slice must be Bounty Submission Approval:

1. Ingest a CapyFi or sample submission-ready report artifact.
2. Create a bounty_submission approval card.
3. Show report path, PoC path, commit SHA, and risk level.
4. Let user approve, reject, request changes, or mark manual submitted.
5. Record decision event and audit log.
6. If manually submitted, accept report ID and move project board to Submitted.
7. Timeline records all events.
8. Notification placeholder or implementation emits concise status.

After this works, implement Revenue Manual Outreach as the second slice.

## Required security constraints

The app must not store or request:

- passwords
- 2FA codes
- seed phrases
- private keys
- plaintext OAuth tokens
- exchange/wallet API secrets in UI-visible fields

Actions requiring user session must use manual handoff mode:

- Kakao / Instagram / LINE send
- Immunefi submit
- KYC
- wallet connect/signature
- 2FA

High/critical actions cannot execute automatically.

## Required production deployment artifacts

Create or update:

- docker-compose.yml or ops-console/docker-compose.yml
- Dockerfile for app
- worker Dockerfile or worker command if workers are separate
- .env.example without secrets
- deployment README
- backup/restore runbook
- health check endpoint
- migration commands
- seed command
- production-private checklist

Deployment target:

- authenticated HTTPS
- private network via Tailscale/VPN
- Postgres
- Redis
- app container
- ingestion worker
- command worker
- Caddy/Traefik if feasible

## Required tests and verification

Before marking complete, run or explicitly explain inability to run:

- package install
- lint
- typecheck
- unit tests
- integration/API tests where present
- Prisma generate
- Prisma migration validation
- seed script
- build
- Docker build or docker compose config validation
- secret scan or implemented secret pattern test
- at least one smoke test for dashboard/approvals

If the repo has no test framework, add a minimal one appropriate for the stack.

## Required documentation

Create or update:

- AGENTS.md
- README or ops-console/README.md
- TEST_PLAN.md
- DECISIONS.md
- PROGRESS.md
- SESSION_HANDOFF.md
- DEPLOYMENT.md
- BACKUP_RESTORE.md
- SECURITY.md

## Completion criteria

Do not mark complete until all are true or each failed item has a precise blocker:

- App runs locally.
- Auth gate exists.
- DB migrations pass.
- Seed data visible.
- Dashboard shows agents/projects/tasks/artifacts/approvals.
- Bounty Submission Approval slice works end-to-end.
- Revenue Manual Outreach path exists.
- Ingestion is idempotent.
- Secret-like content is restricted.
- Approval decisions create audit events.
- Approved actions create command_queue items or manual handoff records.
- Docker/private production deployment files exist.
- Health endpoint reports DB/Redis/worker/ingestion status.
- Backup and restore runbook exists.
- Final report lists changed files, commands run, passing checks, failed checks, blockers, and exact next commands for deployment.

## Failure behavior

- Do not guess credentials.
- Do not weaken tests just to get green.
- Do not remove safety gates.
- Do not expose app publicly.
- If a requirement is ambiguous, choose the safer production-private interpretation and record it in DECISIONS.md.
- If blocked by missing credentials or local services, implement the code path, document the blocker, and provide exact operator command.
