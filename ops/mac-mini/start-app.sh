#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
APP_DIR="/Users/domclaw/ops-console"
cd "$APP_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
fi

if ! colima status >/dev/null 2>&1; then
  colima start --cpu 2 --memory 4 --disk 20
fi

docker compose up -d postgres redis

for i in $(seq 1 60); do
  pg="$(docker inspect -f '{{.State.Health.Status}}' ops-console-postgres-1 2>/dev/null || echo none)"
  rd="$(docker inspect -f '{{.State.Health.Status}}' ops-console-redis-1 2>/dev/null || echo none)"
  echo "health $i postgres=$pg redis=$rd"
  if [ "$pg" = "healthy" ] && [ "$rd" = "healthy" ]; then
    break
  fi
  sleep 2
done

docker update --restart unless-stopped ops-console-postgres-1 ops-console-redis-1 >/dev/null || true

pnpm prisma:generate
pnpm prisma:deploy
pnpm prisma:seed

if [ ! -f .next/BUILD_ID ] || [ ! -f .next/standalone/server.js ]; then
  pnpm build
fi

mkdir -p .next/standalone/.next
rm -rf .next/standalone/.next/static
cp -R .next/static .next/standalone/.next/static
rm -rf .next/standalone/public
cp -R public .next/standalone/public

set -a
# shellcheck disable=SC1091
. ./.env
set +a
export HOSTNAME="127.0.0.1"
export PORT="3000"

exec node .next/standalone/server.js
