# AGENTS.md — YouTube Buddy

Arbeitsvereinbarung für alle (menschlichen und KI-)Beitragenden. **Source of truth** für Was & Warum sind die Docs in `docs/` — dieser Text regelt das Wie.

## Projekt in einem Satz

Local-only Expo-App (iOS, Android, Web, Tablet, später Apple TV), die YouTube-Nutzung mit On-Device-KI strukturiert: schauen, tracken, analysieren und daraus Flashcards, Guides (Schritt-für-Schritt), Habits, Reise-Maps und eine Obsidian-ähnliche, verlinkte Wissensbasis bauen.

**Fakten:**

- Organisation / GitHub: `moinsen-dev` → Repo `moinsen-dev/youtube_buddy`
- Bundle Identifier: `dev.moinsen.youtubebuddy` (iOS/Android)
- Plattform-Engine: Expo SDK 52+, React Native, TypeScript strict, Expo Router
- Dokumentationssprache: Deutsch · Code, Kommentare, Commit-Messages: Englisch

## Repo-Layout

```
docs/PRD.md          # Module M1–M11, MoSCoW, Nicht-Ziele, Risiken, Metriken
docs/DESIGN.md       # Design-Tokens, Komponenten, Wireframes (§5), Flows
docs/ARCHITECTURE.md # Tech-Stack, Ordnerstruktur, KI-Engine, Datenmodell, Plattform-Matrix
docs/ROADMAP.md      # Phasen 0–12 mit Scope, Abhängigkeiten, Exit-Kriterien
docs/AGENT-TOOLING.md # Inventar & Betrieb der Agent-Werkzeuge (MCPs, Skills, CLIs, Expo/EAS)
app/                 # Expo Router — nur Routing + Screen-Composition
features/            # fachliche Module (M1–M11) + shell/
core/                # technische Basis: theme, platform, db, i18n, (später ai-engine, youtube, …)
assets/              # Icons/Splash
prototype/           # Statischer HTML/CSS-Klickprototyp (kein Build)
STATE.md             # Aktueller Arbeitsstand (wird fortlaufend gepflegt)
```

## Arbeitsweise

1. **Docs first.** Jede Feature-Änderung beginnt in den Docs (PRD/DESIGN/ARCHITECTURE/ROADMAP) und wird dort konsistent gehalten (Module M1–M11 deckungsgleich in allen vier Dateien). Erst dann Code.
2. **Phasengetrieben.** Implementierung folgt `docs/ROADMAP.md`, strikt Phase für Phase. Eine Phase ist erst fertig, wenn ihre **Exit-Kriterien** erfüllt und in `STATE.md` abgehakt sind.
3. **Kleine, lauffähige Inkremente.** Jede Phase endet mit einem startfähigen Stand (`npx expo start` läuft auf iOS/Android/Web).
4. **Verifizieren statt behaupten.** Vor jedem Abschluss: `npm run lint`, `npm test`, betroffene Flows manuell durchklicken (bzw. Maestro/Playwright, sobald vorhanden). UI-Änderungen anhand der Design-Tokens aus `docs/DESIGN.md` §2 prüfen.
5. **STATE.md pflegen.** Nach jeder Arbeitseinheit: Status, Entscheidungen und offene Punkte aktualisieren.

## Harte Regeln (nicht verhandelbar)

- **Local-only:** Kein eigener Server, kein Analytics-/Crash-SDK, keine Telemetrie. Erlaubte Netzwerk-Endpunkte (Whitelist): Google OAuth, YouTube Data API, IFrame-Player/Thumbnails, Untertitel-Endpunkte, Hugging Face (Modell-Download), Nominatim (nur Opt-in). Erweiterungen der Whitelist nur per ADR-artigem Eintrag in `docs/PRD.md` §7.
- **YouTube-Compliance:** Wiedergabe nur via IFrame-Player; kein Video-/Audio-Download; kein Hintergrund-Playback; kein `search.list` (Quota).
- **Quota-Disziplin:** Cache-first, Batching, jeder API-Call deklariert Unit-Kosten (`quota_log`).
- **Keine Git-Mutationen ohne Freigabe:** Commits/Pushes nur auf ausdrücklichen Wunsch; niemals `git reset --hard`, Force-Push oder Löschen von Branches ohne explizite Anweisung.

