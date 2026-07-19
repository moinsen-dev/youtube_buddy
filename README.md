# YouTube Buddy

Local-only Expo-App, die aus passivem YouTube-Konsum verarbeitbares Wissen macht: Sie trackt im In-App-Player, was du schaust, analysiert Videos mit **KI komplett auf dem Gerät** (Zusammenfassungen, Kapitel, Triage), baut daraus Flashcards, Habits, Schritt-für-Schritt-Anleitungen und Reisekarten, macht alles semantisch durchsuchbar und hilft beim Aufräumen toter Abos.

**Plattformen:** iOS · Android · Web · Tablet (responsive) · später Apple TV. **Kein Server** — Daten in lokaler SQLite, einzige Netzwerk-Endpunkte: Google/YouTube-APIs, Modell-Download, Geocoding (Opt-in).

## Status

Aktuell **Planungsphase** — noch kein Code. Die Planungs-Dokumente:

- [`docs/PRD.md`](docs/PRD.md) — Vision, Personas, Feature-Liste M1–M10 (MoSCoW), Nicht-Ziele, Risiken (API-Quota, fehlender Watch-Verlauf, Untertitel-Grauzone), Erfolgsmetriken
- [`docs/DESIGN.md`](docs/DESIGN.md) — Design-System (Dark-first), Komponenten, Screen-Wireframes, Flows
- [`prototype/`](prototype/index.html) — klickbarer HTML/CSS-Prototyp der Key-Screens (einfach im Browser öffnen)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Tech-Stack, Modulstruktur, KI-Engine-Abstraktion, Datenmodell, Plattform-Matrix
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — Phasenplan 0–11 mit Abhängigkeiten und Exit-Kriterien
