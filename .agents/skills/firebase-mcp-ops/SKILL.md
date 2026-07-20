---
name: firebase-mcp-ops
description: Configure and safely operate the Firebase MCP server for a project (rules validation, auth user management, Firestore/Storage, Crashlytics, Remote Config) using the Firebase CLI login as auth — no service-account files. Use when setting up Firebase MCP, switching Firebase projects/environments, or before any MCP-driven Firebase mutation.
---

# Firebase MCP Operations

## Project-level config (`.mcp.json`)

```json
{
  "mcpServers": {
    "firebase": {
      "command": "npx",
      "args": [
        "-y",
        "firebase-tools@latest",
        "mcp",
        "--dir",
        "<absolute project path>",
        "--only",
        "auth,firestore,storage,crashlytics,remoteconfig"
      ]
    }
  }
}
```

## Principles

1. **CLI login is the auth.** The server uses the Firebase CLI login of the machine (`firebase login`, check: `firebase login:list`). **Never** download service-account JSONs — not into the repo, not onto the machine.
2. **Scope with `--only`.** Expose only the products the project actually uses (least privilege; keeps the tool list small and the blast radius limited).
3. **Scope with `--dir`.** Point the server at the repo so it reads `firebase.json` / `.firebaserc` from the project.
4. **Pin the project.** The active project comes from `firebase use` (`.firebaserc` aliases). The **default alias must be the dev project** — the MCP can mutate whatever project is active.
5. **Environment switch:** `firebase use <alias>` on the CLI, or the MCP tool `firebase_update_environment`. Always confirm the active project before mutations (`firebase use` with no args shows it).

## What the server is for

- Validate security rules before deploy (see `firebase-rules-workflow`)
- Manage auth users (test users, anonymous accounts cleanup) on dev
- Read/write Firestore documents and Storage objects on dev (seeding, debugging)
- Crashlytics issue inspection, Remote Config reads

## After changes

MCP servers load at session start — after editing `.mcp.json`, start a new agent session.
