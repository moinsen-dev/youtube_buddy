# Architektur — YouTube Buddy

**Status:** v1.1 (Planungsphase; v1.1: M11 Wissensbasis, Guide-Modus, TTS)
**Geltungsbereich:** technische Umsetzung der Module M1–M11 aus `docs/PRD.md`. Design-Vorgaben in `docs/DESIGN.md`, Umsetzungsreihenfolge in `docs/ROADMAP.md`.

---

## 1. Tech-Stack (Festlegungen)

| Bereich | Entscheidung | Begründung |
|---|---|---|
| Framework | **Expo (SDK 52+), React Native, TypeScript strict** | Eine Codebasis für iOS/Android/Web; tvOS später via react-native-tvos (Expo-Config-Plugin) |
| Navigation | **Expo Router** (file-based) | Plattformübergreifend, Deep-Links (`/video/[id]`, `/trips/[id]`, `/notes/[id]`) auch auf Web |
| Lokale DB | **expo-sqlite** (+ Drizzle ORM, Typsicherheit ohne schwere Abstraktion) | Local-only-Pflicht; Drizzle gibt migrierbare Schemas und typsichere Queries |
| State | **Zustand** (UI-State) + Repository-Layer über SQLite (Daten-State) | Kein Server-State → kein React Query nötig; Zustand ist minimal, funktioniert überall inkl. Web/TV |
| YouTube-Wiedergabe | **IFrame-Player in `react-native-webview`** (Web: nativ) | Einzige offiziell erlaubte Wiedergabeform; Player-API liefert Zeit-/State-Events fürs Tracking |
| Google-Login | Nativ: `@react-native-google-signin/google-signin`; Web: Google Identity Services | YouTube-Scopes brauchen „echten" Google-Consent; expo-auth-session nur Fallback |
| KI nativ | **llama.rn** (llama.cpp-Bindings), später **whisper.rn** | Bewährtes GGUF-On-Device-Inferenz; whisper als Transkript-Fallback (M3-Could) |
| KI Web | **WebLLM** (+ `@xenova/transformers.js` für Embeddings) | WebGPU-Inferenz im Browser; gleiche Modellfamilien |
| Karten | Nativ: `react-native-maps` (Apple Maps iOS / Google Android); Web: **Leaflet + OSM-Tiles** | Kein Google-Maps-API-Key-Zwang auf iOS; Leaflet ist Web-Standard ohne Key |
| Markdown | Nativ: **react-native-markdown-display**; Web: **marked** — ein gemeinsamer Wiki-Link-Parser in `core/` | Rendering pro Plattform, Link-Auflösung plattformneutral |
| Graph | **d3-force** (Layout, vorabberechnet + gecacht) + `react-native-svg` (nativ) / SVG-DOM (Web) | Ein Layout-Algorithmus für beide Plattformen; keine native Graph-Bibliothek nötig |
| TTS | **expo-speech** (nativ, On-Device), Web SpeechSynthesis | Guide-Modus-Vorlesen ohne Netzwerk |
| Validierung | **zod** (API-Responses, KI-JSON-Outputs, Export-Dateien) | Eine Schema-Quelle für alles |
| Tests | Jest + React Native Testing Library (Unit), Maestro (E2E nativ), Playwright (Web, später) | — |
| Lint/Format | ESLint (expo-config) + Prettier + TypeScript strict, pre-commit via husky | — |

**Bewusste Nicht-Entscheidungen:** kein Redux, kein eigenes Backend, kein GraphQL, kein Firebase/Supabase (wäre Local-only-Verletzung), kein NativeWind (Design-Tokens als TS-Theme-Objekt, plattformneutral).

---

## 2. Modulstruktur (Ordnerlayout)

