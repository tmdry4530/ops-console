#!/usr/bin/env bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
APP_DIR="/Users/domclaw/ops-console"
cd "$APP_DIR"

while true; do
  pnpm worker:agents
  sleep "${OPS_CONSOLE_AGENT_WORKER_INTERVAL_SEC:-30}"
done
