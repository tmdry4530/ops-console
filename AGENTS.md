# Repository Instructions

## Goal
Build Company Ops Console as a production-private Agent Operations Control Plane.

## Stack Defaults
- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- Redis
- Docker Compose
- Private network deployment first

## Safety
- Never store or request passwords, 2FA codes, seed phrases, private keys, or plaintext tokens.
- High/critical actions require approval or manual handoff.
- Do not expose the app publicly before auth, HTTPS, audit logging, backups, and restore are verified.

## Required Verification
Before completion, run or document blockers for:
- install
- lint
- typecheck
- tests
- Prisma generate/migrate
- build
- docker compose validation

## Work Rules
- Keep diffs minimal.
- Do not weaken tests to pass.
- Record major decisions in `docs/control/DECISIONS.md`.
- Update `docs/control/PROGRESS.md` and `docs/control/SESSION_HANDOFF.md` before stopping.