```
youtube_buddy/
├── app/                        # Expo Router — nur Routing + Screen-Composition
│   ├── (tabs)/                 # Home, Bibliothek, Suche, Wissen, Mehr
│   ├── video/[id].tsx
│   ├── trips/[id].tsx
│   ├── notes/[id].tsx          # Notiz-/Konzept-Detail (M11)
│   ├── guide/[id].tsx          # Guide-Übersicht + Guide-Modus (M6)
│   └── _layout.tsx             # Shell: Tabs (Phone) / Sidebar (Web/Tablet/TV)
├── features/
│   ├── auth/                   # M1: OAuth-Flows nativ+web, Token-Store (expo-secure-store)
│   ├── library/                # M1: Subscriptions, Playlists, Watch Later, Likes, Cache
│   ├── player/                 # M2: IFrame-Player-Wrapper, Watch-Session-Tracker
│   ├── transcripts/            # M3: Untertitel-Extraktion, Chunking, Cache
│   ├── analysis/               # M5: TL;DR, Kapitel, Key Points, Triage
│   ├── flashcards/             # M6: Generierung, SM-2-SRS, Review-Queue
│   ├── guides/                 # M6: How-Tos, Guide-Modus (Schrittkarten + Fortschritt), TTS, Habit-Ableitung
│   ├── travel/                 # M7: Orts-Extraktion, Geocoding (Opt-in), Map
│   ├── search/                 # M8: Embedding-Index, Vektorsuche, Query-UI
│   ├── hygiene/                # M9: Sehverhalten-Report, Unsubscribe-Flow
│   ├── knowledge/              # M11: Notizen, Wiki-Link-Parser/Resolver, Konzepte, Backlinks, Graph
│   ├── home/                   # Home-Tab: Rails (Weiterschauen, Watch Later), VideoCard
│   └── shell/                  # App-Shell: SideNav (Rail/Sidebar), Nav-Items, Platzhalter-Screens
├── core/
│   ├── ai-engine/              # M4: LLMEngine-Interface + Backends + Modell-Registry
│   ├── youtube/                # API-Client, Quota-Budget, DTOs (zod)
│   ├── db/                     # Drizzle-Schema, Migrationen, Repositories
│   ├── i18n/                   # String-Scaffold (de/en von Tag 1, DESIGN §7)
│   ├── theme/                  # Design-Tokens aus DESIGN.md §2 als TS-Objekt
│   ├── export/                 # JSON-Export/Import (Backup) + Obsidian-Vault-Export (M11)
│   ├── markdown/               # Wiki-Link-Parser, Link-Resolver-Index, Markdown→AST (plattformneutral)
│   └── platform/               # Plattform-Helfer (isTV, isWeb, Breakpoints)
└── assets/models/              # (runtime) heruntergeladene GGUF-Modelle — nicht im Repo
```

**Regel:** `app/` importiert aus `features/`, `features/` importieren aus `core/` — nie umgekehrt. Features untereinander nur über `core/db`-Repositories oder Events, nicht direkt.

---

## 3. KI-Engine-Abstraktion (M4)

### 3.1 Interface

```ts
// core/ai-engine/types.ts
export interface LLMEngine {
  readonly id: 'llamacpp' | 'webllm';
  readonly capabilities: { chat: boolean; embed: boolean; transcribe: boolean };

  loadModel(spec: ModelSpec, onProgress?: (pct: number) => void): Promise<void>;
  unloadModel(): Promise<void>;

  generate<T>(req: GenerateRequest<T>): Promise<T>;   // T via zod-Schema validiert
  embed(texts: string[]): Promise<Float32Array[]>;
  transcribe?(audioPath: string): Promise<TranscriptResult>; // später (whisper)
}

export interface GenerateRequest<T> {
  template: PromptTemplate;       // aus Registry, versioniert
  input: unknown;                 // template-spezifischer Input
  schema: z.ZodType<T>;           // erzwungenes JSON-Output-Schema
  onToken?: (t: string) => void;  // Streaming ins UI
  signal?: AbortSignal;           // Abbruch durch Nutzer
}
```

Backends: `LlamaCppEngine` (iOS/Android/TV-theoretisch), `WebLLMEngine` (Web, WebGPU-Check beim Start; ohne WebGPU → Read-only-Modus mit Hinweis-UX). Auswahl zur Laufzeit via `core/platform`, Features kennen nur das Interface.

### 3.2 Modell-Registry

| Zweck | Kandidaten (v1) | Größe (Q4) | Mindest-RAM |
|---|---|---|---|
| Chat/Analyse | **Qwen3-4B-Instruct** (Default), Alternativen: Gemma-3-4B-it, Llama-3.2-3B | 2,3–2,5 GB | 6 GB (4 GB → 1–2B-Modell) |
| Embedding (M8) | **multilingual-e5-small** (384-dim) | ~120 MB | — |
| Transkription (Could) | whisper tiny/base GGML | 75–150 MB | — |

