#!/usr/bin/env bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd /Users/domclaw/ops-console
export OPS_CONSOLE_PROXY_HOST="0.0.0.0"
export OPS_CONSOLE_ALLOWED_CLIENTS="127.0.0.1,::1,192.168.35.244"
exec python3 ops/local_auth_proxy.py
