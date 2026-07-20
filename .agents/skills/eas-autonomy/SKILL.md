---
name: eas-autonomy
description: Autonomy rules for EAS and store operations when an agent runs an Expo project unattended (YOLO mode) — what may run without asking, what always needs explicit approval, plus build-minute cost discipline. Use before any eas-cli, EAS-MCP build/workflow/submit, or store-review action.
---

# EAS Autonomy Rules (YOLO operation)

## Allowed without asking

- Code, tests, lint, local builds and simulators/emulators
- `npx expo install`, dependency maintenance
- Maestro flows, screenshots, UI verification
- EAS builds and workflows: **read and start** (`build_list/info/logs`, `build_run`, `workflow_*` incl. `workflow_run`)
- Documentation updates (STATE.md, docs/)

## Requires explicit user approval (outward-facing or cost-relevant)

- Store submissions: `eas submit`, `build_submit`
- Public store review replies: `appstore_reply_review`, `playstore_reply_review` (deleting a reply as well)
- EAS Update to the `production` channel
- Git mutations (commit, push, branch deletion, force-push, reset --hard) — the standing project rule

## Cost discipline

- EAS builds consume plan build minutes: trigger sparingly, **read logs before re-triggering**, cancel stale builds (`build_cancel`).
- Prefer local builds (`npx expo run:ios|android`) for iteration; EAS for signing/store artifacts only.
- Verify identity first: `eas whoami` must show the expected account; when linking (`eas init`), choose the project owner (personal account vs. org) deliberately and record the decision in STATE.md.

## Privacy hardening defaults

- chrome-devtools MCP runs with `--no-usage-statistics`.
- Maestro: set `MAESTRO_CLI_NO_ANALYTICS=1` when needed.
- Expo skills telemetry is opt-in — leave it off.