Registry = JSON-Manifest (Name, HF-URL, SHA-256, Größe, Kontextlänge, Mindest-RAM, empfohlen-ab-Gerät). Download via `expo-file-system` mit Resume, Verifizierung per Hash, Verwaltung im Einstellungen-Screen (DESIGN 5.11).

### 3.3 Prompt-Templates & strukturierte Outputs

- Templates versioniert in `core/ai-engine/prompts/` (z. B. `summarize.v3.ts`, `extract_concepts.v1.ts`), jeweils mit zod-Schema des Outputs.
- Generierung im JSON-Modus/grammar-constrained (llama.cpp GBNF) → Parse-Fehlerquote < 1 %; Fallback: 1 Retry mit Repair-Prompt.
- Sprache: System-Prompt steuert Output-Sprache = UI-Sprache; Zeitstempel-Referenzen sind Pflichtfelder im Schema (`sourceRefs: { startSec: number }[]`).
- Kontextbudget: Transkript-Chunks (M3) werden bei > 28k Tokens kapitelweise map-reduced (Chunk-Summaries → Gesamt-Summary).
- Konzept-Extraktion (M11) läuft als Batch-Job über alle neuen Analysen (dedupliziert gegen `concepts`, Normalform Singular/Kleinschreibung intern, Anzeige-Form separat).

### 3.4 Cloud-Analyse & Sync (Pro-Tier, ab Phase 10.5 — ADR PRD §7.6)

**`CloudEngine` (drittes Backend):** Implementiert dasselbe `LLMEngine`-Interface (`id: 'cloud'`) gegen die Groq-API (Llama-70B-Klasse). Prompt-Templates, zod-Schemata und Golden-Set-Gate sind identisch zum On-Device-Pfad; Ergebnisse tragen in `analyses.model` die Cloud-Kennung (z. B. `groq-llama-70b`). Aktivierung pro Nutzeraktion (Opt-in), UI-Badge „Cloud (Opt-in)" als Invers des On-Device-Badges. Fallback: bei Fehler/Offline → On-Device-Engine.

**Sync-Engine (`core/sync`, Phase 10.5):** Firebase im bestehenden GCP-Projekt als Transport. Ablauf: lokale SQLite-Entitäten → Client-seitige Verschlüsselung (Key aus Passphrase/Device-Key + Recovery-Code) → Firestore-Dokumente pro Tabelle/Entität mit `updated_at`-Last-Write-Wins (Security Rules: nur Owner liest/schreibt, Payload nur Ciphertext) → Pull-Delta beim Start via Snapshot-Listener. Nicht synchronisiert werden: Modelldateien, Transkript-Roh-Chunks (bei Bedarf neu abrufbar), Quota-/Cache-Tabellen. Auth via **Firebase Auth Google-Provider** — dieselbe Google-OAuth-Identität wie der YouTube-Login (idToken-Austausch, keine Zweit-Auth). Groq-Zugriff nur über eine **Cloud Function (EU)** — der API-Key liegt ausschließlich serverseitig. Entitlements via RevenueCat, lokal gecacht (Offline-Weiternutzung von Pro-Features bis Ablauf). **Kein Crashlytics/Analytics** (Local-only-Regel gilt auch im Pro-Tier).

**Grenzen:** Kein Analytics/Crash-SDK auch im Pro-Tier; Server sieht ausschließlich Ciphertext (E2E) bzw. bei Cloud-Analyse nur die aktuell angefragten Prompts (klar gekennzeichnet).

---

## 4. Datenmodell (SQLite via Drizzle)

