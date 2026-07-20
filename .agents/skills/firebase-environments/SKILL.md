---
name: firebase-environments
description: Run an Expo+Firebase app with strict dev/prod separation — two Firebase projects, environment switching via app.config.ts and EAS build profiles, and safe handling of google-services files. Use when setting up environments, adding Firebase config to an Expo app, or preparing a production build.
---

# Firebase Environments for Expo Apps

## The rule

Two Firebase projects per app: `<app>-dev` and `<app>-prod`. **Development is the default everywhere** — CLI alias, app config, agent operations. Production is touched only with explicit approval.

## CLI side (`.firebaserc`)

```json
{
  "projects": {
    "default": "<app>-dev",
    "production": "<app>-prod"
  }
}
```

`firebase use` (no args) shows the active alias — check before any mutation.

## App side (Expo)

- `app.config.ts` reads `EXPO_PUBLIC_ENV` (`development` default) and selects the matching Firebase config + Google services files.
- `eas.json` build profiles set `EXPO_PUBLIC_ENV` per profile (`development`, `preview`, `production`).
- Google services files (`google-services.json`, `GoogleService-Info.plist`) live per environment under `secrets/` — **gitignored, never committed**. For EAS builds reference them via EAS environment variables/file secrets.

## Auth pattern (proven in MenuLens)

Anonymous Firebase Auth in the background as the default identity; account creation is an optional upgrade, never a gate. This keeps onboarding friction-free and works offline-first.

## Pre-production checklist

- [ ] Rules/indexes identical between dev and prod (deploy from repo, never console edits)
- [ ] App Check enforced on prod
- [ ] Crashlytics dSYM/upload wired for EAS builds
- [ ] Production OAuth/bundle IDs registered in the prod project
