# Deployment

Target: production-private deployment behind Tailscale/VPN or equivalent private network. Do not expose publicly until auth, HTTPS, audit logging, rate limiting, backups, and restore testing pass.

## Baseline commands

```bash
cp .env.example .env
pnpm install
pnpm prisma:generate
pnpm build
pnpm docker:config
docker compose up -d postgres redis
docker compose --profile tools run --rm migrate
docker compose --profile tools run --rm seed
docker compose up -d app
```

Enable private HTTPS proxy after domain/network decisions:

```bash
docker compose --profile proxy up -d caddy
```

Worker services are defined under the `workers` profile and will be wired to dedicated worker commands in the feature phase.