```sql
-- M1
channels(id TEXT PK, title TEXT, thumbnail_url TEXT, subscriber_count INT, updated_at INT)
subscriptions(channel_id TEXT PK FK, subscribed_at INT, deleted_at INT NULL)
playlists(id TEXT PK, title TEXT, item_count INT, updated_at INT)
playlist_items(playlist_id TEXT FK, video_id TEXT FK, position INT, PRIMARY KEY(playlist_id, video_id))
videos(id TEXT PK, channel_id TEXT FK, title TEXT, duration_sec INT, published_at INT,
       thumbnail_url TEXT, description TEXT, updated_at INT)

-- M2
watch_sessions(id INTEGER PK, video_id TEXT FK, started_at INT, ended_at INT,
               position_sec INT, percent_watched REAL, source TEXT) -- 'player'|'manual'|'takeout'

-- M3
transcripts(video_id TEXT PK FK, lang TEXT, source TEXT, fetched_at INT) -- source: 'captions'|'whisper'
transcript_chunks(id INTEGER PK, video_id TEXT FK, idx INT, start_sec REAL, end_sec REAL,
                  text TEXT, embedding_id INT NULL)

-- M5
analyses(id INTEGER PK, video_id TEXT FK, kind TEXT,           -- 'summary'|'chapters'|'triage'
         model TEXT, prompt_version TEXT, payload TEXT,        -- JSON (zod-validiert)
         created_at INT, UNIQUE(video_id, kind))

-- M11 Wissensbasis
notes(id INTEGER PK, video_id TEXT FK NULL, concept_id INT FK NULL,
      type TEXT,                        -- 'summary'|'guide'|'flashcard_set'|'habit'|'trip'|'concept'|'free'
      title TEXT, body_md TEXT,         -- Markdown mit [[Wiki-Links]]
      created_at INT, updated_at INT)
concepts(id INTEGER PK, name TEXT UNIQUE, display_name TEXT, note_id INT FK, created_at INT)
note_links(id INTEGER PK, src_note_id INT FK, dst_note_id INT FK NULL,
           dst_concept_name TEXT,       -- Link-Ziel wie geschrieben (für ungelöste Links)
           resolved INT)                -- 1 = dst_note_id gesetzt, 0 = ungelöst (Obsidian-Style)

-- M6
flashcards(id INTEGER PK, video_id TEXT FK, note_id INT FK NULL,
           front TEXT, back TEXT, source_sec INT,
           ease REAL, interval_days INT, due_at INT, reps INT, created_at INT)
flashcard_reviews(id INTEGER PK, card_id INT FK, reviewed_at INT, grade INT) -- SM-2 grade 0–5
habits(id INTEGER PK, video_id TEXT FK, note_id INT FK NULL,
       title TEXT, cue TEXT, active INT, created_at INT)
habit_checks(habit_id INT FK, day TEXT, done INT, PRIMARY KEY(habit_id, day))
guides(id INTEGER PK, video_id TEXT FK, note_id INT FK NULL,
       title TEXT, payload TEXT,              -- Schritte+Material als JSON (zod)
       progress_step INT DEFAULT 0,           -- Guide-Modus: zuletzt aktiver Schritt
       created_at INT, updated_at INT)

-- M7
trips(id INTEGER PK, title TEXT, note_id INT FK NULL, created_at INT)
trip_places(id INTEGER PK, trip_id INT FK, video_id TEXT FK, name TEXT,
            lat REAL NULL, lon REAL NULL, source_sec INT, position INT,
            geocode_status TEXT) -- 'pending'|'ok'|'manual'|'failed'

-- M8
embeddings(id INTEGER PK, owner_type TEXT, owner_id INT, vector BLOB, model TEXT)
  -- owner: transcript_chunk | note | concept | analysis; Vektorsuche via sqlite-vec (nativ) bzw.
  -- hnswlib-JS-Index (Web), gekapselt in core/db/vector.ts

-- M9/Querschnitt
quota_log(day TEXT PK, units_used INT)
settings(key TEXT PK, value TEXT) -- u. a. geocoding_opt_in, ui_locale, model_selection
```

Indizes: `watch_sessions(video_id, started_at)`, `transcript_chunks(video_id, idx)`, `flashcards(due_at)`, `analyses(video_id, kind)`, `note_links(src_note_id)`, `note_links(dst_note_id)` (Backlinks = Reverse-Lookup), `notes(type, updated_at)`. Volltext-Fallback: FTS5 über `transcript_chunks.text` **und** `notes.body_md` (komplementär zur Vektorsuche).

**Graph (M11):** keine eigene Tabelle — Nodes/Kanten sind eine Query über `notes` + `concepts` + `note_links` (+ `videos` als virtuelle Nodes über `notes.video_id`). Layout via d3-force zur Laufzeit, Ergebnis-Positionen pro Graph-Revision in-memory gecacht.

---

