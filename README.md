# Company Ops Console

Production-private Agent Operations Control Plane for audited approvals, artifacts, project state, and safe command/manual-handoff workflows.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Prisma + PostgreSQL
- Redis/BullMQ-compatible worker layer
- Docker Compose with private-network-first deployment assumptions

## Local skeleton startup

```bash
pnpm install
cp .env.example .env.local
pnpm prisma:generate
pnpm dev
```

The initial skeleton exposes `/dashboard` and `/api/health`. Feature implementation still needs to wire database-backed auth, approvals, ingestion, SSE, and workers.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm prisma:validate
pnpm build
pnpm docker:config
```
