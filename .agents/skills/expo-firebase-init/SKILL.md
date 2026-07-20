---
name: expo-firebase-init
description: Bootstrap a project with the moinsen Expo+Firebase workflow — creates AGENTS.md, STATE.md, docs (PRD/DEPLOY), planning/ task files and .mcp.json (scoped Firebase MCP) from bundled templates. Use when starting a fresh Expo app that uses Firebase, when the user asks to work "like menulens" / "wie in menulens mit Firebase", or when a Firebase project lacks AGENTS.md + STATE.md discipline and dev/prod separation.
---

# Expo Firebase Stack Init

Bootstraps the Expo+Firebase workflow (proven in menulens) into the current project. Signature: **`AGENTS.md` working contract + `STATE.md` project memory + self-contained task files in `planning/` + strict dev/prod separation.**

## Bootstrap protocol

Follow these steps in order. Report each step's outcome.

1. **Detect existing state.** Check for `AGENTS.md`, `STATE.md`, `.mcp.json`, `firebase.json`, `.firebaserc`, `docs/`, `planning/`. Report what exists. **Never overwrite existing files.**
2. **Copy templates.** The templates live in `templates/` next to this SKILL.md. Copy every file into the project root, preserving relative paths (`AGENTS.md`, `STATE.md`, `docs/PRD.md`, `docs/DEPLOY.md`, `planning/README.md`, `planning/task-00-template.md`). Skip files that already exist and say so.
3. **Substitute placeholders** in the files you just copied (never in pre-existing files):
   - `{{PROJECT_NAME}}` — project directory basename
   - `{{GITHUB_ORG}}` — default `moinsen-dev`; confirm with the user if unknown
   - `{{BUNDLE_ID}}` — `dev.<org without dashes>.<project name without dashes>`, lowercase
   - `{{PROJECT_DIR}}` — absolute project path (the Firebase MCP `--dir` needs it)
4. **Handle `.mcp.json`.** If none exists, copy the template (servers: `firebase` scoped via `--dir`/`--only`, `chrome-devtools`, `ios-simulator`). If one exists, merge: add missing servers, keep existing entries on conflict. A new agent session is needed to load the servers.
5. **Verify the environment** (report, don't silently fix): node ≥ 22, git, jq, `firebase` (logged in: `firebase login:list` — the CLI login IS the MCP auth; **no service-account files**), `eas` (logged in), `gh`, xcodebuild, adb, java, pod. Expo skills in `~/.agents/skills`.
6. **Establish environments and STATE.md discipline.** Set today's date in STATE.md. Explain and follow from now on: STATE.md is updated after every session; two Firebase projects `<app>-dev` (default) / `<app>-prod`; agents work against dev only, prod requires explicit approval; `.firebaserc` default alias = dev; Google services files under `secrets/` (gitignored, never committed). See `firebase-environments` and `firebase-rules-workflow` skills.
7. **Report** what was created and propose the immediate next step: fill `docs/PRD.md`, then create `planning/task-01-*.md` from the template (no code before docs + task file).

## Notes

- The deterministic CLI equivalent is `apply-stack.sh expo-firebase` from the moinsen-expo-stacks repo; prefer it when the repo is checked out locally. This skill exists so the bootstrap works from skill installation alone.
- Operational details live in the sibling skills `firebase-mcp-ops`, `firebase-environments`, `firebase-rules-workflow`.
