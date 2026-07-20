# PRD — {{PROJECT_NAME}}

> Product Requirements Document. Source of truth für **Was & Warum**. Module hier sind deckungsgleich mit DESIGN.md, ARCHITECTURE.md und ROADMAP.md zu halten.

## 1. Vision & Ziel

< eine Seite: Problem, Zielgruppe, Nutzenversprechen >

## 2. Nicht-Ziele

< was die App explizit nicht tut >

## 3. Module (M1–Mn)

| Modul | Name | Beschreibung | MoSCoW |
| ----- | ---- | ------------ | ------ |
| M1 | <Name> | <Scope> | Must |

## 4. MoSCoW-Priorisierung

< Must / Should / Could / Won't >

## 5. Risiken

| Risiko | Eintritt | Impact | Mitigation |
| ------ | -------- | ------ | ---------- |

## 6. Metriken

< lokale Erfolgsmetriken — keine Telemetrie >

## 7. Netzwerk-Whitelist (Local-only)

Erlaubte Endpunkte zur Laufzeit der App. **Jede Erweiterung nur per ADR-artigem Eintrag hier.**

- <z. B. Google OAuth, YouTube Data API, IFrame-Player/Thumbnails, …>

> Build-Time-Tooling (z. B. `mcp.expo.dev`, `api.expo.dev`, EAS) ist kein App-Netzwerkverkehr und nicht Teil dieser Liste.
