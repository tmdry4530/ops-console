#!/usr/bin/env python3
"""Write live Mac mini service status files for Ops Console ingestion.

This intentionally records only service/health metadata. It must not read or emit
secrets, env values, tokens, connection strings, or message content.
"""
from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

APP_DIR = Path("/Users/domclaw/ops-console")
STATUS_DIR = APP_DIR / "ops" / "status"

SERVICES = [
    # Only surface actual work/monitoring agents in the Ops Console agent view.
    # Gateway/proxy/app infrastructure remains checked by healthcheck/logs, but is
    # intentionally not presented as an operator-manageable "agent".
    {
        "agent_id": "auth-manager",
        "project_id": "auth-platform",
        "task_id": "auth-health-monitor",
        "label": "ai.hermes.auth-manager.health",
        "summary": "Auth manager provider health monitor launchd service",
        "next_action": "Monitor provider health and OAuth alerts",
    },
    {
        "agent_id": "crypto-signal",
        "project_id": "crypto-signal-platform",
        "task_id": "crypto-signal-collector",
        "label": "ai.hermes.crypto-signal.collector",
        "summary": "Crypto signal collector launchd service",
        "next_action": "Monitor source quality and gated signal output",
    },
]


def launchctl_rows() -> dict[str, dict[str, str]]:
    out = subprocess.run(["launchctl", "list"], text=True, capture_output=True, check=True).stdout
    rows: dict[str, dict[str, str]] = {}
    for line in out.splitlines()[1:]:
        parts = line.split()
        if len(parts) >= 3:
            rows[parts[2]] = {"pid": parts[0], "last_exit": parts[1], "label": parts[2]}
    return rows


def status_for(row: dict[str, str] | None) -> tuple[str, str, str | None]:
    if not row:
        return "offline", "failing", "launchd label not loaded"
    pid = row.get("pid", "-")
    last_exit = row.get("last_exit", "-")
    if pid != "-":
        return "running", "ok", None
    if last_exit == "0":
        return "idle", "ok", None
    return "failed", "failing", f"launchd loaded but not running; last_exit={last_exit}"


def main() -> None:
    STATUS_DIR.mkdir(parents=True, exist_ok=True)
    rows = launchctl_rows()
    now = datetime.now(timezone.utc).isoformat()
    for svc in SERVICES:
        state, health, blocker = status_for(rows.get(svc["label"]))
        payload = {
            "schema_version": "1.0",
            "agent_id": svc["agent_id"],
            "project_id": svc["project_id"],
            "task_id": svc["task_id"],
            "status": state,
            "health_status": health,
            "summary": svc["summary"],
            "needs_approval": False,
            "risk_level": "low",
            "artifacts": [],
            "next_action": svc["next_action"],
            "updated_at": now,
        }
        if blocker:
            payload["current_blocker"] = blocker
        (STATUS_DIR / f"{svc['agent_id']}.json").write_text(json.dumps(payload, indent=2) + "\n")
    print(f"wrote {len(SERVICES)} live status files to {STATUS_DIR}")


if __name__ == "__main__":
    main()
