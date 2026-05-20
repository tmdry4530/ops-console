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

The canonical operator surface is `/control`; `/api/health` and `/api/health/deep` expose runtime checks. Legacy menu pages such as `/dashboard`, `/reports`, `/settings`, and `/policies` are retired from the operator navigation.

## Documentation

- Documentation index: `docs/INDEX.md`
- Frontend UI composition and connection guide: `docs/frontend/UI_GUIDE.md`
- Deployment and security runbooks: `docs/operations/`
- Project control notes: `docs/control/`

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm prisma:validate
pnpm build
pnpm docker:config
```
