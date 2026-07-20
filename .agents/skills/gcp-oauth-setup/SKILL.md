---
name: gcp-oauth-setup
description: Set up a Google Cloud project and OAuth clients for an Expo app (Google Sign-In, YouTube Data API, or similar) across Web/iOS/Android, including the Android SHA-1/keystore traps that cause DEVELOPER_ERROR. Use when creating GCP projects, OAuth consent screens, client IDs, or debugging Google auth failures on Android.
---

# GCP OAuth Setup for Expo Apps

## Steps

1. **Project:** create/select a GCP project (console, or `gcloud projects create`). Remember IDs are globally unique — have a fallback name ready.
2. **APIs:** enable what the app needs (e.g. YouTube Data API v3) — nothing more.
3. **Consent screen:** External + Testing, add the test user(s) (e.g. `developer@<org>.dev`). Record scopes; request the minimum.
4. **OAuth clients:** one per platform — Web, iOS, Android. Download/record client IDs; keep secret files under `secrets/` (gitignored).
5. **Wire into the app:** client IDs in `app.json → extra` (e.g. `extra.google`); iOS URL scheme from the iOS client ID via config plugin.

## Android SHA-1 trap (learned the hard way)

`expo prebuild` generates its **own app-local** `android/app/debug.keystore`. That keystore's SHA-1 is authoritative for local/dev-client builds — the global `~/.android/debug.keystore` is only a reference. Registering the wrong SHA-1 yields Google Sign-In `DEVELOPER_ERROR`.

- Get the fingerprint: `keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA1`
- Create **one Android OAuth client per SHA-1** you actually use (app-local debug keystore, and later the EAS build credentials SHA-1 for EAS-built binaries: `eas credentials`).
- When login fails on Android only: suspect SHA-1 first, not the client ID.

## Console automation

Driving the GCP console via the chrome-devtools MCP (browser automation) is legitimate **build-time tooling** and does not violate local-only rules. Prefer `gcloud` CLI where it covers the task; use console automation for consent screen and OAuth client creation (not fully covered by CLI).

## Verification

- Login + logout works on **all three** platforms (Web, iOS sim, Android emulator) with the test user.
- Record project ID, enabled APIs, consent state, and all client IDs (no secrets) in STATE.md's decision log.
