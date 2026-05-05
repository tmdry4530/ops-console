#!/usr/bin/env sh
set -eu
pnpm prisma:deploy
exec "$@"
