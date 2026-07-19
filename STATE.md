# STATE.md — YouTube Buddy

Fortlaufender Arbeitsstand. **Pflege-Regel:** Nach jeder Arbeitseinheit aktualisieren (Datum, was fertig wurde, was als Nächstes ansteht, neue Entscheidungen/offene Punkte).

**Stand:** 2026-07-19
**Aktuelle Phase:** **Phase 0 (Fundament) abgeschlossen ✅** → nächster Schritt **Phase 1 (Auth & YouTube-Read, M1)** gemäß `docs/ROADMAP.md`
**Repo:** `moinsen-dev/youtube_buddy` (GitHub) · Branch: `develop` · Bundle ID: `dev.moinsen.youtubebuddy` · EAS: `@moinsen_dev/youtube-buddy` (verlinkt, `projectId` in `app.json`)

---

## Deliverables

| Deliverable                        | Status | Bemerkung                                                                                                       |
| ---------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| `docs/PRD.md` v1.1                 | ✅     | Module M1–M11, MoSCoW, Risiken, Metriken                                                                        |
| `docs/DESIGN.md` v1.1              | ✅     | Tokens, 15 Wireframes, Tab „Wissen", Guide-Modus, Graph                                                         |
| `docs/ARCHITECTURE.md` v1.1        | ✅     | Stack, Ordnerstruktur, `LLMEngine`, Datenmodell (inkl. `notes`/`concepts`/`note_links`), Plattform-Matrix       |
| `docs/ROADMAP.md` v1.1             | ✅     | 13 Phasen (0–12), Exit-Kriterien, Risiken                                                                       |
| `prototype/` (HTML/CSS)            | ✅     | 9 Seiten, im Browser verifiziert (mobil 375 px / Tablet 800 px / Desktop 1440 px, Console fehlerfrei, Links ok) |
| `AGENTS.md`                        | ✅     | Arbeitsweise, harte Regeln, Konventionen, Agent-Tooling                                                         |
| `docs/AGENT-TOOLING.md` v1.0       | ✅     | Inventar MCPs/Skills/CLIs, Expo-MCP-Detail, Autonomie-Regeln, Verifikationsprotokoll                            |
| GitHub-Repo                        | ✅     | `moinsen-dev/youtube_buddy` (**public**), Initial-Commit auf `develop`                                          |
| **Phase 0 — Fundament (Expo-App)** | ✅     | **Exit-Kriterien alle erfüllt (2026-07-19), Verifikation s. unten**                                             |

## Phase 0 — Verifikation (Exit-Kriterien, ROADMAP §Phase 0)

| Kriterium                            | Status | Beleg                                                                                                                                                                                                |
| ------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App startet auf **Web**              | ✅     | Dev-Server `npx expo start` (Port 8081); alle 3 Breakpoints verifiziert: 375 px → Bottom Tabs, 800 px → Rail, > 1024 px → Sidebar (a11y-Snapshots); Navigation Home → Bibliothek; Console fehlerfrei |
| App startet auf **iOS-Simulator**    | ✅     | iPhone 17 Pro, Expo Go, App geladen, Bottom Tabs + Tab-Wechsel Home → Wissen per Tap verifiziert (Screenshot `.verification/`)                                                                       |
| App startet auf **Android-Emulator** | ✅     | Pixel_9a (API 37, System-Image nachinstalliert, AVD-Skin repariert), Expo Go, App geladen (Screenshot)                                                                                               |
| Navigation zwischen 5 Dummy-Tabs     | ✅     | Web (Klick) + iOS (Tap); Tabs: Home, Bibliothek, Suche, Wissen, Mehr — Labels via `core/i18n` (de)                                                                                                   |
| `npm run lint` grün                  | ✅     | eslint-config-expo, 0 Fehler                                                                                                                                                                         |
| `npm test` grün                      | ✅     | 11 Tests (core/theme Tokens gegen DESIGN §2, core/platform Breakpoints, core/db Migration-Runner), dazu `tsc --noEmit` sauber                                                                        |
| Migration legt leeres Schema an      | ✅     | Metro-Log auf iOS **und** Android: `[db] ready — migrations applied: 0001_init` (settings + quota_log)                                                                                               |

Aufbau: Expo **SDK 57**, React Native 0.86, TypeScript strict, Expo Router (typedRoutes, React Compiler), Bundle ID `dev.moinsen.youtubebuddy` (iOS + Android). Struktur gemäß ARCHITECTURE §2 (`app/` nur Routing, `features/`, `core/`; ergänzt um `features/shell` + `core/i18n`, in ARCHITECTURE nachgetragen). Theme = ausschließlich `core/theme` (Tokens 1:1 aus DESIGN §2, Dark-first + Light-Variante). husky + lint-staged als Pre-Commit. Dev-Server künftig mit `EXPO_UNSTABLE_MCP_SERVER=1 npx expo start` (expo-mcp lokale Capabilities).

## Entscheidungs-Log (User-Entscheidungen)

