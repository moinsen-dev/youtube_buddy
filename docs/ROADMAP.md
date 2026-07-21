# Roadmap — YouTube Buddy

**Status:** v1.1 (Planungsphase; v1.1: Guide-Modus in Phase 6, neue Phase 7 Wissensbasis, Renumbering)
**Prinzip:** Jede Phase liefert ein **lauffähiges, für sich nützliches Inkrement** und baut strikt auf den vorherigen auf. Abhängigkeiten sind explizit; nichts wird „auf Vorrat" gebaut.
**Referenzen:** Features = Module M1–M11 aus `docs/PRD.md` §5, Architektur-Entscheidungen aus `docs/ARCHITECTURE.md`, Screens/Tokens aus `docs/DESIGN.md`.

Aufwandsklassen (grob, 1 Dev): **S** < 1 Woche · **M** 1–2 Wochen · **L** 2–4 Wochen.

---

## Phase 0 — Fundament *(S)*
**Ziel:** Leeres Repo → lauffähige Expo-App mit Shell, Theme und DB.
- **Scope:** Expo + TypeScript strict + Expo Router init; Theme aus DESIGN.md §2 als `core/theme` (Tokens, Dark-First, Light-Variante); responsive Shell (Bottom Tabs < 600, Rail 600–1024, Sidebar > 1024) mit Dummy-Screens für die 5 Hauptbereiche (Home, Bibliothek, Suche, Wissen, Mehr); expo-sqlite + Drizzle Setup inkl. Migration-Runner; ESLint/Prettier/husky; Jest-Grundsetup.
- **Abhängigkeiten:** —
- **Exit-Kriterien:** App startet auf iOS-Simulator, Android-Emulator und Web (`npx expo start`); Navigation zwischen 5 Dummy-Tabs; `npm run lint && npm test` grün; Migration legt leeres Schema an.

## Phase 1 — Auth & YouTube-Read (M1) *(M)*
**Ziel:** Echter Login, echte Daten: Abos, Playlists, Watch Later, Likes.
- **Scope:** Google-Cloud-Projekt + OAuth-Clients (iOS/Android/Web, Test-Modus); `@react-native-google-signin` nativ, GIS auf Web; Token-Store (SecureStore/SessionStorage); `core/youtube`-Client mit Quota-Budget (`quota_log`), zod-DTOs, ETag-Cache; Repositories + Sync-Jobs für Subscriptions/Playlists/Playlist-Items/Videos/Likes; Bibliothek-Screen (DESIGN 5.3) mit echten Daten; QuotaMeter in Einstellungen.
- **Abhängigkeiten:** Phase 0.
- **Exit-Kriterien:** Login/Logout auf 3 Plattformen; Abos & Watch Later zeigen echte Daten nach Sync; erneutes Öffnen nutzt Cache (keine Quota); Quota-Zähler zählt nachweisbar korrekt (Unit-Test).
- **Risiko:** OAuth-Consent-Konfiguration (sensitive Scope `youtube.readonly`) — früh mit echtem Google-Account testen.

## Phase 2 — Player & Watch-Tracking (M2) *(M)*
**Ziel:** Videos in der App schauen, Fortschritt landet in der DB.
- **Scope:** IFrame-Player-Wrapper (WebView nativ, iframe Web) mit einheitlicher Event-API; `PlayerTracker` schreibt `watch_sessions` (5-s-Ticks, Pause/Ende); Video-Detail-Screen Grundgerüst (DESIGN 5.4, ohne KI-Tabs); Home-Screen (5.2) mit „Weiterschauen"-Rail; Verlaufs-Tab in Bibliothek; „Als geschaut markieren" (manuell).
- **Abhängigkeiten:** Phase 1 (Video-Metadaten).
- **Exit-Kriterien:** Video schauen → Session mit korrektem Prozentwert in DB; App-Neustart → „Weiterschauen" setzt an letzter Position fort; 80-%-Schwelle markiert „geschaut".

