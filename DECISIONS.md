# Decisions

- Use `pnpm` at the repo root because the repo was empty and the goal allowed defaults unless existing code forced another choice.
- Use Next.js App Router, TypeScript, Tailwind CSS, Prisma, PostgreSQL, Redis-compatible workers, Docker Compose, and Caddy private HTTPS as the production-private baseline.
- Use `Event` as the canonical audit/event log for now; add a separate `AuditLog` only if later requirements require different retention or access controls.
- Do not store passwords in the baseline auth model. The skeleton uses operator/session-compatible records and leaves concrete auth flow implementation for the feature phase.
- Deploy the Mac mini runtime as production-private services: Colima/Docker for Postgres+Redis, launchd for the standalone Next.js app bound to `127.0.0.1:3000`, and a LAN auth proxy on `0.0.0.0:3010` that injects the private operator header but only allows client `192.168.35.244` plus local loopback. Do not expose this proxy publicly.
