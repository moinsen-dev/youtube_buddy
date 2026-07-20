# AGENTS.md — {{PROJECT_NAME}}

Arbeitsvereinbarung für alle (menschlichen und KI-)Beitragenden. **Source of truth** für Was & Warum sind die Docs in `docs/` — dieser Text regelt das Wie.

## Projekt in einem Satz

< eine Zeile Produktidee > — Local-only Expo-App (iOS, Android, Web).

**Fakten:**

- Organisation / GitHub: `{{GITHUB_ORG}}` → Repo `{{GITHUB_ORG}}/{{PROJECT_NAME}}`
- Bundle Identifier: `{{BUNDLE_ID}}` (iOS/Android)
- Plattform-Engine: Expo SDK 52+, React Native, TypeScript strict, Expo Router
- Dokumentationssprache: Deutsch · Code, Kommentare, Commit-Messages: Englisch

## Repo-Layout

```
docs/PRD.md          # Module, MoSCoW, Nicht-Ziele, Risiken, Metriken
docs/DESIGN.md       # Design-Tokens, Komponenten, Wireframes, Flows
docs/ARCHITECTURE.md # Tech-Stack, Ordnerstruktur, Datenmodell, Plattform-Matrix
docs/ROADMAP.md      # Phasen mit Scope, Abhängigkeiten, Exit-Kriterien
docs/AGENT-TOOLING.md # Inventar & Betrieb der Agent-Werkzeuge (MCPs, Skills, CLIs)
app/                 # Expo Router — nur Routing + Screen-Composition
features/            # fachliche Module + shell/
core/                # technische Basis: theme, platform, db, i18n, …
assets/              # Icons/Splash
STATE.md             # Aktueller Arbeitsstand (wird fortlaufend gepflegt)
.verification/       # Screenshots/Belege der Verifikation
```

## Arbeitsweise

1. **Docs first.** Jede Feature-Änderung beginnt in den Docs (PRD/DESIGN/ARCHITECTURE/ROADMAP) und wird dort konsistent gehalten. Erst dann Code.
2. **Phasengetrieben.** Implementierung folgt `docs/ROADMAP.md`, strikt Phase für Phase. Eine Phase ist erst fertig, wenn ihre **Exit-Kriterien** erfüllt und in `STATE.md` abgehakt sind.
3. **Kleine, lauffähige Inkremente.** Jede Phase endet mit einem startfähigen Stand (`npx expo start` läuft auf iOS/Android/Web).
4. **Verifizieren statt behaupten.** Vor jedem Abschluss: `npm run lint`, `npm test`, betroffene Flows manuell durchklicken bzw. Maestro. UI-Änderungen anhand der Design-Tokens aus `docs/DESIGN.md` prüfen.
5. **STATE.md pflegen.** Nach jeder Arbeitseinheit: Status, Entscheidungen und offene Punkte aktualisieren.

## Harte Regeln (nicht verhandelbar)

- **Local-only:** Kein eigener Server, kein Analytics-/Crash-SDK, keine Telemetrie. Erlaubte Netzwerk-Endpunkte stehen in der Whitelist in `docs/PRD.md` (Abschnitt „Netzwerk-Whitelist"). Erweiterungen nur per ADR-artigem Eintrag dort.
- **Keine Git-Mutationen ohne Freigabe:** Commits/Pushes nur auf ausdrücklichen Wunsch; niemals `git reset --hard`, Force-Push oder Löschen von Branches ohne explizite Anweisung.
- **Theme-Disziplin:** Styling ausschließlich über `core/theme` (Tokens aus DESIGN.md), keine harten Hexwerte in Komponenten.
- **Quota-Disziplin (bei externen APIs):** Cache-first, Batching, jeder API-Call deklariert seine Einheiten-Kosten (`quota_log`).

## Agent-Tooling

- **MCP-Server:** projektlokal in `.mcp.json` (`expo` via mcp-remote-Bridge, `chrome-devtools` für Web-Verifikation). Setup/Troubleshooting: Skill `expo-mcp-setup`.
- **Skills:** offizielle Expo/EAS-Skills (`npx skills add expo/skills`) + Stack-Skills aus `moinsen-expo-stacks`. Vor jeder Expo-/EAS-Aufgabe den passenden Skill lesen (z. B. `expo-router`, `eas-workflows`).
- **Autonomie-Regeln:** Skill `eas-autonomy` (was ohne Freigabe erlaubt ist: lokale Builds/Tests/EAS-Reads; was Freigabe braucht: Submits, Store-Antworten, Production-Updates, Git-Mutationen).
- **Dev-Server:** künftig mit `EXPO_UNSTABLE_MCP_SERVER=1 npx expo start` (lokale Expo-MCP-Capabilities).

## Konventionen

- **Git:** `develop` ist der Integrations-Branch; Features per Branch `phase-<n>-<name>` bzw. `feat/<name>`, Merge zurück nach `develop`. Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:` …), Englisch.
- **Code:** TypeScript strict; Import-Richtung `app → features → core`.
- **Tests:** Unit-Tests für `core/` (Ziel > 80 %), E2E (Maestro) für Kern-Flows.
