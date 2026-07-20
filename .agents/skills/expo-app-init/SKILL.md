---
name: expo-app-init
description: Bootstrap a project with the moinsen local-only Expo workflow — creates AGENTS.md, STATE.md, docs skeleton (PRD/DESIGN/ARCHITECTURE/ROADMAP/AGENT-TOOLING) and .mcp.json from bundled templates. Use when starting a fresh Expo app, when the user asks to work "like youtube_buddy" / "wie in YouTube Buddy", or when a project lacks AGENTS.md and STATE.md discipline.
---

# Expo App Stack Init

Bootstraps the local-only Expo workflow (proven in youtube_buddy) into the current project. The signature of this workflow: **`AGENTS.md` as the working contract + `STATE.md` as the living project memory** — the agent updates STATE.md after every work unit.

## Bootstrap protocol

Follow these steps in order. Report each step's outcome.

1. **Detect existing state.** Check the project root for `AGENTS.md`, `STATE.md`, `.mcp.json`, `docs/`. Report what exists. **Never overwrite existing files.**
2. **Copy templates.** The templates live in `templates/` next to this SKILL.md. Copy every file into the project root, preserving relative paths (`AGENTS.md`, `STATE.md`, `docs/PRD.md`, `docs/DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/AGENT-TOOLING.md`). Skip files that already exist and say so.
3. **Substitute placeholders** in the files you just copied (never in pre-existing files):
   - `{{PROJECT_NAME}}` — project directory basename
   - `{{GITHUB_ORG}}` — default `moinsen-dev`; confirm with the user if unknown
   - `{{BUNDLE_ID}}` — `dev.<org without dashes>.<project name without dashes>`, lowercase
   - `{{PROJECT_DIR}}` — absolute project path
4. **Handle `.mcp.json`.** If none exists, copy the template (servers: `expo` via mcp-remote bridge, `chrome-devtools`). If one exists, merge: add missing servers, keep existing entries on conflict. Remind the user that MCP servers load at session start — a new session is needed to pick them up.
5. **Verify the environment** (report findings, don't silently fix): node ≥ 22, git, jq, `eas` (logged in: `eas whoami`), `gh` (authed), xcodebuild, adb, java, pod, maestro. Expo skills present in `~/.agents/skills` (else: `npx -y skills add expo/skills -g -s '*' -y --copy`). Expo-MCP OAuth cache `~/.mcp-auth` (else instruct: run `npx -y mcp-remote https://mcp.expo.dev/mcp` once, browser flow). See `expo-mcp-setup` skill for details.
6. **Establish the STATE.md discipline.** Set today's date in STATE.md, then explain and follow the rule from now on: **after every work unit, update STATE.md** (what was finished, what's next, decisions with discarded alternatives). A roadmap phase is only complete when its exit criteria are checked off in STATE.md with evidence.
7. **Report** what was created and propose the immediate next step: fill `docs/PRD.md` and Phase 0 in `docs/ROADMAP.md` (docs-first rule — no code before docs).

## Notes

- The deterministic CLI equivalent is `apply-stack.sh expo-app` from the moinsen-expo-stacks repo; prefer it when the repo is checked out locally. This skill exists so the bootstrap works from skill installation alone.
- Workflow rules after bootstrap live in the project's new `AGENTS.md`; operational details in the sibling skills `expo-mcp-setup`, `eas-autonomy`, `gcp-oauth-setup`, `youtube-quota`.