## Phase 3 — Transkript-Pipeline (M3) *(M)*
**Ziel:** Zu jedem geschauten Video liegt ein gechunktes Transkript lokal.
- **Scope:** Untertitel-Extraktion (Adapter-Schicht, s. PRD §7.1 Grauzone) mit Sprachwahl; Chunker mit Zeitstempel-Erhalt; `transcripts`/`transcript_chunks`-Tabellen + Cache (1 Abruf/Video); Fehler- und „keine Untertitel"-States im UI; Transkript-Ansicht im Video-Detail.
- **Abhängigkeiten:** Phase 2.
- **Exit-Kriterien:** Für 10 reale Testvideos: Transkript lokal vorhanden, Chunks tragen korrekte Zeitstempel; Zweitabruf kommt aus dem Cache (0 Netzwerk); Videos ohne Untertitel zeigen sauberen Empty-State.
- **Offene Entscheidung am Phasenende:** Whisper-Fallback nötig? (Auswertung der Fehlerquote.)

## Phase 4 — KI-Engine Core, nativ (M4) *(L)*
**Ziel:** On-Device-LLM läuft auf iOS/Android, verwaltbar über Einstellungen.
- **Scope:** `LLMEngine`-Interface + `LlamaCppEngine` (llama.rn); Modell-Registry + Download via expo-file-system (Resume, SHA-256-Check); Modell-Management-UI (DESIGN 5.11) inkl. RAM-/Speicher-Checks; Prompt-Template-System mit zod-Validierten JSON-Outputs (GBNF/JSON-Mode + Repair-Retry); Benchmark-Harness + Golden-Set (10 Videos); **Modell-Entscheidung final** (Qwen3-4B vs. Gemma-3-4B vs. Llama-3.2-3B).
- **Abhängigkeiten:** Phase 0; inhaltlich motiviert durch Phase 3 (Templates brauchen Chunks).
- **Exit-Kriterien:** Auf Referenzgeräten (iPhone 13, Pixel 7): Modell lädt, `generate` liefert schema-konformes JSON, ≥ 10 Tok/s; Golden-Set-Suite grün; Abbruch einer Generierung funktioniert.
- **Risiko:** llama.rn-Integration in Expo (Dev-Client/Config-Plugin nötig — kein Expo Go mehr ab hier).

## Phase 5 — Video-Analyse (M5) *(M)*
**Ziel:** Summary, Kapitel, Key Points, Triage sichtbar im Video-Detail.
- **Scope:** Analyse-Pipeline (Chunk-Map/Reduce bei langen Videos); Templates `summarize`, `chapters`, `triage`; `analyses`-Tabelle; UI: SummaryPanel, ChapterList mit Player-Sprüngen, TriageBadge; Analyse-Fortschritts-Sheet mit On-Device-Badge (DESIGN 5.5); Triage-Batch für Watch-Later-Queue (Home-Screen 5.2).
- **Abhängigkeiten:** Phasen 3 + 4.
- **Exit-Kriterien:** Golden-Set-Videos zeigen vollständige Analyse mit korrekten Zeitstempel-Sprüngen; P50-Analysezeit < 90 s auf Referenzgerät; Triage über 12 Watch-Later-Videos läuft als Batch mit Fortschritt.

