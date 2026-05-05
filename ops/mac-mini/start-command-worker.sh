#!/usr/bin/env bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
APP_DIR="/Users/domclaw/ops-console"
cd "$APP_DIR"

while true; do
  pnpm worker:commands
  sleep "${OPS_CONSOLE_COMMAND_WORKER_INTERVAL_SEC:-15}"
done
