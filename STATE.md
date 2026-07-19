# STATE.md — YouTube Buddy

Fortlaufender Arbeitsstand. **Pflege-Regel:** Nach jeder Arbeitseinheit aktualisieren (Datum, was fertig wurde, was als Nächstes ansteht, neue Entscheidungen/offene Punkte).

**Stand:** 2026-07-19
**Aktuelle Phase:** **Phase 1 (Auth & YouTube-Read, M1) abgeschlossen ✅** → nächster Schritt **Phase 2 (Player & Watch-Tracking, M2)** gemäß `docs/ROADMAP.md`
**Repo:** `moinsen-dev/youtube_buddy` (GitHub) · Branch: `develop` · Bundle ID: `dev.moinsen.youtubebuddy` · EAS: `@moinsen_dev/youtube-buddy` (verlinkt, `projectId` in `app.json`)

---

## Deliverables

| Deliverable                            | Status | Bemerkung                                                                                                                                                        |
| -------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/PRD.md` v1.1                     | ✅     | Module M1–M11, MoSCoW, Risiken, Metriken                                                                                                                         |
| `docs/DESIGN.md` v1.1                  | ✅     | Tokens, 15 Wireframes, Tab „Wissen", Guide-Modus, Graph                                                                                                          |
| `docs/ARCHITECTURE.md` v1.1            | ✅     | Stack, Ordnerstruktur, `LLMEngine`, Datenmodell (inkl. `notes`/`concepts`/`note_links`), Plattform-Matrix                                                        |
| `docs/ROADMAP.md` v1.1                 | ✅     | 13 Phasen (0–12), Exit-Kriterien, Risiken                                                                                                                        |
| `prototype/` (HTML/CSS)                | ✅     | 9 Seiten, im Browser verifiziert (mobil 375 px / Tablet 800 px / Desktop 1440 px, Console fehlerfrei, Links ok)                                                  |
| `AGENTS.md`                            | ✅     | Arbeitsweise, harte Regeln, Konventionen, Agent-Tooling                                                                                                          |
| `docs/AGENT-TOOLING.md` v1.0           | ✅     | Inventar MCPs/Skills/CLIs, Expo-MCP-Detail, Autonomie-Regeln, Verifikationsprotokoll                                                                             |
| GitHub-Repo                            | ✅     | `moinsen-dev/youtube_buddy` (**public**), Initial-Commit auf `develop`                                                                                           |
| **Phase 0 — Fundament (Expo-App)**     | ✅     | **Exit-Kriterien alle erfüllt (2026-07-19), Verifikation s. unten**                                                                                              |
| **Phase 1 — Auth & YouTube-Read (M1)** | ✅     | **Exit-Kriterien alle erfüllt (2026-07-19): Login/Logout auf Web/iOS/Android, echte Abos nach Sync, Cache ohne Quota, Quota-Zähler per Unit-Test + live belegt** |

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

| Datum      | Entscheidung                                                                                                                                                                                                                       | Alternativen (verworfen)                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 2026-07-19 | Design-Output = Design-Doc + ASCII-Wireframes **+** HTML-Klickprototyp                                                                                                                                                             | Nur Doc / nur Prototyp                                                          |
| 2026-07-19 | KI = Engine-Abstraktion mit 2 Backends (nativ llama.cpp, Web WebLLM)                                                                                                                                                               | KI nur nativ                                                                    |
| 2026-07-19 | Watch-Verlauf = In-App-Tracking (API liefert keinen)                                                                                                                                                                               | Takeout-Import als Hauptquelle; manuell markieren                               |
| 2026-07-19 | Transkripte = Untertitel-Extraktion primär, Whisper später                                                                                                                                                                         | Whisper von Anfang an                                                           |
| 2026-07-19 | Wissensbasis (M11) volle Tiefe in v1: Wiki-Links, Backlinks, **Graph**, Vault-Export                                                                                                                                               | Nur Export / ohne Graph                                                         |
| 2026-07-19 | Guide = Checklisten-Übersicht **+** Vollbild-Schrittkarten (+TTS als Should)                                                                                                                                                       | Nur Checkliste / nur Karten                                                     |
| 2026-07-19 | Navigation: Tab „Wissen" ersetzt „Karten" (5 Tabs)                                                                                                                                                                                 | 6 Tabs / unter „Mehr"                                                           |
| 2026-07-19 | Bundle ID `dev.moinsen.youtubebuddy` (bestätigt)                                                                                                                                                                                   | `devv.moinsen.youtube_buddy` (Tippfehler + Unterstrich auf iOS ungültig)        |
| 2026-07-19 | GitHub-Repo **public**                                                                                                                                                                                                             | private (Initial-Default)                                                       |
| 2026-07-19 | Agent-Tooling: 22 Expo-Skills (`expo/skills`) in `~/.agents/skills/` installiert; E2E = Maestro (patrol ist Flutter-spezifisch)                                                                                                    | agent-device / Argent (als optional dokumentiert)                               |
| 2026-07-19 | Expo MCP Server (`https://mcp.expo.dev/mcp`) in `~/.kimi-code/mcp.json` konfiguriert (HTTP + OAuth)                                                                                                                                | mcp-remote-Bridge (nicht nötig — HTTP-MCP wird nativ unterstützt)               |
| 2026-07-19 | Kein kimi-Upgrade nötig: installiertes **kimi-code 0.27.0** (Homebrew, Node.js-Linie) ist aktuell; 1.4x-Nummern gehören der Legacy-Python-Linie `kimi-cli` (PyPI). Initiale „Upgrade auf 1.x"-Empfehlung verworfen                 | —                                                                               |
| 2026-07-19 | Expo MCP produktiv: OAuth erledigt, Verbindung via **`mcp-remote`-stdio-Bridge** (nativer HTTP-Transport von kimi 0.27.0 hängt mit gespeichertem Token, 30-s-Timeout — Session-Logs; Token selbst valide, `curl`-Test HTTP 200)    | nativer `url`-Eintrag (Client-Bug), PAT als statischer Bearer (Secret im Env)   |
| 2026-07-19 | **EAS-Projekt-Owner = `moinsen_dev`** (Organisation, User-Entscheidung via AskUserQuestion)                                                                                                                                        | `moinsen_uli` (persönlich)                                                      |
| 2026-07-19 | Projekt-Baseline = **Expo SDK 57** (aktuelles Template) statt „52+" aus AGENTS.md — Docs bleiben kompatibel (52+ als Minimum)                                                                                                      | —                                                                               |
| 2026-07-19 | Struktur ergänzt: `features/shell` (App-Shell-Komponenten) + `core/i18n` (de/en String-Scaffold, DESIGN §7) — in ARCHITECTURE §2 nachgetragen                                                                                      | Shell-Code in `app/` (verletzt „app/ nur Routing")                              |
| 2026-07-19 | Web-DB in Phase 0 = No-op (`core/db/index.web.ts` → null); Web-Persistenz (wa-sqlite/IndexedDB) vertagt auf Phase 11                                                                                                               | expo-sqlite-Web mit wasm-Metro-Config schon in Phase 0                          |
| 2026-07-19 | GCP-Projekt = `youtube-buddy-moinsen` (neu, per Console-Automation); Consent External/Testing mit Test-User; OAuth-Clients Web/iOS/Android + zweiter Android-Client für `android/app/debug.keystore` (Fingerprint `5E:8F:…:F6:25`) | `youtube-buddy` (ID global vergeben), bestehendes Projekt `email-agents-496114` |
| 2026-07-19 | Android-Signing: `expo prebuild`-eigener `android/app/debug.keystore` ist maßgeblich; globaler Keystore nur Referenz. Für EAS Builds: EAS-Key-SHA-1 später ebenfalls als Android-Client registrieren                               | Globalen Keystore als einzige Wahrheit (falsch, verursachte DEVELOPER_ERROR)    |

## Phase 1 — Ergebnis (2026-07-19, abgeschlossen)

**Gebaut:** Migration `0002_m1_youtube_read` (channels/subscriptions/videos/playlists/playlist_items); `core/youtube` (zod-DTOs, Quota-Budget mit `quota_log`, Client mit ETag-Cache/401-Refresh/Backoff, Sync-Jobs mit TTL cache-first); `features/auth` (Token-Store SecureStore/sessionStorage, Google-Login nativ+GIS, Auth-Context, Login-Screen als Gate); `features/library` (Bibliothek mit echten Abos, QuotaMeter, Mehr mit Konto/Abmelden). 30 Tests + tsc + Lint grün.

**GCP (fertig, via Console-Automation):** Projekt `youtube-buddy-moinsen`, YouTube Data API v3 aktiviert, Consent External/Testing, Test-User `developer@moinsen.dev`, Scopes inkl. `youtube.readonly`. OAuth-Clients: Web `870515903914-qmu75gejgjhb6676vvai47ccnkq8g5ar`, iOS `870515903914-8vk5cfiql8nl5imt2g6r3es35s5hrgj7`, Android `870515903914-8fojd8vmo79d32doaimovc6b4tsnqscu` + zweiter Android-Client (debug app-local) — jeweils `.apps.googleusercontent.com`. Client-IDs stehen in `app.json → extra.google`, iOS-URL-Scheme im Config-Plugin. Dev-Clients gebaut & installiert (iPhone 17 Pro Sim, Pixel_9a Emulator).

**Verifikations-Matrix (Exit-Kriterien erfüllt):**

| Plattform | Login/Logout                        | Sync (echte Daten)                                              | Cache (0 Quota)                                                         |
| --------- | ----------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Web       | ✅                                  | ✅ (Abos von developer@moinsen.dev)                             | ⚠️ Web hat keine lokale DB (Phase 1, bewusst; Persistenz erst Phase 11) |
| iOS       | ✅                                  | ✅ 2 Kanäle echt, 2. Sync 0 Requests (TTL), QuotaMeter 3/10.000 | ✅                                                                      |
| Android   | ✅ (nach SHA-1-Fix, User bestätigt) | ✅ (User bestätigt)                                             | ✅                                                                      |

**Gelöste Fehler:**

1. **Android `DEVELOPER_ERROR`:** Ursache = **SHA-1-Mismatch** — `expo prebuild` erzeugt einen eigenen `android/app/debug.keystore` (Fingerprint `5E:8F:…:F6:25`), registriert war der globale `~/.android/debug.keystore` (`51:AA:…:1A:8D`). Fix: zweiter Android-OAuth-Client mit dem app-lokalen Fingerprint. **Merke für EAS Builds:** EAS generiert eigene Signatur-Keys → deren SHA-1 muss dann ebenfalls als Android-Client registriert werden.
2. **iOS Sync schlug fehl:** Ursache = **stale Bundle** aus der toten Metro-Instanz vor dem `--clear`-Restart (die Fixes „fetch binding" + „Endpoint-Pfade" waren auf dem Gerät nicht geladen). Nach Terminate + Re-Open lief alles.

**Sonstiges:** `ios/Podfile` enthält Fix `pod 'GoogleUtilities'/'RecaptchaInterop', :modular_headers => true` (AppCheckCore). Android-AVD `Pixel_9a` wurde repariert (System-Image android-37 nachinstalliert, Skin-Eintrag in `~/.android/avd/Pixel_9a.avd/config.ini` auf `1080x2424`/`_no_skin` geändert — User-Maschine, beabsichtigt).

## Offene Punkte (aus PRD §9 / ARCHITECTURE §11)

1. Takeout-Import des historischen Verlaufs — Entscheidung nach erster Nutzung (eingeplant als Could in Phase 10).
2. Whisper-Fallback für Transkripte — Entscheidung nach Phase 3 (Fehlerquote der Untertitel-Extraktion).
3. Finales Chat-Modell — Benchmark in Phase 4 (Qwen3-4B vs. Gemma-3-4B vs. Llama-3.2-3B).
4. Konzept-Dedup-Qualität — Golden-Set-Gate in Phase 7, ggf. Embedding-Clustering.
5. Datentransfer Phone → TV — Entscheidung in Phase 12.

## Nächste Schritte (Phase 2 — Player & Watch-Tracking, M2)

1. IFrame-Player-Wrapper (WebView nativ, iframe Web) mit einheitlicher Event-API; `PlayerTracker` schreibt `watch_sessions` (5-s-Ticks, Pause/Ende).
2. Video-Detail-Screen Grundgerüst (DESIGN 5.4, ohne KI-Tabs); Home-Screen (5.2) mit „Weiterschauen"-Rail.
3. Verlaufs-Tab in Bibliothek; „Als geschaut markieren" (manuell).
4. **Exit:** Video schauen → Session mit korrektem Prozentwert in DB; App-Neustart → „Weiterschauen" setzt an letzter Position fort; 80-%-Schwelle markiert „geschaut".
