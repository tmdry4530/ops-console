#!/usr/bin/env sh
set -eu
mkdir -p backups
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
docker compose exec -T postgres pg_dump --clean --if-exists -U ops_console -d ops_console > "backups/ops-console-$STAMP.sql"
echo "backups/ops-console-$STAMP.sql"
