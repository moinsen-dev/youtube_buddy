# STATE.md — YouTube Buddy

Fortlaufender Arbeitsstand. **Pflege-Regel:** Nach jeder Arbeitseinheit aktualisieren (Datum, was fertig wurde, was als Nächstes ansteht, neue Entscheidungen/offene Punkte).

**Stand:** 2026-07-19
**Aktuelle Phase:** Planung abgeschlossen → nächster Schritt **Phase 0 (Fundament)** gemäß `docs/ROADMAP.md`
**Repo:** `moinsen-dev/youtube_buddy` (GitHub) · Branch: `develop` · Bundle ID: `dev.moinsen.youtubebuddy`

---

## Deliverables

| Deliverable | Status | Bemerkung |
|---|---|---|
| `docs/PRD.md` v1.1 | ✅ | Module M1–M11, MoSCoW, Risiken, Metriken |
| `docs/DESIGN.md` v1.1 | ✅ | Tokens, 15 Wireframes, Tab „Wissen", Guide-Modus, Graph |
| `docs/ARCHITECTURE.md` v1.1 | ✅ | Stack, Ordnerstruktur, `LLMEngine`, Datenmodell (inkl. `notes`/`concepts`/`note_links`), Plattform-Matrix |
| `docs/ROADMAP.md` v1.1 | ✅ | 13 Phasen (0–12), Exit-Kriterien, Risiken |
| `prototype/` (HTML/CSS) | ✅ | 9 Seiten, im Browser verifiziert (mobil 375 px / Tablet 800 px / Desktop 1440 px, Console fehlerfrei, Links ok) |
| `AGENTS.md` | ✅ | Arbeitsweise, harte Regeln, Konventionen, Agent-Tooling |
| `docs/AGENT-TOOLING.md` v1.0 | ✅ | Inventar MCPs/Skills/CLIs, Expo-MCP-Detail, Autonomie-Regeln, Verifikationsprotokoll |
| GitHub-Repo | ✅ | `moinsen-dev/youtube_buddy` (**public**), Initial-Commit auf `develop` |

## Entscheidungs-Log (User-Entscheidungen)

| Datum | Entscheidung | Alternativen (verworfen) |
|---|---|---|
| 2026-07-19 | Design-Output = Design-Doc + ASCII-Wireframes **+** HTML-Klickprototyp | Nur Doc / nur Prototyp |
| 2026-07-19 | KI = Engine-Abstraktion mit 2 Backends (nativ llama.cpp, Web WebLLM) | KI nur nativ |
| 2026-07-19 | Watch-Verlauf = In-App-Tracking (API liefert keinen) | Takeout-Import als Hauptquelle; manuell markieren |
| 2026-07-19 | Transkripte = Untertitel-Extraktion primär, Whisper später | Whisper von Anfang an |
| 2026-07-19 | Wissensbasis (M11) volle Tiefe in v1: Wiki-Links, Backlinks, **Graph**, Vault-Export | Nur Export / ohne Graph |
| 2026-07-19 | Guide = Checklisten-Übersicht **+** Vollbild-Schrittkarten (+TTS als Should) | Nur Checkliste / nur Karten |
| 2026-07-19 | Navigation: Tab „Wissen" ersetzt „Karten" (5 Tabs) | 6 Tabs / unter „Mehr" |
| 2026-07-19 | Bundle ID `dev.moinsen.youtubebuddy` (bestätigt) | `devv.moinsen.youtube_buddy` (Tippfehler + Unterstrich auf iOS ungültig) |
| 2026-07-19 | GitHub-Repo **public** | private (Initial-Default) |
| 2026-07-19 | Agent-Tooling: 22 Expo-Skills (`expo/skills`) in `~/.agents/skills/` installiert; E2E = Maestro (patrol ist Flutter-spezifisch) | agent-device / Argent (als optional dokumentiert) |
| 2026-07-19 | Expo MCP Server (`https://mcp.expo.dev/mcp`) in `~/.kimi-code/mcp.json` konfiguriert (HTTP + OAuth) | mcp-remote-Bridge (nicht nötig — HTTP-MCP wird nativ unterstützt) |
| 2026-07-19 | Kein kimi-Upgrade nötig: installiertes **kimi-code 0.27.0** (Homebrew, Node.js-Linie) ist aktuell; 1.4x-Nummern gehören der Legacy-Python-Linie `kimi-cli` (PyPI). Initiale „Upgrade auf 1.x"-Empfehlung verworfen | — |
| 2026-07-19 | Expo MCP produktiv: OAuth erledigt, Verbindung via **`mcp-remote`-stdio-Bridge** (nativer HTTP-Transport von kimi 0.27.0 hängt mit gespeichertem Token, 30-s-Timeout — Session-Logs; Token selbst valide, `curl`-Test HTTP 200) | nativer `url`-Eintrag (Client-Bug), PAT als statischer Bearer (Secret im Env) |

## Offene Punkte (aus PRD §9 / ARCHITECTURE §11)

1. Takeout-Import des historischen Verlaufs — Entscheidung nach erster Nutzung (eingeplant als Could in Phase 10).
2. Whisper-Fallback für Transkripte — Entscheidung nach Phase 3 (Fehlerquote der Untertitel-Extraktion).
3. Finales Chat-Modell — Benchmark in Phase 4 (Qwen3-4B vs. Gemma-3-4B vs. Llama-3.2-3B).
4. Konzept-Dedup-Qualität — Golden-Set-Gate in Phase 7, ggf. Embedding-Clustering.
5. Datentransfer Phone → TV — Entscheidung in Phase 12.

## Nächste Schritte (Phase 0 — Fundament)

0. Agent-Setup im Projekt (gemäß `docs/AGENT-TOOLING.md` §5.4): `eas init` (Projekt linken, `projectId` in `app.json`), `npx expo install expo-mcp --dev`, Dev-Server künftig mit `EXPO_UNSTABLE_MCP_SERVER=1 npx expo start`.
1. Expo-Projekt + TypeScript strict + Expo Router initialisieren (Bundle ID `dev.moinsen.youtubebuddy`).
2. `core/theme` aus DESIGN.md §2 (Dark-first Tokens) umsetzen.
3. Responsive Shell mit 5 Dummy-Tabs (Home, Bibliothek, Suche, Wissen, Mehr).
4. expo-sqlite + Drizzle Setup inkl. Migration-Runner.
5. ESLint/Prettier/husky + Jest-Grundsetup.
6. **Exit:** App läuft auf iOS-Simulator, Android-Emulator, Web; Lint + Tests grün.