## Agent-Tooling (kimi-code, YOLO-Betrieb)

Ziel: vollautonome Entwicklung ohne menschliche Interaktion. Vollständiges Inventar, Setup und Verifikationsprotokoll: `docs/AGENT-TOOLING.md`.

**Verfügbar (verifiziert 2026-07-19):**

- **22 Expo-Skills** (`expo-*`, `eas-*`) in `~/.agents/skills/` — vor jeder Expo-/EAS-Aufgabe den passenden Skill lesen (z. B. `expo-router`, `expo-upgrade`, `eas-workflows`).
- **MCPs:** `chrome-devtools` ✅ (Web-Verifikation), `patrol` ✅ (Flutter — hier nicht primär), `expo` ✅ **aktiv & authentifiziert** (via `mcp-remote`-Bridge; nativer HTTP-Eintrag hängt in 0.27.0 — Details `docs/AGENT-TOOLING.md` §4).
- **CLIs:** `eas` (eingeloggt als `moinsen_uli`, Paid Plan), `maestro`, `gh`, Xcode 26.6 + iPhone-Sims, Android SDK + AVD `Pixel_9a`, Java 17, CocoaPods, node 22.

**Regeln für autonomen Betrieb:**

- Expo-/EAS-Endpunkte (`mcp.expo.dev`, `api.expo.dev`) sind reines **Build-Time-Tooling**, keine App-Runtime-Endpunkte — die Local-only-Whitelist (PRD §7) bleibt unverändert.
- Ohne Rückfrage erlaubt: lokale Builds/Simulatoren, Tests, Lint, `npx expo install`, EAS-Builds/Workflows lesen und starten.
- Nur mit Freigabe: Store-Submits (`eas submit`, `build_submit`), öffentliche Review-Antworten (App Store/Play), EAS Update auf `production`, Git-Mutationen.
- UI-Verifikation autonom: Maestro-Flows + Screenshots (Expo-MCP `automation_*` ab Phase 0 via `expo-mcp`); Web via chrome-devtools-MCP.

**Erledigt (2026-07-19):** Expo-OAuth-Login; `expo`-MCP ist einsatzbereit. Hinweis: zwei Produktlinien — Legacy-Python `kimi-cli` (PyPI, 1.4x) vs. aktives Node-`kimi-code` (Homebrew, **0.27.0 = aktuell**, kein Upgrade nötig); aktive MCP-Config ist `~/.kimi-code/mcp.json`. Details: `docs/AGENT-TOOLING.md` §4–§5.

## Konventionen (ab Phase 0)

- **Git:** `develop` ist der Integrations-Branch; Features per Branch `phase-<n>-<name>` bzw. `feat/<name>`, Merge zurück nach `develop`. Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:` …), Englisch.
- **Code:** TypeScript strict; Struktur gemäß `docs/ARCHITECTURE.md` §2 (`app/` nur Routing, `features/` fachlich, `core/` technisch; Import-Richtung app → features → core). Theme-Nutzung ausschließlich über `core/theme` (Tokens aus DESIGN.md), keine harten Hexwerte in Komponenten.
- **Tests:** Unit-Tests für `core/` (Ziel > 80 %), Golden-Set-Tests für KI-Templates ab Phase 4, E2E (Maestro) für Kern-Flows.
- **KI-Qualität:** Prompt-Templates sind versioniert (`*.v<n>.ts`); jede Änderung an Template oder Modell muss gegen das Golden-Set laufen.
