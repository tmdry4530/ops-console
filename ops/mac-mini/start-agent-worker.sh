#!/usr/bin/env bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
APP_DIR="/Users/domclaw/ops-console"
cd "$APP_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

while true; do
  if [ "${OPS_CONSOLE_AGENT_WORKER_ENABLED:-false}" != "true" ]; then
    echo "agent worker disabled: OPS_CONSOLE_AGENT_WORKER_ENABLED=${OPS_CONSOLE_AGENT_WORKER_ENABLED:-false}"
    sleep "${OPS_CONSOLE_AGENT_WORKER_DISABLED_SLEEP_SEC:-300}"
    continue
  fi
  pnpm worker:agents
  sleep "${OPS_CONSOLE_AGENT_WORKER_INTERVAL_SEC:-2}"
done
