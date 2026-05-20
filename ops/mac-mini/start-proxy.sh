#!/usr/bin/env bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${OPS_CONSOLE_APP_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
cd "$APP_DIR"
export OPS_CONSOLE_PROXY_HOST="0.0.0.0"
export OPS_CONSOLE_ALLOWED_CLIENTS="127.0.0.1,::1,192.168.35.244,192.168.0.31"
exec python3 ops/local_auth_proxy.py
