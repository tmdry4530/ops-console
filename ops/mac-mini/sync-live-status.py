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
    {
        "agent_id": "company-gateway",
        "project_id": "company-platform",
        "task_id": "company-discord-gateway",
        "label": "ai.hermes.gateway-company",
        "summary": "Company Discord Hermes gateway launchd service",
        "next_action": "Monitor gateway process and Discord delivery health",
    },
    {
        "agent_id": "auth-manager",
        "project_id": "auth-platform",
        "task_id": "auth-health-monitor",
        "label": "ai.hermes.auth-manager.health",
        "summary": "Auth manager provider health monitor launchd service",
        "next_action": "Monitor provider health and OAuth alerts",
    },
    {
        "agent_id": "auth-gateway",
        "project_id": "auth-platform",
        "task_id": "auth-discord-gateway",
        "label": "ai.hermes.gateway-auth-manager",
        "summary": "Auth Discord Hermes gateway launchd service",
        "next_action": "Monitor auth-agent command channel",
    },
    {
        "agent_id": "crypto-signal",
        "project_id": "crypto-signal-platform",
        "task_id": "crypto-signal-collector",
        "label": "ai.hermes.crypto-signal.collector",
        "summary": "Crypto signal collector launchd service",
        "next_action": "Monitor source quality and gated signal output",
    },
    {
        "agent_id": "crypto-gateway",
        "project_id": "crypto-signal-platform",
        "task_id": "crypto-discord-gateway",
        "label": "ai.hermes.gateway-crypto-signal",
        "summary": "Crypto Discord Hermes gateway launchd service",
        "next_action": "Monitor crypto signal Discord channels",
    },
    {
        "agent_id": "ops-console-app",
        "project_id": "ops-console",
        "task_id": "ops-console-nextjs-app",
        "label": "ai.company.ops-console.app",
        "summary": "Company Ops Console Next.js launchd app",
        "next_action": "Keep app health and dashboard reachable",
    },
    {
        "agent_id": "ops-console-proxy",
        "project_id": "ops-console",
        "task_id": "ops-console-lan-proxy",
        "label": "ai.company.ops-console.proxy",
        "summary": "Company Ops Console LAN allowlist auth proxy",
        "next_action": "Keep 192.168.35.244 allowlisted dashboard access reachable",
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