## 5. Kern-Flows (Implementierungssicht)

### 5.1 Watch-Tracking (M2)
IFrame-Player feuert `onStateChange`/Timeupdate (via postMessage aus der WebView) → `PlayerTracker` (features/player) schreibt alle 5 s bzw. bei Pause/Ende in `watch_sessions`. `percent_watched` = max. erreichte Position / Dauer. Ab 30 % wird „Analysieren"-CTA aktiviert; ab 80 % gilt Video als „geschaut" (für M9).

### 5.2 Transkript & Analyse (M3 → M5)
1. `features/transcripts` ruft Untertitel ab (Video-Page → Caption-Track-URL, s. PRD §7.1 Grauzone), cached in `transcripts` + `transcript_chunks` (Chunk-Größe ~800 Zeichen, Zeitstempel erhalten).
2. `features/analysis` baut Prompt aus Template + Chunks → `LLMEngine.generate` → zod-Validierung → `analyses.payload`.
3. UI liest Analyse + rendert Zeitstempel als Player-Sprünge (DESIGN §4 ChapterList/SummaryPanel).

### 5.3 Wissensmodule & Guide-Modus (M6)
Flashcards/Guides/Habits = eigener `generate`-Call mit eigenem Template auf Basis von `analyses.summary` (+ Chunks für Quellen) → jeweilige Tabellen **plus zugehörige `notes`-Einträge (M11, s. 5.4)**. SRS: SM-2-Implementierung in `features/flashcards/srs.ts` (pure Functions, unit-getestet), Review-Queue = `due_at <= now`.

**Guide-Modus:** `guides.payload` hält geordnete Schritte `{ nr, text, materialRefs[], sourceSec }`; `progress_step` persistiert den Stand; UI-State (aktiver Schritt, TTS an/aus, Auto-Advance) in Zustand. TTS via `expo-speech` (Stimme/Sprache = UI-Sprache, Rate ~1.0), Web: `speechSynthesis`. „Im Video ansehen" navigiert zu `/video/[id]?t=<sec>` mit Return-Link zurück zum Schritt.

### 5.4 Wissensbasis (M11)
1. **Notiz-Erzeugung:** Jedes Feature (analysis, flashcards, guides, travel) schreibt nach erfolgreicher Generierung zusätzlich eine `notes`-Zeile (Typ, Titel, `body_md` mit Quellen-Frontmatter-Kommentar) und verknüpft via `note_id`-Rückverweis.
2. **Wiki-Link-Pipeline (`core/markdown`):** Parser extrahiert `[[Ziel]]` aus `body_md` → Resolver matcht case-insensitiv gegen `notes.title` und `concepts.name` → schreibt `note_links` (`resolved=1` mit `dst_note_id`, sonst `resolved=0`). Läuft bei jedem Insert/Update der Notiz (Transaktion). Umbenennen einer Notiz/eines Konzepts → Re-Resolve betroffener Links.
3. **Konzept-Extraktion:** Batch-Job nach Analyse: Template `extract_concepts` (Input: Summary + Key Points + vorhandene `concepts`-Liste zur Dedup) → neue `concepts` + `concept`-Notiz; Quellen werden als `note_links` von/zur Konzept-Notiz eingetragen.
4. **Backlinks:** Query `note_links WHERE dst_note_id = ?` → BacklinkPanel (DESIGN 5.14).
5. **Graph:** Query Nodes/Kanten (s. §4) → d3-force-Layout → SVG. Tap → `/notes/[id]`. TV: gleiche Daten, reduzierte Interaktion (Fokus-Navigation über Node-Liste).

### 5.5 Reise (M7)
Orts-Extraktion = Template `extract_places` → `trip_places` mit `geocode_status='pending'`. Nur bei `settings.geocoding_opt_in=true`: Nominatim-Lookup (1 req/s, User-Agent-Header), Ergebnis in `lat/lon` + dauerhaftem Cache. Map rendert Polyline in Reihenfolge `position`. Trip erhält eigene `notes`-Zeile (Typ 'trip').

### 5.6 Suche (M8)
Bei jedem neuen Chunk/Notiz/Konzept/Analyse: `embed()` → `embeddings`-Tabelle (Batch, idle-time). Query: `embed(query)` → kNN (k=20) → Hydration aus Quelltabellen → `SearchResultRow` mit Typ-Icon, Snippet + Zeitstempel. FTS5 als Fallback/Hybrid.

