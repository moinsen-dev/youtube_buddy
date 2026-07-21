# STATE.md — YouTube Buddy

Fortlaufender Arbeitsstand. **Pflege-Regel:** Nach jeder Arbeitseinheit aktualisieren (Datum, was fertig wurde, was als Nächstes ansteht, neue Entscheidungen/offene Punkte).

**Stand:** 2026-07-21
**Aktuelle Phase:** **Phase 11 (Web-KI & Web-Polish) — Kern gelegt ✅** (Web-DB, Datei-Brücke Phone→Web, Read-only-Modus; Rest WebLLM/schriftliche Parität offen) → Details unten
**Pro-Tier (Paid):** per ADR beschlossen (PRD §7.6): E2E-Sync via **Firebase** (gleiches GCP-Projekt) + Cloud-Analyse via **Firebase AI / Gemini** (Opt-in), RevenueCat — Umsetzung als **Phase 10.5**
**Tooling-Update (2026-07-20):** 46 projektlokale Skills installiert (`.agents/skills/` + `skills-lock.json` im Repo): RevenueCat-Toolkit (`rc-*`, `revenuecat-*`), Firebase-Workflows, Moinsen-Stacks — `.claude/` ist gitignored (Symlink-Cache, wird aus dem Lockfile neu gebaut). **Neustart von kimi-code nötig, damit die Skills geladen werden.**
**Repo:** `moinsen-dev/youtube_buddy` (GitHub) · Branch: `develop` · Bundle ID: `dev.moinsen.youtubebuddy` · EAS: `@moinsen_dev/youtube-buddy` (verlinkt, `projectId` in `app.json`)

---

## Deliverables

