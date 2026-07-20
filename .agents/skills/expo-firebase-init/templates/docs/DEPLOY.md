# DEPLOY — {{PROJECT_NAME}}

> Umgebungen und Deploy-Pfade. **Default ist immer `development`.** Alles gegen `production` braucht ausdrückliche Freigabe.

## Umgebungen

| Umgebung | Firebase-Projekt | Auswahl |
| -------- | ---------------- | ------- |
| development (Default) | `{{PROJECT_NAME}}-dev` | `firebase use default` bzw. `EXPO_PUBLIC_ENV=development` |
| production | `{{PROJECT_NAME}}-prod` | `firebase use production` + `EXPO_PUBLIC_ENV=production` |

- App-seitige Umschaltung: `app.config.ts` liest `EXPO_PUBLIC_ENV` und wählt Firebase-Config + Google-Service-Dateien (`secrets/`, gitignored).
- EAS: Build-Profiles in `eas.json` setzen `EXPO_PUBLIC_ENV` pro Profile.

## Firebase deployen (nur dev ohne Freigabe)

```bash
firebase use default
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Vorher: Rules validieren + Emulator-Tests (Skill `firebase-rules-workflow`).

## App bauen (EAS)

```bash
eas build --profile development --platform ios      # dev
eas build --profile production --platform ios       # NUR mit Freigabe
```

## Store-Submit

`eas submit` bzw. EAS-Workflow-Submits: **immer freigabepflichtig.**