### 5.7 Hygiene (M9)
Report = SQL-Join `subscriptions` × `watch_sessions` (Views 90 Tage, Ø-Quote). Vorschläge nach Regel-Engine (konfigurierbare Schwellen). Unsubscribe: prüft Scope `youtube.force-ssl`, fordert ihn erst dann inkrementell an → `subscriptions.delete` pro Kanal (je 50 Units → Quota-Check vorher) → `deleted_at` setzen.

---

## 6. YouTube-API-Client & Quota (core/youtube)

- Fetch-Wrapper mit: OAuth-Token-Injection + Refresh, DTO-Validierung (zod), Retry mit Backoff (429/5xx), ETag/Cache-Header-Auswertung.
- **Quota-Budget:** jeder Call deklariert seine Unit-Kosten; `quota_log` zählt tagesgenau; bei > 80 % Tagesbudget UI-Warnung (QuotaMeter, DESIGN §4), bei 100 % nur noch Cache.
- **Cache-first:** `videos`/`channels`/`playlists` haben `updated_at`; Refresh nur nach TTL (Videos 24 h, Subscriptions 6 h) oder manuell. Batching: `videos.list` bis 50 IDs/Call.
- Kein `search.list` (100 Units) — Suche läuft lokal (M8), YouTube-Suche bewusst kein Feature.

---

## 7. Auth & Token-Sicherheit (M1)

- Nativ: `@react-native-google-signin/google-signin` (iOS: reversed-client-id URL-Scheme; Android: SHA-1 + OAuth-Client). Web: GIS Token-Client. Tokens in `expo-secure-store` (nativ) bzw. Memory+SessionStorage (Web).
- Scopes inkrementell: Start `openid profile email youtube.readonly`; `youtube.force-ssl` erst beim ersten Unsubscribe (M9) — bessere Consent-Conversion, weniger Risiko bei Google-Verifizierung.
- Google Cloud Projekt: OAuth-Consent im Test-Modus (≤100 Tester) für v1; Verifizierung erst bei öffentlichem Release nötig (siehe PRD §7.1).

---

## 8. Plattform-Matrix

| Feature | iOS/Android Phone | Tablet | Web | Apple TV |
|---|---|---|---|---|
| M1 Auth & YouTube-Listen | ✅ | ✅ | ✅ | ⚠️ Login via QR/2nd-Screen, Listen read-only |
| M2 Player & Tracking | ✅ | ✅ | ✅ | ❌ (kein IFrame-WebView auf tvOS → kein Tracking) |
| M3 Transkripte | ✅ | ✅ | ✅ | ✅ (als Daten, netzseitig identisch) |
| M4 KI-Engine | ✅ (llama.rn) | ✅ | ⚠️ WebLLM nur mit WebGPU, sonst Read-only | ❌ (RAM/Runtime) |
| M5 Analyse | ✅ | ✅ | ⚠️ wie M4 | ❌ (nur Anzeige vorhandener Analysen) |
| M6 Flashcards/SRS/Guides | ✅ (Guide-Modus + TTS) | ✅ | ✅ (TTS via SpeechSynthesis ⚠️ Browser-abhängig) | ✅ (Review als TV-View, Daten via Export/Import) |
| M7 Reise-Map | ✅ | ✅ | ✅ (Leaflet) | ✅ (statische Kartenansicht) |
| M8 Semantische Suche | ✅ | ✅ | ⚠️ (Embedding via transformers.js WASM/WebGPU) | ❌ |
| M9 Hygiene | ✅ | ✅ | ✅ | ❌ |
| M11 Wissensbasis | ✅ | ✅ | ✅ | ⚠️ (Notizen/Graph nur Ansicht) |
| M10 Export/Backup | ✅ (JSON + Vault-ZIP) | ✅ | ✅ (Datei-Download) | ❌ |

**Konsequenz TV:** tvOS-App = „Konsum-View" (Flashcards-Review, Reise-Maps, Summaries, Notizen/Graph-Ansicht, Weiterschauen-Übersicht) auf Basis exportierter/importierter Daten (JSON via iCloud-Datei oder lokalem Netzwerk-Transfer — Entscheidung in Phase 12).