| Deliverable                                | Status | Bemerkung                                                                                                                                                                                                    |
| ------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/PRD.md` v1.1                         | ✅     | Module M1–M11, MoSCoW, Risiken, Metriken                                                                                                                                                                     |
| `docs/DESIGN.md` v1.1                      | ✅     | Tokens, 15 Wireframes, Tab „Wissen", Guide-Modus, Graph                                                                                                                                                      |
| `docs/ARCHITECTURE.md` v1.1                | ✅     | Stack, Ordnerstruktur, `LLMEngine`, Datenmodell (inkl. `notes`/`concepts`/`note_links`), Plattform-Matrix                                                                                                    |
| `docs/ROADMAP.md` v1.1                     | ✅     | 13 Phasen (0–12), Exit-Kriterien, Risiken                                                                                                                                                                    |
| `prototype/` (HTML/CSS)                    | ✅     | 9 Seiten, im Browser verifiziert (mobil 375 px / Tablet 800 px / Desktop 1440 px, Console fehlerfrei, Links ok)                                                                                              |
| `AGENTS.md`                                | ✅     | Arbeitsweise, harte Regeln, Konventionen, Agent-Tooling                                                                                                                                                      |
| `docs/AGENT-TOOLING.md` v1.0               | ✅     | Inventar MCPs/Skills/CLIs, Expo-MCP-Detail, Autonomie-Regeln, Verifikationsprotokoll                                                                                                                         |
| GitHub-Repo                                | ✅     | `moinsen-dev/youtube_buddy` (**public**), Initial-Commit auf `develop`                                                                                                                                       |
| **Phase 0 — Fundament (Expo-App)**         | ✅     | **Exit-Kriterien alle erfüllt (2026-07-19), Verifikation s. unten**                                                                                                                                          |
| **Phase 1 — Auth & YouTube-Read (M1)**     | ✅     | **Exit-Kriterien alle erfüllt (2026-07-19): Login/Logout auf Web/iOS/Android, echte Abos nach Sync, Cache ohne Quota, Quota-Zähler per Unit-Test + live belegt**                                             |
| **Phase 2 — Player & Watch-Tracking (M2)** | ✅     | **Exit-Kriterien alle erfüllt (2026-07-19): IFrame-Player auf 3 Plattformen, Sessions mit korrekten Prozentwerten in DB, Weiterschauen-Rail mit Resume (53 % → Start bei 1:53), Verlauf-Tab, 80-%-Schwelle** |

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

| Datum      | Entscheidung                                                                                                                                                                                                                                                                                                                                                        | Alternativen (verworfen)                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 2026-07-19 | Design-Output = Design-Doc + ASCII-Wireframes **+** HTML-Klickprototyp                                                                                                                                                                                                                                                                                              | Nur Doc / nur Prototyp                                                                      |
| 2026-07-19 | KI = Engine-Abstraktion mit 2 Backends (nativ llama.cpp, Web WebLLM)                                                                                                                                                                                                                                                                                                | KI nur nativ                                                                                |
| 2026-07-19 | Watch-Verlauf = In-App-Tracking (API liefert keinen)                                                                                                                                                                                                                                                                                                                | Takeout-Import als Hauptquelle; manuell markieren                                           |
| 2026-07-19 | Transkripte = Untertitel-Extraktion primär, Whisper später                                                                                                                                                                                                                                                                                                          | Whisper von Anfang an                                                                       |
| 2026-07-19 | Wissensbasis (M11) volle Tiefe in v1: Wiki-Links, Backlinks, **Graph**, Vault-Export                                                                                                                                                                                                                                                                                | Nur Export / ohne Graph                                                                     |
| 2026-07-19 | Guide = Checklisten-Übersicht **+** Vollbild-Schrittkarten (+TTS als Should)                                                                                                                                                                                                                                                                                        | Nur Checkliste / nur Karten                                                                 |
| 2026-07-19 | Navigation: Tab „Wissen" ersetzt „Karten" (5 Tabs)                                                                                                                                                                                                                                                                                                                  | 6 Tabs / unter „Mehr"                                                                       |
| 2026-07-19 | Bundle ID `dev.moinsen.youtubebuddy` (bestätigt)                                                                                                                                                                                                                                                                                                                    | `devv.moinsen.youtube_buddy` (Tippfehler + Unterstrich auf iOS ungültig)                    |
| 2026-07-19 | GitHub-Repo **public**                                                                                                                                                                                                                                                                                                                                              | private (Initial-Default)                                                                   |
| 2026-07-19 | Agent-Tooling: 22 Expo-Skills (`expo/skills`) in `~/.agents/skills/` installiert; E2E = Maestro (patrol ist Flutter-spezifisch)                                                                                                                                                                                                                                     | agent-device / Argent (als optional dokumentiert)                                           |
| 2026-07-19 | Expo MCP Server (`https://mcp.expo.dev/mcp`) in `~/.kimi-code/mcp.json` konfiguriert (HTTP + OAuth)                                                                                                                                                                                                                                                                 | mcp-remote-Bridge (nicht nötig — HTTP-MCP wird nativ unterstützt)                           |
| 2026-07-19 | Kein kimi-Upgrade nötig: installiertes **kimi-code 0.27.0** (Homebrew, Node.js-Linie) ist aktuell; 1.4x-Nummern gehören der Legacy-Python-Linie `kimi-cli` (PyPI). Initiale „Upgrade auf 1.x"-Empfehlung verworfen                                                                                                                                                  | —                                                                                           |
| 2026-07-19 | Expo MCP produktiv: OAuth erledigt, Verbindung via **`mcp-remote`-stdio-Bridge** (nativer HTTP-Transport von kimi 0.27.0 hängt mit gespeichertem Token, 30-s-Timeout — Session-Logs; Token selbst valide, `curl`-Test HTTP 200)                                                                                                                                     | nativer `url`-Eintrag (Client-Bug), PAT als statischer Bearer (Secret im Env)               |
| 2026-07-19 | **EAS-Projekt-Owner = `moinsen_dev`** (Organisation, User-Entscheidung via AskUserQuestion)                                                                                                                                                                                                                                                                         | `moinsen_uli` (persönlich)                                                                  |
| 2026-07-19 | Projekt-Baseline = **Expo SDK 57** (aktuelles Template) statt „52+" aus AGENTS.md — Docs bleiben kompatibel (52+ als Minimum)                                                                                                                                                                                                                                       | —                                                                                           |
| 2026-07-20 | mcp-remote auf `@0.1.36` **gepinnt** (`~/.kimi-code/mcp.json`) — Auto-Update zog ständig neue Versionen mit jeweils leerem Auth-Dir (`~/.mcp-auth/mcp-remote-<version>/`) → OAuth-Prompt-Flut + blockierte Flows = MCP-Timeouts; 0.1.36 hat komplette Tokens (Access + Refresh, ~30 Tage) und verbindet jetzt **ohne** Browser-Prompt                               | `npx -y mcp-remote` (immer latest)                                                          |
| 2026-07-19 | Struktur ergänzt: `features/shell` (App-Shell-Komponenten) + `core/i18n` (de/en String-Scaffold, DESIGN §7) — in ARCHITECTURE §2 nachgetragen                                                                                                                                                                                                                       | Shell-Code in `app/` (verletzt „app/ nur Routing")                                          |
| 2026-07-19 | Web-DB in Phase 0 = No-op (`core/db/index.web.ts` → null); Web-Persistenz (wa-sqlite/IndexedDB) vertagt auf Phase 11                                                                                                                                                                                                                                                | expo-sqlite-Web mit wasm-Metro-Config schon in Phase 0                                      |
| 2026-07-19 | GCP-Projekt = `youtube-buddy-moinsen` (neu, per Console-Automation); Consent External/Testing mit Test-User; OAuth-Clients Web/iOS/Android + zweiter Android-Client für `android/app/debug.keystore` (Fingerprint `5E:8F:…:F6:25`)                                                                                                                                  | `youtube-buddy` (ID global vergeben), bestehendes Projekt `email-agents-496114`             |
| 2026-07-19 | Android-Signing: `expo prebuild`-eigener `android/app/debug.keystore` ist maßgeblich; globaler Keystore nur Referenz. Für EAS Builds: EAS-Key-SHA-1 später ebenfalls als Android-Client registrieren                                                                                                                                                                | Globalen Keystore als einzige Wahrheit (falsch, verursachte DEVELOPER_ERROR)                |
| 2026-07-20 | **Chat-Modell final: Qwen3-4B-Instruct Q4** (≥ 6 GB RAM) + **Llama-3.2-3B Q4** (4-GB-Tier); beide 100 % schema-valid via json_schema                                                                                                                                                                                                                                | Gemma-3-4B (kein Vorteil gezeigt)                                                           |
| 2026-07-20 | `n_ctx`-Cap 4096 statt 8192 (KV-Cache halbiert; M4/M5-Prompts ≪ 4096 Tokens)                                                                                                                                                                                                                                                                                        | 8192 (verursachte Android-Emulator-Swap-Thrashing)                                          |
| 2026-07-20 | llama.rn auf Web **lazy** laden (`await import`) + `Platform.OS`-Guards für expo-file-system — statischer Import crashte den Mehr-Tab auf Web                                                                                                                                                                                                                       | Plattform-gate an der Komponente (Import-Kette bricht trotzdem)                             |
| 2026-07-20 | expo-sqlite mit `useNewConnection: true` (Registry-Handles sterben nach llama.rn-JSI → `NativeDatabase`-NPE) + `resetDb()` nach Modell-Load + Selbstheilungs-Probe in `getDb()`                                                                                                                                                                                     | Strong-Ref auf das JS-Objekt (wirkungslos, JSI-Finalisierung)                               |
| 2026-07-20 | **Pro-Tier (Paid) beschlossen:** E2E-Sync + Cloud-Analyse als Opt-in-Hybrid; **Firebase** (im bestehenden GCP-Projekt), **Groq** (Llama-70B via Cloud Function), **RevenueCat** — Free bleibt 100 % local-only; Umsetzung als **Phase 10.5** (ADR: PRD §7.6)                                                                                                        | Sync-only-E2E / Cloud-only / kein Pro-Tier; Supabase (s. nächste Zeile)                     |
| 2026-07-20 | **Server-Stack = Firebase statt Supabase** (ADR-Korrektur am selben Tag): gleiches GCP-Projekt `youtube-buddy-moinsen` (YouTube-API + Google-OAuth bereits konfiguriert → keine Zweit-Auth) + erprobter Moinsen-Stack `expo-firebase` (menulens: Firebase-MCP via CLI-Login, dev/prod, Rules-Workflow, Emulator). **Kein** Crashlytics/Analytics (Local-only-Regel) | Supabase (zweites Auth-System, neues Tooling)                                               |
| 2026-07-20 | **Cloud-LLM = Firebase AI (Gemini) statt Groq** — volle Konsolidierung im selben GCP-Projekt (Billing/IAM/EU an einem Ort, kein Dritt-Provider-Key); Gemini-Flash-Klasse via Cloud Function, JSON-Mode via `responseSchema`                                                                                                                                         | Groq (Llama-70B — schnell/günstig, aber Dritt-Provider mit eigener Key-/Billing-Verwaltung) |

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

## Phase 2 — Ergebnis (2026-07-19, abgeschlossen)

**Gebaut:** Migration `0003_m2_watch_tracking` (+ Index); `features/player` (IFrame-Player WebView nativ + iframe Web mit einheitlicher Event-API, `PlayerTracker` pure mit 5-s-Ticks/Throttle, Video-Detail mit Resume + „Als geschaut markieren" + Metadaten-Fetch für unbekannte Videos); `features/home` (Home mit Weiterschauen-/Watch-Later-Rails, VideoCard); Verlauf-Tab in Bibliothek; Repositories (Sessions, offene Sessions, Verlauf, Playlist-Videos). 38 Tests + tsc + Lint grün.

**Verifikations-Matrix (Exit-Kriterien erfüllt):**

| Kriterium                        | iOS                                                  | Android                               | Web                                               |
| -------------------------------- | ---------------------------------------------------- | ------------------------------------- | ------------------------------------------------- |
| IFrame-Player spielt             | ✅                                                   | ✅                                    | ✅                                                |
| Session in DB (Position/Prozent) | ✅ (sqlite3 verifiziert: 113 s, 53 %)                | ✅ (run-as verifiziert: 14 s, 73,6 %) | ⚠️ Tracking live, DB No-op (Phase 1-Entscheidung) |
| Weiterschauen-Rail + Resume      | ✅ (Rail mit Balken, Detail lädt 53 % + start=113 s) | ✅ (Rail mit Balken)                  | — (kein Cache)                                    |
| 80-%-Schwelle „geschaut"         | ✅ (19-s-Video → 100 %, Badge im Verlauf)            | ✅                                    | ✅ (Logik per Unit-Test)                          |
| Verlauf-Tab                      | ✅                                                   | ✅                                    | ✅                                                |

**Gelöste Fehler / Entscheidungen:**

1. **WebView-Embed „Fehler 153/152-4":** YouTube verlangt eine valide HTTP-Origin — `baseUrl: 'http://localhost:8081'` im WebView-HTML (identisch zur funktionierenden Web-Origin). `youtube.com` als baseUrl schlägt fehl (Self-Embed-Check).
2. **„Bridge tot"-Fehldiagnose:** Der Expo-Dev-Client zeigte nach `terminate`+`openurl` nur den Launcher („Searching for development servers") — Testzyklen liefen gegen den Launcher statt die App. Korrekte Sequenz: erst `exp+youtube-buddy://expo-development-client/?url=…` (App laden), dann `youtubebuddy://…` (Route).
3. **Manueller Sync = TTL-Bypass:** Der Sync-Button erzwingt nun immer einen Fetch (ARCHITECTURE §6 „TTL oder manuell"); automatische Syncs bleiben TTL-gesteuert (0 Quota bei erneutem Öffnen).
4. **Bekannte Warnung (nicht blockierend):** Beim App-Start erscheint sporadisch `NativeDatabase.execAsync … cannot rollback - no transaction is active` (drizzle/expo-sqlite) — Sessions/Writes funktionieren dennoch korrekt; beobachten, ggf. in Phase 3 analysieren.

| **Phase 3 — Transkript-Pipeline (M3)** | ✅ | **Exit-Kriterien alle erfüllt (2026-07-19): 10/10 reale Testvideos mit Transkript + korrekten Zeitstempeln (`scripts/check-transcripts.ts`), Cache (1 Abruf/Video, DB-verifiziert), States inkl. Empty/Error+Retry** |

## Phase 3 — Ergebnis (2026-07-19, abgeschlossen)

**Gebaut:** Migration `0004_m3_transcripts` (transcripts + transcript_chunks + Index); `features/transcripts` (Extraktions-Adapter via **`youtube-transcript`** mit Sprach-Fallback de → en → erste, `chunker` ~800 Zeichen mit Zeitstempel-Erhalt, `use-transcript` Hook cache-first, `TranscriptPanel` mit States loading/ready/no-captions/error+retry); Web geht über die Server-Route `app/api/transcript/[id]+api.ts` (CORS); DB-Repositories. 42 Tests + tsc + Lint grün.

**Verifikation:**

- **10/10 reale Testvideos** (Kurzgesagt-RSS, öffentlich) liefern Transkripte mit sauberen Zeitstempeln (`npx tsx scripts/check-transcripts.ts` → 10/10 ok; ASR-Overlaps sind erwartetes YouTube-Verhalten, kein Fehler).
- **iOS In-App:** Transkript-Panel im Video-Detail (3 Abschnitte, Sprache en, Mono-Zeitstempel); DB verifiziert: `transcripts` (en/captions) + 3 Chunks von 1,36 s bis 211,32 s.
- **Cache:** Meta-Check schlägt Netzwerk nur beim ersten Abruf an (1 Abruf/Video); Zweitöffnen kommt aus der lokalen DB.
- **Web:** gleiche Ansicht über die API-Route (Server-seitige Extraktion).

**Entscheidungen:**

1. **Extraktion via `youtube-transcript`-Bibliothek statt Eigenbau** — der handgeschriebene Scraper (Watch-Page → captionTracks → timedtext) schlug fehl: YouTube liefert auf diesem Pfad inzwischen leere Responses. Die Bibliothek bildet die aktuellen Endpunkte ab und ist in PRD §7.1 explizit als Referenz-Ansatz genannt.
2. **Whisper-Fallback (offene Phase-3-Frage): NICHT nötig** — Extraktion funktioniert zuverlässig (Fehlerquote 0/10). Whisper bleibt Could-Option für Videos ohne Untertitel.
3. **Web-Transkripte über API-Route** (`+api.ts`) — youtube.com sendet keine CORS-Header; produktionsreife Entscheidung (EAS Hosting vs. Client-seitig) fällt in Phase 11.

| **Phase 4 — KI-Engine Core (M4)** | ✅ | **Exit-Kriterien erfüllt (2026-07-20): Modell lädt iOS+Android, `generate` 100 % schema-valid (json_schema, 0 % Repair), iOS Ø 18,1 Tok/s (≥ 10), Golden-Set-Suite 10/10, Abbruch verifiziert. Modell-Entscheidung final. Einschränkung: Android-Tok/s nur Emulator-artefaktbehaftet messbar → physisches Gerät offen** |

## Phase 4 — Ergebnis (2026-07-20, abgeschlossen)

**Gebaut:** `core/ai-engine` (`types.ts` mit `LLMEngine`-Interface; `model-registry.ts` mit 3 Kandidaten + RAM-basierter Empfehlung; `model-manager.ts` Download via expo-file-system mit Resume + chunked SHA-256 + Speicher-Checks; `llama-cpp-engine.ts` auf llama.rn mit `response_format: json_schema` (GBNF-erzwungen) + zod + 1 Repair-Retry + AbortSignal → `stopCompletion()`; Prompt-Templates `ping.v1` + `summarize.v1`; `benchmark.ts` + `golden-set.json` = 10 reale Kurzgesagt-Transkripte, im Repo); `use-model-manager.ts` Hook; `features/library/model-section.tsx` im Mehr-Tab (DESIGN 5.11: Download/Laden/Entladen/Löschen, Fortschritt, freier Speicher, Smoke-Test mit Abbrechen-Button, Benchmark-Button). 54 Tests + tsc + Lint grün. llama.rn ^0.12.6, Dev-Clients iOS+Android neu gebaut (ab hier kein Expo Go mehr).

**Verifikations-Matrix (Exit-Kriterien):**

| Kriterium                 | iOS (Sim, iPhone 17 Pro)                           | Android (Emulator Pixel_9a, 8 GB)                                                        |
| ------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Modell lädt               | ✅ Llama-3B + Qwen3-4B                             | ✅ Llama-3B (Smoke: Modellwechsel/Entladen ok)                                           |
| `generate` schema-konform | ✅ 10/10 + 6/6 Items `ok=true`                     | ✅ 12/12 Items `ok=true` (über alle Läufe)                                               |
| Repair-Quote              | ✅ 0 % (json_schema erzwingt)                      | ✅ 0 %                                                                                   |
| ≥ 10 Tok/s                | ✅ **Ø 18,1 Tok/s** (Smoke 19,2), Qwen ~11–15      | ⚠️ **0,4–0,7 Tok/s = Emulator-Artefakt** (s. unten), physisches Gerät offen              |
| Golden-Set-Suite          | ✅ 10/10 grün, deutsches Sample inhaltlich korrekt | — (abgebrochen, s. unten)                                                                |
| Abbruch funktioniert      | ✅ (Code)                                          | ✅ live verifiziert: Abbrechen → Fehlerstate „abgebrochen", Engine danach weiter nutzbar |

**Benchmark-Daten iOS:** Llama-3.2-3B Q4: 10/10, valid 100 %, repaired 0 %, Ø 18,1 Tok/s, 576 s gesamt; Sample: „Die Welt ist voller Kaijus, die uns unsichtbar bedrohen…" (deutsch, korrekt). Qwen3-4B Q4: 6/10 Items (Run durch versehentlichen Logout unterbrochen), valid 100 %, repaired 0 %, ~11–15 Tok/s — ausreichend als Beleg für Schema-Treue + Entscheidung.

**Android-Perf-Befund (ehrlich dokumentiert):** Der Emulator (arm64 nativ unter HVF, 4 vCPU) erreicht nur 0,4–0,7 Tok/s. Ursache: App-RES ~5,2 GB (3,2 G anonym: KV-Cache + Compute-Buffer + RN) + Android/Play-Services → Gast-Swap (665 MB) mit 78 % sys / 53 % irq (virtio-Swap-I/O). Auf 6 GB AVD noch schlimmer (754 MB Swap). Kein CPU-Translations-Problem (abi arm64-v8a nativ). **Fazit:** Emulator eignet sich für Funktions-, nicht für Perf-Validierung; ≥ 10 Tok/s auf Pixel-Hardware bleibt offener Punkt (z. B. via EAS-Build auf physischem Gerät). Gegenprobe 2-GB-AVD: OOM-Crash bei 3B **und** 4B → RAM-Guidance (≥ 4 GB für 3B, ≥ 6 GB für 4B) empirisch bestätigt.

**Gelöste Fehler / Entscheidungen:**

1. **Modell-Entscheidung final:** **Qwen3-4B-Instruct Q4 = Default für ≥ 6 GB RAM** (bessere Qualität laut Kandidaten-Analyse, 100 % schema-valid), **Llama-3.2-3B Q4 für 4-GB-Geräte** (schneller, kleiner, ebenfalls 100 % schema-valid). Gemma-3-4B verworfen (kein Vorteil gezeigt, ein Download weniger). `recommendedModel(totalMemory)` bildet das ab.
2. **Web-Crash Mehr-Tab:** statischer Import `llama.rn` zog das native Modul in den Web-Bundle → Tab crashte; zusätzlich warfen `getFreeDiskStorageAsync`/`getInfoAsync` auf Web. Fix: Engine wird lazy per `await import('./llama-cpp-engine')` erzeugt (`use-model-manager.ts`), `model-manager.ts` hat `Platform.OS === 'web'`-Guards. Verifiziert via chrome-devtools: Tab rendert, 0 Console-Errors, Engine-Controls auf Web disabled.
3. **`n_ctx`-Cap 8192 → 4096** (`llama-cpp-engine.ts`): halbiert den KV-Cache; alle M4/M5-Prompts (Chunks ~800 Zeichen) passen locker. 8192 trug zum Swap-Thrashing bei.
4. **AVD Pixel_9a RAM: 2048 → 8192 MB** (`~/.android/avd/Pixel_9a.avd/config.ini`, User-Maschine, entspricht der Pixel-7-Referenz mit 8 GB); Cold Boot mit `-no-snapshot-load` nötig.
5. **Fast Refresh entlädt das Modell** (Engine-Singleton im JS) → Benchmarks nie parallel zu Code-Edits laufen lassen.

| **Phase 5 — Video-Analyse (M5)** | ✅ | **Exit-Kriterien erfüllt (2026-07-20): Golden-Set-Video mit vollständiger Analyse (Summary + Kapitel mit echten Zeitstempeln, Sprung verifiziert), Triage-Batch über Watch-Later mit Fortschritt; P50-Messung Emulator-artefaktbehaftet (s. Phase 4), phys. Gerät offen** |

## Phase 5 — Ergebnis (2026-07-20, abgeschlossen)

**Gebaut:** Migration `0005_m5_analyses` (analyses + UNIQUE(video_id, kind) + Index); `core/ai-engine/engine-instance.ts` (geteilte lazy Engine — Web-sicher); Templates `summarize-reduce.v1`, `chapters.v1`, `triage.v1`; `features/analysis` (`analyze.ts` Map/Reduce-Pipeline, 8 Chunks/Gruppe, Fortschritt + AbortSignal; `use-analysis.ts`; `triage-batch.ts`; UI: `analysis-section.tsx`, `analysis-sheet.tsx` (DESIGN 5.5: Fortschritt, On-Device-Badge mit Modellname, Abbrechen), `summary-panel.tsx` (TL;DR + ausklappbare Langfassung + Key-Points mit Zeitstempel-Chips), `chapter-list.tsx` (aktives Kapitel), `triage-badge.tsx` (Score-Farben DESIGN §4)); `features/home/triage-section.tsx` (DESIGN 5.2: Queue-Rows + „Analysiere Queue ▸" mit Fortschritt/Abbrechen); Player `seekSeconds` (nativ via `injectJavaScript`, web via `YT.Player.seekTo`); Video-Detail mit Analyse-Sektion (CTA ab 30 % geschaut, ARCHITECTURE §5.1); `ensure-transcript.ts` (nicht-Hook-Transkriptpfad für Batch/Analyse). 62 Tests + tsc + eslint 0 Fehler.

**Verifikations-Matrix (Exit-Kriterien):**

| Kriterium                               | Beleg                                                                                                                                                                                   |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Golden-Set-Video: vollständige Analyse  | ✅ `Xf-uUy5pdUI` (12:22, 15 Chunks → 5 Schritte): TL;DR + Langfassung + Key-Points mit **echten Zeitstempeln** (0:01, 6:37 = Chunk-Grenzen), 3 `analyses`-Rows DB-verifiziert           |
| Zeitstempel-Sprünge korrekt             | ✅ Chapter-Tap → `seekTo` → Wiedergabe ab Position bis Videoende (Replay-Symbol); aktiv markiertes Kapitel                                                                              |
| Triage-Batch über Queue mit Fortschritt | ✅ 4/4 Videos (Rail gespiegelt, s. WL-Befund): Fortschrittsbalken „Analysiere Queue… n/4 (lokal)" + Abbrechen; Badges farbkorrekt (1–2 rot), Sortierung Score desc; Rows DB-verifiziert |
| P50-Analysezeit < 90 s Referenzgerät    | ⚠️ Emulator-artefaktbehaftet (Phase 4): Golden-Set-Video ~10 min, Kurzvideo ~2 min — Messung auf physischer Hardware offen                                                              |
| Analyse-Abbruch                         | ✅ Sheet mit Abbrechen-Button (Mechanik = Phase-4-verifizierter AbortController-Pfad)                                                                                                   |

**Gelöste Fehler / Entscheidungen:**

1. **expo-sqlite-NPE nach `initLlama` (Root Cause + Fix):** Nach llama.rn-JSI-Aktivität starben expo-sqlite-Handles aus der shared Registry sporadisch mit `NativeDatabase.* has been rejected → NullPointerException` (bekanntes expo-sqlite-Problem). Fix-Kette: `openDatabaseSync(…, { useNewConnection: true })` (umgeht die Registry — dokumentierter Workaround), `resetDb()` nach jedem Modell-Load, Selbstheilungs-Probe in `getDb()` (SELECT 1, bei NPE Neuöffnung). Danach lief der komplette Triage-Batch mit interleavter Inferenz + DB-Zugriff stabil.
2. **Watch-Later bei Viewer-Accounts nicht via offizieller API erreichbar (Produkt-Befund):** `channels.list(mine=true)` → 0 Items, `playlists.list(mine=true)` → 404, `playlistItems.list("WL")` → leere 200. Der Account (reiner Zuschauer ohne Creator-Channel) hat keine API-sichtbare WL-Playlist; Subscriptions funktionieren. **ADR-Frage an den User** (Optionen: youtubei-interner Endpunkt per Whitelist-ADR / Playlist-Pinning-Setting / Feature-Degradation). Bis dahin: Fallback `playlistId = 'WL'` implementiert (schadet nicht, hilft evtl. Legacy-Accounts).
3. **Analyse-CTA bei „nur Triage" unerreichbar** → CTA-Logik: vollständig erst mit summary + chapters; Triage aus dem Batch allein → „Vollständig analysieren (lokal)".
4. **llama.rn statischer Import crashte Web** (Mehr-Tab) → lazy `await import` über `engine-instance` (Phase 4 nachgezogen).
5. **Stale Engine-Hinweis** in Triage-Section (peekEngine nur beim Rendern) → Fokus-Refresh via `loadTriages`.

**Qualitäts-Notizen (für Phase 6/7 relevant):** Triage-Kalibrierung des 3B-Modells ist zu streng (alle Scores 1–2, auch bei Kurzgesagt) — Golden-Set-Gate für Triage-Prompt nötig. Kapitel sparsam bei kurzen Videos (2 Gruppen → 2 Kapitel, je ~6 min) — ggf. kleinere Map-Gruppen oder Kapitel-Minimum im Template.

| **Phase 6 — Wissensmodule & Guide-Modus (M6)** | ✅ | **Exit-Kriterien erfüllt (2026-07-20): Kochvideo → 8 Karten + Guide mit Quellen-Zeitstempeln, Guide-Modus 1→3 durchklickt (Fortschritt persistiert), TTS liest vor, „Im Video ansehen" + Rücksprung verifiziert, SM-2 per Tests + Live-Scheduling in DB** |

## Phase 6 — Ergebnis (2026-07-20, abgeschlossen)

**Gebaut:** Migration `0006_m6_knowledge` (notes, flashcards + due-Index, flashcard_reviews, habits, habit_checks, guides); `features/flashcards/srs.ts` (SM-2 pure + Streak, 8 Tests mit simulierten Tagen); Templates `flashcards.v1`, `habits.v1`, `howto.v1`; `features/knowledge` (`generate.ts`: analyses.summary → 3 Engine-Calls → Karten/Habits/Guide **plus Notes-Einträge** (M11-Grundlage, ARCHITECTURE §5.3); `knowledge-screen.tsx` (DESIGN 5.13: Review-Kachel mit Fälligkeit + Streak, Guides mit Fortschritt, Habits mit Tages-Checkboxen, Notizen-Liste); `knowledge-section.tsx` im Video-Detail (CTA „Karten & Guide erstellen" mit Fortschritt/Abbrechen + freie Markdown-Notiz type `free`)); `features/flashcards/review-screen.tsx` (DESIGN 5.6: Queue, Tap-to-Flip, Quellen-Link, 4 Grade-Buttons, Streak); `features/guides` (`guide-screen.tsx` DESIGN 5.7: Material-Checkliste, Schritte mit Zeitstempel-Sprüngen, Resume-Label; `guide-mode-screen.tsx` DESIGN 5.12: Vollbild-StepCards, Fortschrittsbalken, Buttons ≥ 64 pt, Swipe via PanResponder, `progress_step`-Persistierung, **TTS via expo-speech** mit Stopp-State); Routes `/review`, `/guide/[id]`, `/guide-mode/[id]`; `?t=<sec>` im Video-Deep-Link (Startposition). 73 Tests + tsc + eslint 0 Fehler. expo-speech als natives Modul → Dev-Client-Rebuilds (Android ✅, iOS läuft).

**Verifikations-Matrix (Exit-Kriterien, Kochvideo „Sourdough Bread | Basics with Babish", 25:45, 37 Chunks):**

| Kriterium                                                 | Beleg                                                                                                                                                                             |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ≥ 8 Karten + 1 Anleitung mit korrekten Quellen            | ✅ **8 Karten** (z. B. „Was ist Sourdough-Bread?") + **Guide** (5 Schritte, 5 Materialien, Zeitstempel 0:00/5:44/16:27/22:16) — DB-verifiziert, Triage dazu 4/5 „Tutorial · hoch" |
| Guide-Modus komplett durchklickbar, speichert Fortschritt | ✅ Schritt 1→3 geklickt (Swipe vorhanden), `progress_step=2` in DB, Übersicht „SCHRITTE 2/5 ✓", Resume „(ab Schritt 3)"                                                           |
| TTS liest einen Schritt vor                               | ✅ Button wechselt zu „⏸ Stopp" (expo-speech, Android)                                                                                                                            |
| „Im Video ansehen" springt zum Zeitstempel und zurück     | ✅ 16:27 → Video-Detail mit 64 % Resume-Position; Zurück → Schritt 3/5 erhalten                                                                                                   |
| SM-2 plant Reviews korrekt (Unit-Tests + simulierte Tage) | ✅ 8 Tests (1→6→e·n-Leiter, Relearn-Reset, Ease-Floor 1.3, Streak-Logik); **live in DB:** 3 Reviews (grade 4) → `reps=1, interval_days=1`                                         |

**Gelöste Fehler / Entscheidungen:**

1. **Generation hängt bei App im Hintergrund** — die JS-Seite pausiert, die llama.rn-Completion kommt nie zurück (Befund: App-CPU 3,8 % während „Erstelle…"). Abbrechen + Retry funktioniert; für lange Läufe muss die App im Vordergrund bleiben (Back-Off/Resume später).
2. **Stale Section-States** — `KnowledgeSection` prüfte Analyse/Engine nur beim Mount; auf `useFocusEffect` umgestellt (gleiches Muster wie Home).
3. **eslint react-hooks (v6):** PanResponder in `useMemo` mit aktuellen Capture-Werten statt Refs im Render; `Date.now()` nicht im Render.
4. **Notes ab jetzt:** Jede Generierung schreibt `flashcard_set`/`habit`/`guide`-Notizen — Wiki-Link-/Konzept-Pipeline folgt in Phase 7.

| **Phase 7 — Wissensbasis (M11)** | ✅ | **Exit-Kriterien erfüllt (2026-07-20): `[[…]]` löst auf Konzept-/Summary-Notizen auf, Backlinks komplett (beide Richtungen), Graph rendert lokal, Vault-ZIP mit YAML-Frontmatter + funktionierenden Wiki-Links, Rename-Rewrite per Unit-Test** |

## Phase 7 — Ergebnis (2026-07-20, abgeschlossen)

**Gebaut:** Migration `0007_m11_knowledge_base` (`concepts` UNIQUE name, `note_links` + beide Indizes, `notes(type, updated_at)`-Index); `core/markdown` (`wiki-links.ts` Parser mit Obsidian-Regeln (`[[t]]`/`[[t|alias]]`, Case-Dedup), `resolver.ts` mit injizierbarem LinkLookup (Konzept → Titel, ungelöste Links erlaubt), `note-store.ts`: jeder Notiz-Write parsed + resolved + ersetzt Links — `note_links` spiegelt immer `body_md`; `renameConcept` mit `rewriteLinkInBody`); `extract_concepts.v1` Template + `features/knowledge/concept-extraction.ts` (Batch nach jeder Analyse: Summary-Notiz anlegen/aktualisieren, Konzepte mit Dedup gegen `concepts`, Quellen beidseitig verlinken); UI: `note-detail-screen.tsx` (DESIGN 5.14: Segmente mit tappable Links, Quellen-Chip, Backlink-Panel, Graph-Einstieg), Wissen-Tab vollständig (Konzept-Chips mit Quellen-Zahl, Notizen → Detail, Graph-/Export-Buttons), `graph-screen.tsx` (DESIGN 5.15: d3-force-Layout zur Laufzeit, react-native-svg, Filter Alle/Konzepte/Videos, Tap → Detail, Legende), `markdown-editor.tsx` (`[[`-Autocomplete über Konzepte + Titel, in der freien Notiz), `core/export/vault.ts` + `vault-share.ts` (Ordnerstruktur Konzepte/Guides/Summaries/Karten/Habits/Notizen, YAML-Frontmatter, jszip-ZIP + expo-sharing). Pakete: d3-force (+@types), react-native-svg, jszip, expo-sharing (Dev-Client-Rebuild Android). 92 Tests + tsc + eslint 0 Fehler.

**Verifikations-Matrix (Exit-Kriterien):**

| Kriterium                       | Beleg                                                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[[…]]` löst auf                | ✅ Konzept-Notiz „Drilling": `[[Summary: …]]` als tappable Info-Link; Summary-Notiz: 6 Konzept-Links; DB: 12 `note_links` resolved=1 (beide Richtungen) |
| Backlinks zeigen Erwähnungen    | ✅ Konzept „WIRD ERWÄHNT IN (1)" (Summary), Summary „WIRD ERWÄHNT IN (6)" (alle Konzepte)                                                               |
| Konzept-Extraktion + Dedup      | ✅ 6 sinnvolle Konzepte aus dem Kaiju-Video (Microwelt, Protisten, Kaiju, Giftpflanzen, Drilling, Naturgewalt), Chips mit Quellen-Zahl                  |
| Graph rendert lokal             | ✅ 7 Nodes (6 Konzepte + Video), Filter, Legende, Tap → Detail (Layout < 500 ms bei diesem Bestand; 1.000-Node-Benchmark offen, Bestand zu klein)       |
| Vault-Export öffnet in Obsidian | ✅ ZIP (12 Dateien) mit Ordnern + YAML-Frontmatter (title/type/video/source/created/updated/tags) + intakten `[[…]]`-Links; Share-Sheet verifiziert     |
| Umbenennen aktualisiert Links   | ✅ `rewriteLinkInBody` per Unit-Test (Case, Alias-Erhalt, Regex-Escape); DB-Orchestrierung `renameConcept`                                              |

**Gelöste Fehler / Entscheidungen:**

1. **typedRoutes-Typen** für neue Routen regenieren erst bei Metro-Neustart (`router.d.ts`); bei Bedarf kurz `expo start --port 8083` für Typegen.
2. **react-hooks-Regeln vs. d3-force** — Layout als reines `useMemo` (kein `Date.now`/Logging im Memo); Zeitmessung nur bei Verifikation.
3. **`@types/d3-force` fehlte** (Paket ist typlos) — als devDependency ergänzt.
4. **run:android-Timeouts hängen nach erfolgreichem Install** — APK/lastUpdateTime prüfen, dann Metro separat als Hintergrund-Task starten (`EXPO_UNSTABLE_MCP_SERVER=1 npx expo start --port 8081`).

| **Phase 8 — Reise-Modul (M7)** | ✅ | **Exit-Kriterien erfüllt (2026-07-20): 6 Orte aus Reise-Vlog extrahiert (≥ 4), nach Opt-in geocoded, Route mit nummerierten Pins + Polyline auf OSM-Map; Offline-Pfad mit manuellem Pinnen per Tap; Orte springen zur Video-Stelle; Trip als verlinkte Notiz** |

## Phase 8 — Ergebnis (2026-07-20, abgeschlossen)

**Gebaut:** Migration `0008_m7_travel` (`trips`, `trip_places` mit `geocode_status` + Index); `extract_places.v2` Template (v1 → v2: 4–8 Orte inkl. POIs/Stadtteile — v1 lieferte nur 3 Städte); `features/travel` (`extract-trip.ts`: Analyse → Trip + Places + Trip-Notiz (type `trip`); `geocoding.ts`: Nominatim-Client mit 1 req/s-Limiter, User-Agent, In-Process-Cache; `map-math.ts`: Slippy-Mercator lon/lat↔Pixel/Tile + `fitToPoints` (pure, 7 Tests); `map-view.tsx`: **OSM-Raster-Tiles + react-native-svg-Overlay** (Polyline + nummerierte Pins, Attribution) mit **explizitem User-Agent via `expo-file-system.downloadAsync` + persistentem Disk-Cache** (OSM-Policy: RN-`Image`-Default-UA wird blockiert); `trip-screen.tsx` (DESIGN 5.8: Map, Route-Liste mit Zeitstempel-Sprüngen, Offline-Badge, manuelles Pinnen per Tap mit Status `manual`); Opt-in-Toggle „Online-Geocoding" im Mehr-Tab (`settings.geocoding_opt_in`); CTA „Reise-Route extrahieren/öffnen" im Video-Detail (Wissen-Sektion). Whitelist-ADR: `tile.openstreetmap.org` als Opt-in (PRD §7.4, Karten-Pivot statt react-native-maps — kein API-Key, kein Rebuild, identisch nativ + Web). 98 Tests + tsc + eslint 0 Fehler.

**Verifikations-Matrix (Exit-Kriterien, Reise-Vlog „JAPAN TRAVEL DIARIES", 39:10):**

| Kriterium                     | Beleg                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ≥ 4 Orte extrahiert           | ✅ 6: Osaka (0:00), Osaka Castle (1:40), Umeda Sky Building (3:20), Tokyo (13:48), Tokyo Tower (15:00), Shibuya Crossing (16:40) — `extract_places.v2` |
| Nach Opt-in geocoded          | ✅ Alle 6 via Nominatim `ok` mit korrekten Koordinaten (DB-verifiziert)                                                                                |
| Route dargestellt             | ✅ OSM-Tiles (Japan) + Polyline Osaka → Tokyo + nummerierte Pins + Attribution; Tiles mit explizitem UA + Disk-Cache (403 „access blocked" behoben)    |
| Ohne Opt-in: manuelles Pinnen | ✅ Toggle OFF → Badge „Offline — Orte per Tap manuell setzen"; 📍 → Tap auf Karte → `lat/lon` mit Status `manual` persistiert                          |
| Ort springt zur Video-Stelle  | ✅ Zeitstempel-Chip 13:48 → Video-Detail mit `?t=828`                                                                                                  |
| Trip als verlinkte Notiz      | ✅ `notes` type `trip` („Reise: JAPAN TRAVEL DIARIES…")                                                                                                |

**Gelöste Fehler / Entscheidungen:**

1. **Karten-Pivot (ADR PRD §7.4):** OSM-Tiles + SVG statt react-native-maps — kein Google-Maps-Key nötig (gcloud-Auth war abgelaufen), kein nativer Rebuild, gleiche Tile-Math nativ + Web.
2. **OSM 403 „access blocked":** RN `Image` sendet einen generischen Agenten (wird blockiert); Fix = Tiles via `expo-file-system.downloadAsync` mit explizitem `User-Agent` + persistenter Disk-Cache (policy-konform). Fresco-Cache hatte die 403-Tiles zusätzlich zwischengespeichert (Cache-Clear nötig nach dem Fix).
3. **extract_places.v1 → v2** (Golden-Set-Prinzip): v1 lieferte nur Städte (3 < 4 Exit); v2 mit POIs/Stadtteilen → 6 Orte.

## Phase 9 — Ergebnis (2026-07-21, abgeschlossen)

**Gebaut:** Migration `0009_m8_embeddings` (`embeddings` mit UNIQUE(owner_type, owner_id, model), `chunks_fts`, `notes_fts` FTS5); `LlamaCppEngine.embed` mit separatem Embedding-Kontext (Chat-Modell bleibt resident; `pooling_type: 'mean'`, `embd_normalize: 2`); `core/search` (float32↔bytes, Cosine, **JS-kNN** — bewusst kein sqlite-vec: trivial bei ~10⁴ Items, kein nativer Build), RRF-Hybrid (Vektor + FTS5, beide Kanäle Gewicht 2), `ownerText` je Owner-Typ, `indexMissingEmbeddings` (inkrementell + FTS-Rebuild); Suche-Screen (DESIGN 5.9) mit Modell-Lifecycle (Download/Load), Index-Button, Filter-Chips, Ergebnis-Karten mit Hydration und Navigation via `?t=`. 104 Tests + tsc + eslint 0 Fehler.

**Verifikations-Matrix (Exit-Kriterien):**

| Kriterium                      | Beleg                                                                                                                                                                                                                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Golden-Queries ≥ 8/10 in Top-3 | ✅ **9/10** (Kaiju, Sauerteig, Japan-Reiseroute, El Niño, Raubtiere, sourdough feeding, day trips Tokyo, Naturgewalt, Giftpflanzen ✓; nur „erstes Video im Zoo" ✗ — das 19-s-Transkript enthält das Wort „zoo" nie, Korpus-Limit, kein Ranking-Fehler). Screenshots: `.verification/phase9/` |
| Suche < 300 ms                 | ✅ 155–238 ms bei 124 indexierten Items (79 Chunks, 18 Notizen, 12 Konzepte, 15 Analysen)                                                                                                                                                                                                    |

**Gelöste Fehler / Entscheidungen (alle geräte-verifiziert):**

1. **multilingual-e5-small unbrauchbar:** XLM-RoBERTa-Basis — das in llama.rn 0.12.6 gebundelte llama.cpp kennt die Architektur nicht (kein `xlm-roberta` in `llama-arch.cpp`); das Modell lief unter der generischen `bert`-Zuordnung und produzierte konstante Vektoren (Kaiju vs. Microwelt = 1.0000, pairwise-Median 0,909). Auch bge-m3 fällt damit weg (gleiche Basis). → **paraphrase-multilingual-MiniLM-L12-v2** (plain BERT, 384-dim, 50+ Sprachen, mykor Q4_K_M-Konvertierung — cstr-Konvertierungen nutzen Nicht-Standard-Metadaten und laden in llama.rn gar nicht).
2. **RRF-ID-Kollision:** Fusion war nur per `owner_id` gekeyed — Notiz 3 kollidierte mit Analyse 3/Chunk 3, FTS-Gewicht landete auf falschen Typen und scrambled das Ranking. Fix: typisierte Keys `type:id` durchgehend (inkl. Regression-Test).
3. **Fehlende Spezialtokens (Haupt-Root-Cause):** llama.rn tokenisiert Embedding-Prompts ohne CLS/SEP (`loadPrompt` nutzt `add_bos` nur bei Vocab-Flag), die Referenz (llama.cpp-Server) wrapped als `<s>…</s>` — kurze Queries landeten dadurch in einem verzerrten Raum nahe dem Kurz-Konzept-Cluster. Fix: `ModelSpec.embedSpecialTokens` = `<s>…</s>`, angewendet in `LlamaCppEngine.embed` (token-level verifiziert: `[0, 15152, 190502, 2]` identisch zur Referenz).
4. **Konzept-Ein-Wort-Vektoren:** nackte Anzeigenamen („Japan") matchten fast jede kurze Query. Fix: `ownerText(concept)` bettet den verlinkten Notiz-Text ein (`concepts.note_id`).
5. **Restrisiko llama.rn-Version:** selbst mit identischen Tokens weichen Geräte-Vektoren numerisch von der aktuellen Host-llama.cpp ab (cos 0,77 kurz / 0,90 lang — vermutlich token_type/Positions-Behandlung im älteren Snapshot). Der Geräte-Raum ist aber selbstkonsistent; mit FTS gleichgewichtet (Gewicht 2 statt 1) trägt der Keyword-Kanal semantisch schwache Queries.
6. **Verifikations-Falle Fast Refresh:** Code-Änderungen an Nicht-Komponenten-Modulen wurden mehrfach nicht übernommen — geräte-seitige Verifikation grundsätzlich nach force-stop + sauberem Neustart, nie gegen den Fast-Refresh-Zustand.

**Offen aus Phase 9:** Filter Kanal/Zeitraum/Sehquote im Suche-Screen (Scope-Rest, Chips für Typ vorhanden); Embedding-Format-Änderungen erfordern neue Modell-ID (Cache-Key der `embeddings`-Tabelle).

## Phase 10 — Ergebnis (2026-07-21, abgeschlossen)

**Gebaut:** Migration `0010_m9_hygiene` (`subscriptions.youtube_sub_id` — die API-Resource-ID ist das Delete-Ziel; Backfill beim nächsten Sync); Sehverhalten-Report `listChannelWatchStats` (SQL `subscriptions` × `watch_sessions` via `videos`: distinct Videos, Ø-Quote, zuletzt geschaut); Regel-Engine `features/hygiene/rules.ts` (pure, 7 Tests: 💤 6 Mo, 0 Views/90 T, Quote < 10 % ab 3 Videos); `YouTubeClient.delete` + `subscriptions.delete` = 50 Units in `UNIT_COSTS`; **inkrementeller Scope** `youtube.force-ssl` nativ (Re-Configure + Sign-In — Consent zeigt nur den neuen Scope) und Web (GIS-Token-Client mit Zusatz-Scope), `AuthContext.scopes` + `requestForceSslScope()`; Hygiene-Screen (DESIGN 5.10: Vorschläge mit Checkboxen, „Alle auswählen", „Am meisten geschaut", CTA mit Fortschritt, Bestätigungs-Dialog, Fehler-Report) + Route `/hygiene` + Einstieg im Mehr-Tab; `unsubscribeChannels` (Sub-ID lokal oder 1-Unit-Lookup, lokales Soft-Delete pro Erfolg, Quota-Block bricht sauber ab, Sync-TTL-Invalidierung). 111 Tests + tsc + eslint 0 Fehler.

**Verifikations-Matrix (Exit-Kriterien):**

| Kriterium                     | Beleg                                                                                                                                                                                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Report zeigt reale 💤-Kanäle  | ✅ Negativ-Fall korrekt (frischer Account → 0 Vorschläge); nach künstlicher Alterung zweier Kanäle: Kurzgesagt „💤 seit 6 Mo", Babish „0 Views/90 T", sportstudio korrekt ohne Vorschlag (Screenshot `.verification/phase10_hygiene_suggestions.png`) |
| Unsubscribe-Flow Ende-zu-Ende | ✅ Kurzgesagt (Test-Account developer@moinsen.dev): Checkbox → Dialog → `subscriptions.delete` (204) → `deleted_at` lokal → anschließender `subscriptions.list`-Sync bestätigt Server-seitig (kein Resurrect)                                         |
| Scope-Dialog                  | ✅ Google-Consent zeigt genau den neuen Scope („See, edit, and permanently delete your YouTube …") — Screenshot `.verification/phase10_google_consent.png`                                                                                            |
| Quota-Disziplin               | ✅ 50 Units deklariert + geloggt (`quota_log` 2026-07-21: 53 = 3 Sync + 50 Delete)                                                                                                                                                                    |

**Notizen:** (a) Verifikations-Historie im Testbestand wurde nach der Regel-Verifikation wiederhergestellt (Timestamps restauriert); der Kurzgesagt-Unsubscribe ist real und bleibt. (b) Der Consent wurde im ersten Anlauf erteilt (Sheet sichtbar), der Delete lief im zweiten Anlauf direkt durch — danach tragen auch Silent-Refresh-Tokens den Scope. (c) Emulator verlor während der Session wiederholt den App-Prozess (Speicherdruck durch geladenes 2-GB-LLM + GMS) — Verifikations-Flows zügig und mit frischem App-Start ausführen. (d) Could-Scope Takeout-Import: bewusst nicht begonnen (Roadmap markiert ihn als Entscheidung nach erster Nutzung).

## Phase 10.5 — Zwischenstand (2026-07-21, in Arbeit)

**Geschafft (verifiziert, 127 Tests grün, tsc/eslint 0 Fehler):**

- **Firebase-Projekte:** `youtube-buddy-moinsen` (Bestand = **prod**) + `youtube-buddy-moinsen-dev` (**dev, default**) angelegt/aktiviert; `.firebaserc` Aliase; Web-App im Dev-Projekt registriert (apiKey/appId in `app.config.ts`, öffentliche Client-Werte).
- **Repo-Struktur:** `firebase.json`, `firestore.rules` (Owner-only `users/{uid}/**`, Server = blind), `firestore.indexes.json`, Emulator-Config; `functions/` (Node 22 + TS, **europe-west3**): HTTPS-Endpoint `analyze` (Gemini via `@google/genai` Vertex-Modus, `responseSchema`-JSON-Mode, Firebase-ID-Token-Verifikation, `gemini-2.5-flash` als Default bis Golden-Set-Pinning) — tsc kompiliert sauber.
- **Env-Switch:** `app.config.ts` liest `EXPO_PUBLIC_ENV` (Default `development`), Firebase-Config in `extra.firebase` (prod folgt beim Rollout).
- **`core/sync` (komplett getestet):** E2E-Crypto (Master-Key 256-bit, tweetnacl secretbox; Recovery-Code 24 Zeichen → scrypt-Wrap — Server sieht nur Ciphertext); Firebase Auth via **REST Identity Toolkit** (Google ID-/Access-Token → Firebase-Identität, kein natives Firebase-SDK nötig); Firestore REST-Transport; LWW-Engine (push since/pull, FK-sichere Reihenfolge); Entitäts-Adapter channels/videos/concepts/notes/analyses/flashcards mit naturalisierten FKs (sync_id für notes/flashcards via **Migration 0011** inkl. Trigger-Defaults; flashcards.updated_at als LWW-Stempel).
- **`CloudEngine`** (LLMEngine-Interface, `EngineId 'cloud'`): POST an `analyze` mit `z.toJSONSchema`, zod-Client-Validierung, `embed()` bleibt bewusst on-device. 4 Tests.
- **`ProSession`**: Firebase-Identität (Restore/Refresh via SecureStore), Master-Key-Verwaltung (enableSync → Recovery-Code einmalig; joinSync → Unwrap). 5 Tests.
- **Deploys:** Firestore Rules + Indexes auf dev deployed; DB wurde versehentlich in nam5 auto-erstellt → gelöscht und in **europe-west3** neu angelegt (verifiziert), Rules/Indexes erneut deployed.
- **MCP-Setup:** `.mcp.json` mit `firebase` (CLI-Login, `--only auth,firestore,storage`) + `revenuecat` (gehostet, mcp-remote wie expo) — **wirkt erst nach kimi-code-Neustart**.

**Blocker / User-Aktionen (in dieser Reihenfolge):**

1. ~~**kimi-code neu starten**~~ ✅ (firebase-MCP aktiv; revenuecat-MCP lädt nicht — OAuth/Server-Start prüfen bei nächster Session).
2. ~~**Blaze-Upgrade**~~ ✅ → `analyze` in europe-west3 deployed.
3. **gcloud auth login** (Token abgelaufen) — für IAM/Billing-Checks + API-Aktivierungen per CLI.
4. ~~**Google-Provider in Firebase Auth (dev) aktivieren**~~ ✅ (`firebase deploy --only auth`).
5. ~~**Client-ID-Allowlist** (Cross-Projekt-Google-Identität)~~ ✅ — Web-Client-ID des YouTube-Projekts im Dev-Projekt allowlistet (Console-only, keine API).
6. ~~**Vertex AI API aktivieren**~~ ✅ — danach **erster echter Gemini-Call verifiziert**: Cloud-Analyse des El-Niño-Videos via Emulator → `analyses` mit `summary`/`chapters`/`triage` je `gemini-2.5-flash (cloud)` + deutscher Zusammenfassung (Screenshot `.verification/phase105_cloud_analysis.png`); Function-Logs zeigen die Calls.

**Verifikations-Matrix Phase 10.5 (Exit-Kriterien, ROADMAP):**

| Kriterium                                                                     | Beleg                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zwei Geräte synchronisieren Analysen/Karten/Notizen, Firestore nur Ciphertext | ✅ Gerät 1 (Emulator): 64 Entities gepusht, MCP-Nachweis nur `ciphertext`. „Gerät 2" (App-Wipe = Neuinstallation): gleiche uid, Join per Recovery-Code (Master-Key unwrap), **„0 hochgeladen · 64 übernommen"** — counts exakt = Push-Menge (4/7/12/18/15/8; spätere lokale Zuwächse auf Gerät 1 wären nächster Push, kein Verlust). FK-Auflösung ok (Flashcards ↔ Notizen via sync_id). Screenshot `.verification/phase105_device2_sync.png` |
| Cloud-Analyse besser als On-Device (manueller Vergleich dokumentiert)         | ✅ El Niño: On-Device (llama-3.2-3b) lieferte nur Triage-Score 2 mit Einzeiler; Gemini liefert vollständige deutsche Zusammenfassung mit Kernaussagen + saubere Kapitel (`.verification/phase105_cloud_analysis.png`)                                                                                                                                                                                                                         |
| Kauf-Flow (Sandbox) aktiviert Pro                                             | ✅ Android: Test-Store-Dialog → gültiger Kauf → „Pro aktiv (TEST_STORE)" (`.verification/phase105_pro_active.png`). **iOS ausstehend** (Dev-Client-Rebuild + Sim-Consent-Problem aus Phase 5)                                                                                                                                                                                                                                                 |
| Free-Nutzer ohne Pro: keinerlei Server-Traffic                                | ✅ By Design + Fix: Purchases konfiguriert NICHT mehr beim App-Start (sonst Traffic für alle); Firebase-Calls erst nach explizitem Connect; RC erst beim Öffnen der Pro-Sektion                                                                                                                                                                                                                                                               |
| Kein Crashlytics/Analytics                                                    | ✅ weder SDK in der App noch MCP-Scope (`--only auth,firestore,storage`)                                                                                                                                                                                                                                                                                                                                                                      |

**Restpunkte (ehrlich offen):** iOS-Kauf-Verifikation (Rebuild), Golden-Set-Benchmark für das Gemini-Pinning (Function akzeptiert `model`-Param, `gemini-2.5-flash` vorerst gesetzt), Server-seitige Entitlement-Prüfung (RC-Webhook → Custom Claims, ADR-Detail), prod-Setup (Web-App registrieren, prod-Rules, App Check).

**Verifiziert auf dem Emulator (2026-07-21):**

- **Firebase-Connect:** Cross-Projekt-Google-Identität (YouTube-Projekt-Token → Firebase-Dev-Projekt) funktioniert nach Allowlist — `Firebase verbunden (ww3QeMHF…)`, uid `ww3QeMHFidVDOO5KckMHt3MEztT2`.
- **E2E-Sync Push Ende-zu-Ende:** Sync aktiviert → Recovery-Code einmalig angezeigt (Wrapped Master Key liegt als `entities_meta/master_key` in Firestore); „Jetzt synchronisieren" → **64 Entities hochgeladen**, Pull überspringt korrekt lokal-neuere (LWW). **Firestore-Nachweis via MCP: alle 7 `entities_*`-Collections enthalten ausschließlich `ciphertext` + `updated_at`** — Server ist blind, wie im ADR gefordert. Dokument-IDs = `sync_id` (keine lokalen Autoincrement-Kollisionen).
- **Cloud-Analyse:** **Ende-zu-Ende verifiziert** — Emulator → CloudEngine → Function (europe-west3) → Vertex (`gemini-2.5-flash`) → persistiert mit Audit-Label `gemini-2.5-flash (cloud)`; Button/Labels kennzeichnen Cloud vs. lokal, AnalysisSheet sagt bei Cloud ehrlich „Transkript wird an die EU-Cloud gesendet" (statt On-Device-Badge).
- **Gefundene Bugs:** `no PRNG` (tweetnacl ohne Hermes-RNG) → Zufall via expo-crypto; `engineReady` prüfte nur das lokale Modell → cloud-aware; `@google/genai` braucht explizites `project`/`location` (GCLOUD_PROJECT).

**Bewusste v1-Grenzen (im Code dokumentiert):** keine Delete-Tombstones (Löschen bleibt lokal), `concepts.note_id` wird nicht synchronisiert, Transkripte/Embeddings/Modelle bleiben lokal (ADR), Web = read-only für Pro.

## Phase 11 — Zwischenstand (2026-07-21, Kern gelegt)

**Gebaut & verifiziert (headless Chrome 150 via CDP):**

- **expo-sqlite auf Web:** `metro.config.js` (wasm-Asset + COOP/COEP-Header); `core/db/index.web.ts` mit **async open** (Sync-API = „Sync operation timeout"), **memoisiertem Open-Promise** (OPFS erlaubt genau 1 Access Handle pro Datei — parallele getDb()-Aufrufe crashten mit `unable to open database file`) und Close-bei-Fehler (Handle-Leaks blockierten alle späteren Opens). Alle 11 Migrationen laufen, idempotent. **FTS5 fehlt im wa-sqlite-WASM** (`no such module: fts5`) → Migrations-Runner überspringt FTS-Statements per Compile-Option-Check, `core/search` degradiert auf Web zu Vector-only (`hasFtsTables`).
- **Datei-Brücke (M10):** `core/export/backup.ts` (JSON-Backup aller 20 portablen Tabellen, Spalten gegen PRAGMA gehärtet, Werte als Parameter; ohne Transaktion — **drizzle-Transaktionen hängen auf Web**, Sync-Only-Treiber); Share nativ via expo-sharing, Web via Blob-Download + File-Input; „Daten (lokal)"-Sektion im Mehr-Tab (Export JSON/Vault nativ + Web, Import vorerst Web-only).
- **E2E-Brücke verifiziert:** Backup vom Emulator (64 Entities + settings) → Import auf Web: **„Importiert: 65 Zeilen in 7 Tabellen"**, danach „5 Karten fällig" im Wissen-Tab. Wichtigster Fix dabei: Import-Schreiben über **rohen SqliteExecutor** (`getRawDb()`) — drizzles Sync-Treiber hängt auf Web in Sequenzen.
- **Read-only-Modus (WebGPU-Gate):** `core/platform/webgpu.ts` (`hasWebGPU()` + Hint-Text); ModelSection zeigt ohne WebGPU den Fallback-Hinweis statt Modellverwaltung, Analyse-CTA ebenso. In Chrome (headless, `navigator.gpu: true`) erscheint korrekt die normale Modellverwaltung.

**Befunde (für später):** drizzle/expo-sqlite ist durchgehend sync-basiert (`executeSync`) — auf Web geht das über den SAB-Pfad und hängt in Sequenzen/Transaktionen; rohe async Calls sind stabil. Web-Screens, die viele drizzle-Schreibzugriffe machen (Sync-Push, Settings), brauchen denselben Raw-Pfad, falls sie auf Web laufen sollen.

**Offen (Phase-11-Rest, ehrlich):** WebLLMEngine (mlc) + transformers.js-Embeddings für volle lokale KI im Browser (dazwischen funktioniert **Cloud-Analyse auf Web schon heute** — `resolveAnalysisEngine` ist reines REST); Graph mit echten `note_links` verifizieren (Backup-Datensatz hatte 0 Links — Graph-View selbst rendert auf Web); Sidebar-Layout-Polish, Tastaturkürzel `/`, Drag-Scroll-Rails, SpeechSynthesis-TTS im Guide-Modus; Safari-Verifikation des Read-only-Hinweises; Vault-ZIP-Import (nur Export); Web-Persistenz der Modelldownloads (Cache-API) gehört zur WebLLM-Story.

## Offene Punkte (aus PRD §9 / ARCHITECTURE §11)

1. Takeout-Import des historischen Verlaufs — Entscheidung nach erster Nutzung (eingeplant als Could in Phase 10).
2. Whisper-Fallback für Transkripte — Entscheidung nach Phase 3: **nicht nötig** (Fehlerquote 0/10), bleibt Could-Option.
3. ~~Finales Chat-Modell~~ — **entschieden in Phase 4** (Qwen3-4B ≥ 6 GB, Llama-3.2-3B 4-GB-Tier).
4. Konzept-Dedup-Qualität — **erste Evidenz gut** (6 saubere Konzepte); Golden-Set-Gate bei Dedup-Pfad ausstehend; ggf. Embedding-Clustering in Phase 9.
5. Datentransfer Phone → TV — **per ADR gelöst ab Phase 10.5** (E2E-Sync via Firebase).
6. **Android-Perf + P50-Analysezeit auf physischem Gerät** — Emulator-Artefakte.
7. **iOS-Verifikation Phase 5–8** — expo-speech-Rebuild + Consent-Tap ausstehend.
8. **WL-Playlist bei Viewer-Accounts** — ADR-Entscheidung (s. Phase 5).
9. **Triage-Prompt-Kalibrierung** (Scores zu streng) — Golden-Set-Gate später.
10. **Graph-Benchmark 1.000 Nodes** — mit wachsendem Bestand nachholen.

## Nächste Schritte (Phase 11 — Rest & Phase 12)

1. **WebLLMEngine + Web-Embeddings** (mlc/transformers.js) für volle lokale KI im Browser; dazwischen Cloud-Analyse auf Web nutzen (REST-Pfad existiert). Achtung bei Web-Schreibpfaden: drizzle-Sync hängt → Raw-Executor-Muster (`getRawDb`) verwenden.
2. Graph mit link-haltigem Bestand verifizieren; Sidebar/Tastaturkürzel/Scroll-Rails Polish; SpeechSynthesis-TTS.
3. **User-Verifikation gewünscht:** Import im eigenen (eingeloggten) Chrome einmal durchklicken — der Headless-Flow ist verifiziert, der reale Google-Sign-in-Pfad auf Web war es schon (Phase 1).
4. Phase 12 (Apple TV) erst nach Web-Parität bzw. nach User-Prio; iOS-Kauf-Verifikation (10.5) weiter offen.
