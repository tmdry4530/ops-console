# Ops Console UI Guide

## Current live operator menus

The sidebar intentionally exposes only useful, working Company control-plane surfaces:

- `/control` — canonical Company control center, local-system monitor, approvals/tasks/events overview.
- `/agents` — Company role-agent registry and harness quality state.
- `/approvals` — actionable approval/manual-handoff queue.
- `/projects` — active Company project surfaces and detail links.
- `/artifacts` — auditable task artifacts/results.
- `/events` — audit/event ledger, including report evidence.

## Retired menu pages

Removed from navigation and route tree:

- `/dashboard` — duplicated by `/control`.
- `/reports` — report firehose is disabled; evidence belongs in `/events`.
- `/settings` — static placeholder cards, not operator-actionable.
- `/policies` — policy enforcement remains server-side and visible through gates/control summaries, not as a dead admin menu.

## Detail pages

Detail pages remain reachable through live surfaces:

- `/agents/[id]`
- `/approvals/[id]`
- `/projects/[id]`
- `/projects/[id]/conversations`
- `/tasks/[id]`

## Safety rule

Do not add sidebar/menu items unless they are backed by live data and tested behavior. Placeholder buttons are not allowed in the operator surface; add an audited action first, then expose the control.