| Datum      | Entscheidung                                                                                                                                                                                                                    | Alternativen (verworfen)                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 2026-07-19 | Design-Output = Design-Doc + ASCII-Wireframes **+** HTML-Klickprototyp                                                                                                                                                          | Nur Doc / nur Prototyp                                                        |
| 2026-07-19 | KI = Engine-Abstraktion mit 2 Backends (nativ llama.cpp, Web WebLLM)                                                                                                                                                            | KI nur nativ                                                                  |
| 2026-07-19 | Watch-Verlauf = In-App-Tracking (API liefert keinen)                                                                                                                                                                            | Takeout-Import als Hauptquelle; manuell markieren                             |
| 2026-07-19 | Transkripte = Untertitel-Extraktion primär, Whisper später                                                                                                                                                                      | Whisper von Anfang an                                                         |
| 2026-07-19 | Wissensbasis (M11) volle Tiefe in v1: Wiki-Links, Backlinks, **Graph**, Vault-Export                                                                                                                                            | Nur Export / ohne Graph                                                       |
| 2026-07-19 | Guide = Checklisten-Übersicht **+** Vollbild-Schrittkarten (+TTS als Should)                                                                                                                                                    | Nur Checkliste / nur Karten                                                   |
| 2026-07-19 | Navigation: Tab „Wissen" ersetzt „Karten" (5 Tabs)                                                                                                                                                                              | 6 Tabs / unter „Mehr"                                                         |
| 2026-07-19 | Bundle ID `dev.moinsen.youtubebuddy` (bestätigt)                                                                                                                                                                                | `devv.moinsen.youtube_buddy` (Tippfehler + Unterstrich auf iOS ungültig)      |
| 2026-07-19 | GitHub-Repo **public**                                                                                                                                                                                                          | private (Initial-Default)                                                     |
| 2026-07-19 | Agent-Tooling: 22 Expo-Skills (`expo/skills`) in `~/.agents/skills/` installiert; E2E = Maestro (patrol ist Flutter-spezifisch)                                                                                                 | agent-device / Argent (als optional dokumentiert)                             |
| 2026-07-19 | Expo MCP Server (`https://mcp.expo.dev/mcp`) in `~/.kimi-code/mcp.json` konfiguriert (HTTP + OAuth)                                                                                                                             | mcp-remote-Bridge (nicht nötig — HTTP-MCP wird nativ unterstützt)             |
| 2026-07-19 | Kein kimi-Upgrade nötig: installiertes **kimi-code 0.27.0** (Homebrew, Node.js-Linie) ist aktuell; 1.4x-Nummern gehören der Legacy-Python-Linie `kimi-cli` (PyPI). Initiale „Upgrade auf 1.x"-Empfehlung verworfen              | —                                                                             |
| 2026-07-19 | Expo MCP produktiv: OAuth erledigt, Verbindung via **`mcp-remote`-stdio-Bridge** (nativer HTTP-Transport von kimi 0.27.0 hängt mit gespeichertem Token, 30-s-Timeout — Session-Logs; Token selbst valide, `curl`-Test HTTP 200) | nativer `url`-Eintrag (Client-Bug), PAT als statischer Bearer (Secret im Env) |
| 2026-07-19 | **EAS-Projekt-Owner = `moinsen_dev`** (Organisation, User-Entscheidung via AskUserQuestion)                                                                                                                                     | `moinsen_uli` (persönlich)                                                    |
| 2026-07-19 | Projekt-Baseline = **Expo SDK 57** (aktuelles Template) statt „52+" aus AGENTS.md — Docs bleiben kompatibel (52+ als Minimum)                                                                                                   | —                                                                             |
| 2026-07-19 | Struktur ergänzt: `features/shell` (App-Shell-Komponenten) + `core/i18n` (de/en String-Scaffold, DESIGN §7) — in ARCHITECTURE §2 nachgetragen                                                                                   | Shell-Code in `app/` (verletzt „app/ nur Routing")                            |
| 2026-07-19 | Web-DB in Phase 0 = No-op (`core/db/index.web.ts` → null); Web-Persistenz (wa-sqlite/IndexedDB) vertagt auf Phase 11                                                                                                            | expo-sqlite-Web mit wasm-Metro-Config schon in Phase 0                        |

## Offene Punkte (aus PRD §9 / ARCHITECTURE §11)

1. Takeout-Import des historischen Verlaufs — Entscheidung nach erster Nutzung (eingeplant als Could in Phase 10).
2. Whisper-Fallback für Transkripte — Entscheidung nach Phase 3 (Fehlerquote der Untertitel-Extraktion).
3. Finales Chat-Modell — Benchmark in Phase 4 (Qwen3-4B vs. Gemma-3-4B vs. Llama-3.2-3B).
4. Konzept-Dedup-Qualität — Golden-Set-Gate in Phase 7, ggf. Embedding-Clustering.
5. Datentransfer Phone → TV — Entscheidung in Phase 12.

## Nächste Schritte (Phase 1 — Auth & YouTube-Read, M1)

1. Google-Cloud-Projekt + OAuth-Clients (iOS/Android/Web, Consent im Test-Modus); `@react-native-google-signin` nativ, GIS auf Web; Token-Store (SecureStore/SessionStorage).
2. `core/youtube`-Client: Quota-Budget mit `quota_log`, zod-DTOs, ETag-Cache (Whitelist-Endpunkte beachten, PRD §7).
3. Repositories + Sync-Jobs für Subscriptions/Playlists/Playlist-Items/Videos/Likes; Bibliothek-Screen (DESIGN 5.3) mit echten Daten; QuotaMeter in Einstellungen.
4. **Exit:** Login/Logout auf 3 Plattformen; Abos & Watch Later mit echten Daten; Cache-Verhalten (0 Quota bei erneutem Öffnen); Quota-Zähler per Unit-Test belegt.
