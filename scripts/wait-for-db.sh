#!/usr/bin/env sh
set -eu
: "${DATABASE_URL:?DATABASE_URL is required}"
until pnpm prisma:validate >/dev/null 2>&1; do
  echo "waiting for prisma schema validation context..."
  sleep 2
  break
done