---

## 9. Privacy, Export & Löschung

- **Netzwerk-Budget (vollständige Liste):** Google OAuth, YouTube Data API, IFrame-Player/Thumbnails, Untertitel-Endpunkte, Hugging Face (Modell-Download), Nominatim (nur Opt-in). Graph, Notizen, TTS und Wiki-Links sind **vollständig lokal**. Nichts davon sendet App-eigene Telemetrie; es gibt keinerlei Analytics-SDK.
- **Export JSON:** `core/export` serialisiert alle Tabellen → eine JSON-Datei (zod-schema-versioniert, `formatVersion: 1`) via `expo-sharing` / Browser-Download. Import validiert strikt, migriert über `formatVersion`.
- **Export Obsidian-Vault (M11):** Ordnerstruktur `vault/Konzepte/<name>.md`, `vault/Guides/<titel>.md`, `vault/Videos/<video-titel>.md`, `vault/Notizen/<titel>.md`; YAML-Frontmatter pro Datei (`quelle: <videoId>`, `zeitstempel: <sec>`, `tags: [...]`, `typ: <note.type>`); `body_md` bleibt unverändert mit `[[Wiki-Links]]`; Ausgabe als ZIP (expo-file-system + expo-sharing). Obsidian öffnet den Ordner direkt als Vault.
- **Löschung:** „Alles löschen" = DB-Datei + Modell-Dateien + Secure-Store-Tokens entfernen, dann OAuth-Revoke aufrufen.
- **Backups des OS** (iCloud/Android Auto-Backup): App-Daten bleiben damit im Ökosystem des Nutzers; Modell-Ordner wird vom Backup ausgeschlossen (zu groß).

---

## 10. Qualität & Teststrategie

- **Unit:** SRS (SM-2), Chunking, zod-Schemas, Quota-Budget, Prompt-Template-Rendering, Geocode-Cache, **Wiki-Link-Parser/Resolver (inkl. ungelöster Links + Rename-Re-Resolve)**, Vault-Export-Serializer. Ziel: > 80 % für `core/`.
- **Integration:** Repositories gegen echte SQLite (expo-sqlite in Jest via Test-DB), API-Client gegen aufgezeichnete Responses (MSW), Graph-Query aus Testdatensatz.
- **KI-Qualität:** Golden-Set aus 10 Beispiel-Videos (Transkripte im Repo) → Snapshot-Tests auf Schema-Konformität und grobe Inhalts-Checks (keine Exaktheit, sondern „enthält Zeitstempel, ≥ 3 Key Points", Guide: „≥ 4 geordnete Schritte mit Material").
- **E2E:** Maestro-Flows (Login-Mock → Video schauen → Analyse → Flashcard-Review → Guide-Modus durchklicken) für iOS/Android; Web-Smoke später mit Playwright.
- **Performance-Budgets:** Analyse P50 < 90 s auf Referenzgerät (iPhone 13 / Pixel 7), App-Start < 2 s, Suche < 300 ms bei 50k Chunks, Graph-Layout < 500 ms bei 1.000 Nodes.

---

## 11. Offene technische Punkte (nach Phase zugeordnet)

1. **Phase 3:** Belastbarkeit der Untertitel-Extraktion gegen YouTube-Änderungen → Adapter-Schicht + Fehler-Telemetrie lokal (kein Crash-Reporting-SDK) → Entscheidung Whisper-Fallback.
2. **Phase 4:** Finales Chat-Modell per Benchmark (Qualität JSON-Output, dt. Sprache, Tok/s auf Referenzgeräten).
3. **Phase 7:** Konzept-Dedup-Qualität des 3–4B-Modells (deutsche/englische Normalformen, Synonyme) — ggf. Embedding-basiertes Clustern statt reinem String-Match.
4. **Phase 9:** sqlite-vec vs. JS-Index auf nativ final messen (50k/200k Vektoren).
5. **Phase 11:** WebGPU-Verfügbarkeit Safari/Firefox neu bewerten; ggf. WASM-LLM-Fallback (llama.cpp WASM, langsam) oder konsequent Read-only.
6. **Phase 12:** Datentransfer Phone → TV (Export-Datei via iCloud/Files vs. lokaler HTTP-Transfer) — kleinste Lösung wählen.
