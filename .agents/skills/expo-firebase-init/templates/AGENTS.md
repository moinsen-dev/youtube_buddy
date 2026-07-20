# AGENTS.md — {{PROJECT_NAME}}

Arbeitsvereinbarung für alle (menschlichen und KI-)Beitragenden. **Source of truth** für Was & Warum: `docs/PRD.md` und die Task-Dateien in `planning/`.

## Project Snapshot

{{PROJECT_NAME}} — Expo-App (iOS, Android, Web) mit Firebase-Backend (Auth, Firestore, Storage, Crashlytics, Remote Config). Bundle ID `{{BUNDLE_ID}}`, Org `{{GITHUB_ORG}}`.

**Must-read before acting:** `docs/PRD.md`, `STATE.md` (am Ende jeder Session aktualisieren), die aktuelle Task-Datei in `planning/`.

## Guardrails

- **Phase discipline.** Umsetzung folgt den Task-Dateien in `planning/`. Kein Task N+1, bevor die Exit-Kriterien von Task N erfüllt sind.
- **Two environments, always.** `development` (Default, Firebase-Projekt `{{PROJECT_NAME}}-dev`) und `production` (`{{PROJECT_NAME}}-prod`). Agenten arbeiten ausschließlich gegen **dev**; prod nur mit ausdrücklicher Freigabe. Details: Skill `firebase-environments`.
- **Rules & indexes live in the repo.** `firestore.rules`, `storage.rules`, `firestore.indexes.json` werden nie in der Console editiert (Drift). Workflow: Skill `firebase-rules-workflow`.
- **No service-account files.** Auth für CLI und Firebase-MCP läuft über den Firebase-CLI-Login (`firebase login`). Keine heruntergeladenen Service-Account-JSONs im Repo oder auf der Maschine.
- **Zero tolerance for quality regressions.** `npm run lint`, `npx tsc --noEmit` und `npm test` bleiben grün. Kein Mock-Code in `src/`, keine Placeholder-Screens, kein „coming soon"-UI.
- **Keine Git-Mutationen ohne Freigabe** (Commits/Pushes nur auf ausdrücklichen Wunsch).

## Stack & Architecture

- **Framework:** Expo SDK 52+, React Native, TypeScript strict, Expo Router
- **Firebase:** Auth (anonymous-first), Firestore, Storage, Crashlytics, Remote Config, App Check
- **Environments:** via `app.config.ts` + EAS-Build-Profiles (`EXPO_PUBLIC_ENV=development|production`); Google-Service-Dateien pro Umgebung unter `secrets/` (gitignored)

## Directory Layout

```
app/                  # Expo Router — nur Routing + Screen-Composition
src/                  # Features + Shared Code (data/, ui/, config/)
docs/PRD.md           # Product requirements
docs/DEPLOY.md        # Umgebungs- und Deploy-Anleitung
planning/             # eine selbst-contained Task-Datei pro Task
STATE.md              # aktueller Status (jede Session aktualisieren)
firebase.json         # Firebase-Config (Emulator-Ports etc.)
firestore.rules       # Security Rules (versioniert)
firestore.indexes.json
storage.rules
.firebaserc           # Projekt-Aliase; Default = dev
secrets/              # Google-Service-Dateien (gitignored, nie committen)
```

## Common Commands

```bash
npm start                        # Dev-Server (development-Umgebung)
npm run lint && npm test         # müssen grün bleiben
npx tsc --noEmit
firebase emulators:start         # lokale Firebase-Emulatoren
firebase use                     # aktives Projekt anzeigen (muss dev sein)
```

## Tooling — MCP Servers

Konfiguriert in `.mcp.json`, geladen beim Session-Start:

- **firebase** — Projekt-Operationen auf dem per `firebase use` gepinnten Projekt: Security Rules validieren, Auth-User verwalten, Firestore/Storage, Crashlytics, Remote Config. Auth kommt vom Firebase-CLI-Login dieser Maschine; der Server ist mit `--dir` auf dieses Repo und mit `--only` auf die benötigten Produkte eingeschränkt. Details: Skill `firebase-mcp-ops`.
- **chrome-devtools** — Web-Plattform verifizieren (Snapshots, Console, Network).
- **ios-simulator** — iOS-Simulator-Automatisierung (Screenshots, Taps).
