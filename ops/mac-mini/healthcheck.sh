#!/usr/bin/env bash
set -euo pipefail
cd /Users/domclaw/ops-console
printf 'App health: '
curl -fsS http://127.0.0.1:3000/api/health >/dev/null && echo OK
printf 'Dashboard direct with auth: '
curl -fsS -H 'x-ops-operator-email: operator@example.invalid' http://127.0.0.1:3000/dashboard >/dev/null && echo OK
printf 'Dashboard browser proxy: '
curl -fsS http://127.0.0.1:3010/dashboard >/dev/null && echo OK
docker compose ps
