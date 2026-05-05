#!/usr/bin/env sh
set -eu
BACKUP_FILE="${1:?usage: restore.sh <backup-file>}"
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U ops_console -d ops_console < "$BACKUP_FILE"
