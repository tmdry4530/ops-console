#!/usr/bin/env bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
APP_DIR="/Users/domclaw/ops-console"
cd "$APP_DIR"

while true; do
  python3 ops/mac-mini/sync-live-status.py
  pnpm worker:ingest
  sleep "${OPS_CONSOLE_LIVE_STATUS_INTERVAL_SEC:-60}"
done
