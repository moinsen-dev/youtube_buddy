# YouTube Buddy

Local-only Expo-App, die aus passivem YouTube-Konsum verarbeitbares Wissen macht: Sie trackt im In-App-Player, was du schaust, analysiert Videos mit **KI komplett auf dem Gerät** (Zusammenfassungen, Kapitel, Triage), baut daraus Flashcards, Habits, Schritt-für-Schritt-Anleitungen (mit Vollbild-Guide-Modus) und Reisekarten, verlinkt alles in einer **Obsidian-ähnlichen Wissensbasis** (Wiki-Links, Backlinks, Graph, Vault-Export), macht es semantisch durchsuchbar und hilft beim Aufräumen toter Abos.

**Plattformen:** iOS · Android · Web · Tablet (responsive) · später Apple TV. **Kein Server** — Daten in lokaler SQLite, einzige Netzwerk-Endpunkte: Google/YouTube-APIs, Modell-Download, Geocoding (Opt-in).

## Neue Session / Onboarding

1. [`STATE.md`](STATE.md) lesen — aktueller Stand, Entscheidungs-Log, nächste Schritte.
2. [`AGENTS.md`](AGENTS.md) lesen — Arbeitsweise, harte Regeln, Konventionen.
3. Danach gilt: nächste Phase aus [`docs/ROADMAP.md`](docs/ROADMAP.md) umsetzen (aktuell: **Phase 0**).

## Status

Aktuell **Planungsphase abgeschlossen** — noch kein App-Code. Die Planungs-Dokumente:

- [`docs/PRD.md`](docs/PRD.md) — Vision, Personas, Feature-Liste M1–M11 (MoSCoW), Nicht-Ziele, Risiken (API-Quota, fehlender Watch-Verlauf, Untertitel-Grauzone), Erfolgsmetriken
- [`docs/DESIGN.md`](docs/DESIGN.md) — Design-System (Dark-first), Komponenten, 15 Screen-Wireframes, Flows
- [`prototype/`](prototype/index.html) — klickbarer HTML/CSS-Prototyp der Key-Screens (einfach im Browser öffnen)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Tech-Stack, Modulstruktur, KI-Engine-Abstraktion, Datenmodell, Plattform-Matrix
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — Phasenplan 0–12 mit Abhängigkeiten und Exit-Kriterien

**Repo:** `moinsen-dev/youtube_buddy` (public) · Branch: `develop` · Bundle ID: `dev.moinsen.youtubebuddy`
