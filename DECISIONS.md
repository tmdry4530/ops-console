# Decisions

- Use `pnpm` at the repo root because the repo was empty and the goal allowed defaults unless existing code forced another choice.
- Use Next.js App Router, TypeScript, Tailwind CSS, Prisma, PostgreSQL, Redis-compatible workers, Docker Compose, and Caddy private HTTPS as the production-private baseline.
- Use `Event` as the canonical audit/event log for now; add a separate `AuditLog` only if later requirements require different retention or access controls.
- Do not store passwords in the baseline auth model. The skeleton uses operator/session-compatible records and leaves concrete auth flow implementation for the feature phase.
- Deploy the Mac mini runtime as production-private local services: Colima/Docker for Postgres+Redis, launchd for the standalone Next.js app, and a loopback-only local auth proxy on `127.0.0.1:3010` that injects the private operator header. Do not expose this proxy publicly.
