---
name: meshcentral
description: Query MeshCentral devices, device groups and audit events through the meshcentral-mcp server. Use when the user asks about managed endpoints, agent versions, online state, or recent MeshCentral audit events.
---

# Using the MeshCentral MCP server

This server exposes **read-only** MeshCentral capabilities. It cannot run commands, change devices, move groups, or start remote sessions.

## Before the first call

1. Run `server_status`. It reports whether the control channel is connected and which account is signed in.
2. If it returns `SESSION_MISSING` or `SESSION_EXPIRED`, stop and tell the user to run `meshcentral-mcp login`. Do not retry in a loop.

## Choosing a tool

| Goal | Tool |
| --- | --- |
| "Which devices are online?" | `devices_list` with `online: true` |
| "Find the PC named X" | `devices_list` with `nameContains` |
| "Tell me about this endpoint" | `devices_get` |
| "Which groups exist?" | `groups_list` |
| "What happened recently?" | `events_query` |
| "Is the connection healthy?" | `server_status` |

## Rules

- **Never guess a device ID.** Take it from `devices_list` or `groups_list`.
- **Always confirm online state with `devices_get`** before reporting that an endpoint is reachable or that an operation is possible.
- **Respect paging.** If a response contains `nextCursor`, either continue with the cursor or state clearly that the list is partial. Never present a partial page as the complete inventory.
- **Name and platform filters are local.** `devices_list` fetches the full snapshot and filters in memory. An empty result means "not in the visible snapshot", not "does not exist".
- **`events_query` has no server-side time range.** The `since` filter runs locally after MeshCentral already limited the result to the most recent events. When the response has `truncated: true`, say that older events may be missing.
- **Do not describe actions you cannot perform.** This server has no write capability. If the user asks to run a command, reboot a device, or open a remote session, explain that the MCP integration is read-only and point them to the MeshCentral web console.
- **Do not request raw protocol payloads.** There is no passthrough tool, by design.

## Reporting

Summarize concisely: device name, group, online state, platform, agent version, and last seen time. Prefer tables for more than three devices. When a result is truncated, state that explicitly instead of implying completeness.

## Errors

Errors come back with `code`, `message`, `hint` and `retryable`:

- `INVALID_ARGUMENT` — fix the arguments; do not retry unchanged.
- `NOT_CONNECTED` / `UPSTREAM_TIMEOUT` with `retryable: true` — one retry is reasonable.
- `FORBIDDEN` — the device or group is outside `MESHCENTRAL_MCP_SCOPE_*`; tell the user the scope needs widening.
- `SESSION_*` — the user must sign in again.
