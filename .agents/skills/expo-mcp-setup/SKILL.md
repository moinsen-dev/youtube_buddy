---
name: expo-mcp-setup
description: Set up and troubleshoot the Expo MCP server for coding agents (live Expo docs, SDK-compatible package install, EAS builds/workflows, store data, local UI automation). Use when configuring MCP for an Expo project, when the Expo MCP connection fails, hangs, or needs auth, or before EAS/store automation tasks.
---

# Expo MCP Setup

## What the server provides

Remote (`https://mcp.expo.dev/mcp`, OAuth, Expo account required):

- Docs: `search_documentation` (requires **EAS Paid Plan**), `read_documentation`, `learn`
- Packages: `add_library` (installs SDK-compatible versions via `npx expo install`)
- EAS: `build_*` (list/info/logs/run/cancel/submit), `workflow_*` (create/validate/list/info/logs/run/cancel)
- Stores: `testflight_crashes/feedback`, `appstore_reviews/reply_review/delete_review_response`, `playstore_crashes/reviews/reply_review`

Local (only with a running dev server, SDK 54+): `automation_tap`, `automation_take_screenshot`, `automation_find_view`, `collect_app_logs`, `open_devtools`, `expo_router_sitemap`.

## Recommended project-level config (`.mcp.json`)

```json
{
  "mcpServers": {
    "expo": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.expo.dev/mcp"]
    }
  }
}
```

## Known pitfall: kimi-code ≤ 0.27 native HTTP transport hangs

Verified 2026-07-19: kimi-code 0.27.0 detects the native HTTP server (`needs-auth`), completes OAuth, and stores valid tokens (`~/.kimi-code/credentials/mcp/`), but every connect **with** a stored token hangs until the 30 s timeout. Token and server are fine (direct `curl initialize` with the token returns HTTP 200).

**Workaround (the durable fix): use the `mcp-remote` stdio bridge** as in the config above. `mcp-remote` runs its own OAuth flow once (browser), caches tokens with refresh under `~/.mcp-auth/`, and reconnects by itself on every session start.

**Retest on newer kimi versions:** swap the entry for a native `url` entry, start a fresh session, and grep the session log for `expo … status=failed`. If clean, keep the native entry.

## Auth checklist

1. Expo account exists and `npx expo whoami` / `eas whoami` is logged in.
2. First bridge run: `npx -y mcp-remote https://mcp.expo.dev/mcp` → confirm in browser → tokens cached in `~/.mcp-auth/`.
3. MCP servers load at session start — after any `.mcp.json` change, start a new session.

## Local capabilities setup (per project)

```sh
npx expo install expo-mcp --dev
EXPO_UNSTABLE_MCP_SERVER=1 npx expo start
```

- Reconnect the MCP connection in the agent after every dev-server start/stop.
- Only one dev server at a time; local iOS capabilities are simulator-only and macOS-only.

## Privacy / compliance

- Expo does not train models on MCP data; the MCP server itself runs no model. Screenshots/logs proxy through Expo servers to the local MCP client.
- Never use real user data in the app during MCP automation sessions.
- `mcp.expo.dev` / `api.expo.dev` are build-time tooling endpoints — they do NOT extend the app's runtime network whitelist (local-only rule stays untouched).
