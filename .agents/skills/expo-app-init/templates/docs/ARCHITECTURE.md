# ARCHITECTURE — {{PROJECT_NAME}}

> Technische Struktur. Änderungen an Ordnerstruktur/Datenmodell werden hier zuerst beschlossen.

## 1. Tech-Stack

< Expo SDK, RN-Version, TS strict, Router, DB, State-Management, Test-Stack >

## 2. Ordnerstruktur

```
app/       # Expo Router — nur Routing + Screen-Composition
features/  # fachliche Module + shell/
core/      # technische Basis: theme, platform, db, i18n, …
```

Import-Richtung: `app → features → core` (keine Zyklen, `core` kennt `features` nicht).

## 3. Datenmodell (lokal)

< Tabellen/Entities, Migrationen, Indizes >

## 4. Externe Integrationen

< APIs mit Quota-Kosten, Auth-Flüsse, Caching-Strategie >

## 5. Plattform-Matrix

| Feature | iOS | Android | Web | Anmerkung |
| ------- | --- | ------- | --- | --------- |

## 6. Sicherheit & Datenschutz

< Local-only-Garantien, Token-Speicherung (SecureStore), Whitelist s. PRD §7 >