## Phase 6 — Wissensmodule & Guide-Modus (M6) *(L)*
**Ziel:** Aus Analysen werden Flashcards, Habits und **Guides mit Vollbild-Modus** — inkl. SRS-Training.
- **Scope:** Templates `flashcards`, `habits`, `howto` (mit Quellen-Zeitstempeln, geordnete Schritte + Material-Referenzen); Tabellen + Repositories; Wissen-Tab Grundgerüst (DESIGN 5.13: Review-Kachel, Guide-Liste); Review-Queue (SM-2), Flashcard-Flip-UI (DESIGN 5.6), Stats (Retention, Streak); **Guide-Übersicht** (DESIGN 5.7: Material-Checkliste, Schritt-Status) + **Guide-Modus** (DESIGN 5.12: Vollbild-Schrittkarten, Swipe/Buttons ≥ 64 pt, `progress_step`-Persistierung, „Im Video ansehen"-Sprung und zurück); **TTS-Vorlesen** via expo-speech (Should, inkl. optionalem Auto-Advance); Habit-Checkliste; freie Notizen (einfacher Markdown-Editor im Video-Detail).
- **Abhängigkeiten:** Phase 5.
- **Exit-Kriterien:** Aus einem Kochvideo entstehen ≥ 8 Karten + 1 Anleitung mit korrekten Quellen; Guide-Modus lässt sich komplett durchklicken (Schritt 1→9), speichert Fortschritt, TTS liest einen Schritt vor; „Im Video ansehen" springt zum Zeitstempel und zurück; SM-2 plant Reviews korrekt (Unit-Tests + simulierte Tage).

## Phase 7 — Wissensbasis (M11) *(L)*
**Ziel:** Alles Wissen wird zu verlinkten Markdown-Notizen — Obsidian-ähnlich, inkl. Graph und Vault-Export.
- **Scope:** `notes`/`concepts`/`note_links`-Tabellen + Repositories; Notiz-Erzeugung aus allen bisherigen Features (Summaries, Flashcard-Sets, Guides, Habits, Trips → `notes` mit `note_id`-Rückverweis); `core/markdown`: Wiki-Link-Parser + Resolver (ungelöste Links erlaubt, Rename-Re-Resolve); Backlinks-Panel; Konzept-Extraktion (Template `extract_concepts`, Dedup gegen `concepts`); Notiz-/Konzept-Detail (DESIGN 5.14), Wissen-Übersicht vollständig (Konzept-Chips, Notiz-Liste); **Graph-Ansicht** (DESIGN 5.15: Query → d3-force → react-native-svg/Web-SVG, Filter, Tap → Notiz); **Obsidian-Vault-Export** (Ordnerstruktur + YAML-Frontmatter + ZIP); Markdown-Editor mit Link-Autocomplete.
- **Abhängigkeiten:** Phasen 5 + 6 (Analysen/Guides als Notiz-Quellen).
- **Exit-Kriterien:** Notiz mit `[[Koffein]]` löst auf Konzept-Notiz auf; Backlinks zeigen alle Erwähnungen; Graph rendert lokale Daten < 500 ms bei 1.000 Nodes; exportierter Vault (ZIP) öffnet in Obsidian fehlerfrei inkl. funktionierender Wiki-Links; Umbenennen eines Konzepts aktualisiert Links (Unit-Test).
- **Risiko:** Konzept-Dedup-Qualität kleiner Modelle — Golden-Set-Gate, ggf. Embedding-Clustering nachschärfen (ARCHITECTURE §11).

## Phase 8 — Reise-Modul (M7) *(M)*
**Ziel:** Reisevideo → Orte → Route auf Karte (als verlinkte Trip-Notiz).
- **Scope:** Template `extract_places`; `trips`/`trip_places`; Geocoding-Opt-in (Einstellungen-Toggle, Nominatim mit 1-req/s-Limiter + Cache, Status je Ort); Map-Screen (DESIGN 5.8): react-native-maps nativ, Leaflet Web; Ortsliste mit Zeitstempel-Sprüngen; manuelles Pinnen/Editieren von Orten (offline-tauglich); Trip-Notiz in Wissensbasis.
- **Abhängigkeiten:** Phase 5; ideal nach 7 (Notiz-Anbindung).
- **Exit-Kriterien:** Aus einem Reise-Vlog werden ≥ 4 Orte extrahiert, nach Opt-in geocoded und als Route dargestellt; ohne Opt-in funktioniert alles bis auf Koordinaten (manuelles Pinnen); jeder Ort springt zur Video-Stelle; Trip erscheint als verlinkte Notiz.

## Phase 9 — Semantische Suche (M8) *(M)*
**Ziel:** Videos, Notizen und Konzepte in einfachen Worten wiederfinden.
- **Scope:** Embedding-Modell (~~multilingual-e5-small~~ → paraphrase-multilingual-MiniLM-L12-v2, BERT-Arch — XLM-RoBERTa kann das gebundelte llama.cpp nicht) in `LLMEngine.embed` (nativ via llama.rn-Embedding); Index-Job (idle, batch) über Chunks/Notizen/Konzepte/Analysen; `embeddings`-Tabelle + JS-kNN (kein sqlite-vec — trivial bei unseren Korpusgrößen); Suche-Screen (DESIGN 5.9) mit Hybrid aus Vektor + FTS5 (RRF, gleichgewichtet), Typ-Icons (Video/Notiz/Konzept), Filtern (Typ); Treffer → Video-Detail bzw. Notiz-Detail mit Zeitstempel-Sprung.
- **Abhängigkeiten:** Phasen 3 + 4; ideal nach 7 (Notiz-/Konzept-Korpus).
- **Exit-Kriterien:** Golden-Queries (10 natürlichsprachliche Fragen über Test-Korpus) finden das richtige Video/die richtige Notiz in Top-3 in ≥ 8/10 Fällen; Suche < 300 ms bei 50k Chunks.

## Phase 10 — Subscription-Hygiene (M9) *(S)*
**Ziel:** Abo-Friedhof aufräumen, inkl. API-Unsubscribe.
- **Scope:** Sehverhalten-Report (SQL über `subscriptions` × `watch_sessions`); Hygiene-Screen (DESIGN 5.10) mit Regel-Vorschlägen + Checkbox-Auswahl; inkrementeller Scope `youtube.force-ssl` beim ersten Unsubscribe; Batch-Unsubscribe mit Quota-Check (50 Units/Kanal); **Could-Entscheidung:** Takeout-Import des historischen Verlaufs (Parser + Merge in `watch_sessions` mit `source='takeout'`).
- **Abhängigkeiten:** Phasen 1 + 2 (Datenbasis), sinnvoll erst nach einigen Wochen Tracking — fachlich letztes nativ-Feature.
- **Exit-Kriterien:** Report zeigt reale „💤"-Kanäle; Unsubscribe-Flow funktioniert Ende-zu-Ende (Test-Account), inkl. Scope-Dialog und lokaler Aktualisierung.

## Phase 10.5 — Pro-Tier: E2E-Sync & Cloud-Analyse *(L)* *(ADR PRD §7.6, beschlossen 2026-07-20)*
**Ziel:** Paid Pro-Tier: Geräteübergreifender E2E-Sync + Opt-in-Cloud-Analyse — Free bleibt 100 % local-only.
- **Scope:** Firebase-Setup im bestehenden GCP-Projekt (dev/prod nach Stack-Konvention): Auth (Google-Provider, idToken-Austausch mit dem YouTube-Login), Firestore (Sync-Entitäten, Security Rules: Owner-only, nur Ciphertext), Cloud Functions EU (**Firebase-AI/Gemini-Proxy**, kein Key in der App); `core/sync` (Client-Verschlüsselung Passphrase/Device-Key + Recovery-Code, LWW-Upsert/Pull via Snapshot, Modell-/Cache-Ausschlüsse); `CloudEngine` (Gemini via Function, `LLMEngine`-Interface, `responseSchema`-JSON-Mode) mit Opt-in-Toggle + „Cloud"-Badge + On-Device-Fallback; RevenueCat-Entitlements (lokal gecacht); Sync-Onboarding (Passphrase/Recovery-Code erklären); Golden-Set-Benchmark Gemini-Modell → Pinning; Emulator-Suite für Sync-Tests.
- **Abhängigkeiten:** Phasen 4–7 (Datenmodell + Engines final); PRD §7.6 ADR; Moinsen-Stack `expo-firebase` (Workflows: Firebase-MCP, Rules, dev/prod).
- **Exit-Kriterien:** Zwei Geräte synchronisieren Analysen/Karten/Notizen Ende-zu-Ende (Firestore enthält nur Ciphertext, verifiziert in der Konsole); Cloud-Analyse liefert für ein Golden-Set-Video bessere Analyse als On-Device (manueller Vergleich dokumentiert); Kauf-Flow (Sandbox) aktiviert Pro auf zwei Plattformen; Free-Nutzer ohne Pro sehen keinerlei Server-Traffic; kein Crashlytics/Analytics aktiv.

## Phase 11 — Web-KI & Web-Polish (M10, Teil 1) *(M)*
**Ziel:** Feature-Parität im Browser, soweit technisch möglich.
- **Scope:** `WebLLMEngine` (+ transformers.js Embeddings) hinter `LLMEngine`; WebGPU-Feature-Check → ohne WebGPU: Read-only-Modus (zeigt importierte Analysen/Karten/Notizen/Graph) mit klarer Hinweis-UX; Modell-Download über Browser-Cache-API; Web-Layout-Polish (Sidebar, Tastaturkürzel `/` Suche, Drag-Scroll-Rails); Graph-Rendering im Web (d3/SVG); SpeechSynthesis-TTS im Guide-Modus; Export/Import als Datei-Download/Upload inkl. Vault-ZIP (Brücke Phone ↔ Web).
- **Abhängigkeiten:** Phasen 4–9 (Engines existieren).
- **Exit-Kriterien:** Chrome/Edge (WebGPU): Analyse + Suche + Wissensbasis laufen vollständig im Browser; Safari ohne WebGPU: sauberer Read-only-Modus; JSON-Export vom Phone importiert in Web zeigt alle Inhalte inkl. Graph.

## Phase 12 — Apple TV (M10, Teil 2) *(L)*
**Ziel:** tvOS-Build als „Konsum-View" für aufbereitetes Wissen.
- **Scope:** react-native-tvos Target (eigener Expo-Build, `EXPO_TV=1`); 10-foot-UI: TV-Shell mit Fokus-Navigation, Skalierung × 1,5, Fokus-Ringe (DESIGN §2.3/§3); TV-Screens: Home-Rails (Weiterschauen-Übersicht), Flashcards-Review, Reise-Map (statisch), Analyse-Leseansicht, **Wissen/Graph nur Ansicht**; **Datentransfer Phone → TV:** Entscheidung Export-Datei (iCloud/Files) vs. lokaler HTTP-Transfer — kleinste Lösung zuerst; Remote-Unterstützung (Play/Pause, Swipe-Fokus).
- **Abhängigkeiten:** Phasen 5–8 (Inhalte existieren), 11 (Plattform-Reife des App-Codes).
- **Exit-Kriterien:** tvOS-Simulator + reales Apple TV: Fokus-Navigation durch alle TV-Screens; Flashcard-Review mit Siri Remote vollständig bedienbar; importierte Daten (inkl. Graph) erscheinen korrekt.

---

## Übersicht

| Phase | Inhalt | Module | Aufwand | baut auf |
|---|---|---|---|---|
| 0 | Fundament, Shell, Theme, DB | M10-Basis | S | — |
| 1 | Auth & YouTube-Read | M1 | M | 0 |
| 2 | Player & Tracking | M2 | M | 1 |
| 3 | Transkripte | M3 | M | 2 |
| 4 | KI-Engine Core (nativ) | M4 | L | 0, 3 |
| 5 | Video-Analyse | M5 | M | 3, 4 |
| 6 | Wissensmodule & Guide-Modus | M6 | L | 5 |
| 7 | Wissensbasis (Notizen, Links, Graph, Vault) | M11 | L | 5, 6 |
| 8 | Reise-Modul | M7 | M | 5 (7) |
| 9 | Semantische Suche | M8 | M | 3, 4 (7) |
| 10 | Subscription-Hygiene | M9 | S | 1, 2 |
| 11 | Web-KI & Polish | M10 | M | 4–9 |
| 12 | Apple TV | M10 | L | 5–8, 11
**Parallelisierbar:** 8 und 9 können parallel laufen (verschiedene Features, gleiche Engine). 10 kann jederzeit nach 2. Reihenfolge 6→7→8→9 ist die empfohlene Default-Sequenz (Wissen vor Zusatzmodulen).

**Meilensteine:**
- **MVP (nach Phase 5):** schauen + tracken + KI-Summaries/Triage — allein schon nützlich.
- **„Wissens-Release" (nach Phase 9):** Guides + Guide-Modus, Flashcards, verlinkte Wissensbasis mit Graph, Reisen, Suche — voller Kernnutzen.
- **v1 (nach Phase 11):** nativ + Web komplett.
- **v1.1 (nach Phase 12):** + Apple TV.

## Phasenübergreifende Risiken (Details PRD §7 / ARCHITECTURE §11)
1. **Untertitel-Extraktion** (ToS-Grauzone, kann von YouTube geändert werden) → Adapter-Schicht, Fehlerquote messen (Phase 3), Whisper-Fallback bereithalten.
2. **Google OAuth-Verifizierung** begrenzt v1 auf Test-Modus (≤100 Nutzer) → kein Blocker für Eigenbedarf, vor Release klären.
3. **Quota 10k Units/Tag** → Cache-first + kein `search.list`; bei Familien-Nutzung reicht das locker, bei Power-Usern QuotaMeter sichtbar.
4. **LLM-Qualität auf 3–4B** (Deutsch, JSON-Treue, Konzept-Dedup) → Golden-Set ab Phase 4 als Qualitäts-Gate für jedes Template/Modell-Update.
5. **Graph-Performance auf schwachen Geräten** → Layout-Grenze (z. B. 1.000 Nodes) + Filter-Default; Test in Phase 7.
6. **tvOS-Aufwand unterschätzen** → bewusst als letzte Phase, Funktionsumfang strikt „Konsum-View".
