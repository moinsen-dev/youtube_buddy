# Product Requirement Document — YouTube Buddy

**Status:** Draft v1.1 (Planungsphase, noch keine Implementierung)
**Datum:** 2026-07-19 (v1.1: M11 Wissensbasis + Guide-Modus ergänzt)
**Plattformen:** iOS, Android, Web, Tablet (responsive), später Apple TV (tvOS)
**Grundprinzip:** **Local-Only** — alle Daten und die gesamte KI laufen auf dem Gerät des Nutzers. Es gibt keinen eigenen Server.

---

## 1. Vision

> **Aus passivem YouTube-Konsum wird verarbeitbares, wiederfindbares Wissen.**

Menschen schauen täglich YouTube — Tutorials, Vorträge, Reisevideos, Reviews, Kochvideos. Das Wissen darin verpufft: Man verliert den Überblick über die eigenen Abos und langen Videos, findet einmal Gesehenes nicht wieder, und am nächsten Tag ist der Inhalt vergessen. YouTube Buddy schaut (im wörtlichen Sinne) mit: Die App trackt, was tatsächlich geschaut wurde, analysiert Videos mit **lokaler KI auf dem Gerät** und macht daraus Zusammenfassungen, Kapitel, Flashcards, Habits, Schritt-für-Schritt-Anleitungen und Reisekarten — alles landet in einer **persönlichen, verlinkten Wissensbasis** (Obsidian-ähnlich) und ist durchsuchbar in einfachen Worten.

### Leitprinzipien

1. **Local-Only & Datenschutz by Design.** Keine eigenen Server, keine Cloud-Datenbank, kein Tracking durch uns. Die einzigen externen Endpunkte sind die Google/YouTube-APIs (Account des Nutzers) und — nur nach Opt-in — ein Geocoding-Dienst für das Reise-Modul. KI-Inferenz läuft vollständig on-device.
2. **Der Nutzer besitzt seine Daten.** Lokale SQLite-Datenbank, jederzeit exportierbar (JSON-Backup oder Obsidian-Vault), jederzeit vollständig löschbar.
3. **KI als Werkzeug, nicht als Blackbox.** Jede KI-Ausgabe zeigt ihre Quelle (Video + Zeitstempel). Nichts wird ohne Nutzeraktion „weg-abstrahiert".
4. **Responsive & plattformübergreifend.** Eine Codebasis (Expo/React Native) für Phone, Tablet, Web und später TV — jeweils mit nativem Look & Feel der Plattform.
5. **Inkrementeller Wert.** Jede Entwicklungsphase liefert ein lauffähiges, für sich nützliches Produkt.

---

## 2. Zielgruppe & Personas

### Persona A — „Lena, die lernende Vielschauerin"
- 29, schaut täglich 1–2 h YouTube: Vorträge, Doku-Essays, Programmier-Talks, Produktivitätscontent.
- **Problem:** „Ich habe letzte Woche ein Video über X gesehen …" — findet es nicht wieder; das Gelernte ist nach zwei Tagen weg.
- **Nutzen für sie:** Semantische Suche („dieses Video über Tiefschlaf und Sport"), automatische Zusammenfassungen, Flashcards mit Spaced Repetition, und eine Wissensbasis, in der Konzepte wie „Tiefschlaf" über alle Videos hinweg verlinkt sind.

### Persona B — „Marco, der How-To-Sammler"
- 41, schaut Heimwerker-, Koch- und Tech-Tutorials, oft 20–45 min lang.
- **Problem:** Will beim Machen nicht ständig im Video hin- und herspulen; Schritte, Zutaten und Material sind im Video vergraben. Konkret: Beim Tischbau muss er nach jedem Arbeitsschritt mit dreckigen Händen das Handy entsperren und zurückspulen.
- **Nutzen für ihn:** **Guide-Modus** — aus dem Video extrahierte Schritt-Karten im Vollbild, eine Karte pro Arbeitsschritt, mit Material-Checkliste, Zeitstempel-Sprung zurück ins Video und optionalem Vorlesen per On-Device-TTS (freie Hände). Plus Kapitel-Extraktion und „Lohnt sich das Video?"-Triage vor dem Schauen.

### Persona C — „Aylin, die Reise-Inspiration"
- 35, schaut Reise-Vlogs zur Urlaubsplanung; hat 180 Abos, davon die Hälfte seit Monaten nicht geschaut.
- **Problem:** Aus Vlogs die tatsächliche Route/Orte zu übernehmen ist mühsam; Abo-Liste ist ein Friedhof.
- **Nutzen für sie:** Reise-Extraktion mit Map-Darstellung (Route, Orte, Zeitstempel), Subscription-Hygiene mit Entabonnier-Vorschlägen.

---

## 3. Problemstatement

| # | Problem | Heute | Auswirkung |
|---|---------|-------|------------|
| P1 | Überblickverlust | Abos, Watch Later und Likes wachsen unstrukturiert; YouTube sortiert nach Engagement, nicht nach Nutzerinteresse | Relevanter Content geht unter |
| P2 | Lange Videos sind schwer erschließbar | 20+ Minuten schauen, um 3 relevante Minuten zu finden | Zeitverschwendung, Absprung |
| P3 | Gesehenes Wissen verpufft | Kein System, das Inhalte festhält und **vernetzt** | „Habe ich mir gemerkt" ≠ verfügbar; Zusammenhänge zwischen Videos bleiben unsichtbar |
| P4 | Wiederfinden scheitert | YouTube-Verlaufssuche ist wortbasiert und unvollständig; die API liefert den Verlauf gar nicht | Frustration, doppelt geschaut |
| P5 | Tote Subscriptions | Hunderte Abos, nie aufgeräumt | Rauschen im Feed |
| P6 | Nachbauen aus Videos ist mühsam | Anleitungen existieren nur als lineares Video; ständiges Spulen mit dreckigen/vollen Händen | Fehler, Frustration, Abbruch |

---

## 4. Lösungsüberblick

YouTube Buddy ist eine **Companion-App rund um das eigene YouTube-Konto**:

1. **Sehen:** Videos werden im In-App-Player (offizieller YouTube-IFrame-Player) geschaut. Die App trackt Fortschritt und Sehdauer selbst — denn die YouTube-API liefert keinen Watch-Verlauf (siehe §7).
2. **Verstehen:** Zu geschauten (oder ausgewählten) Videos wird das Transkript geholt und **lokal auf dem Gerät** von einem LLM analysiert: TL;DR, Kapitel, Key Points, Relevanz-Bewertung.
3. **Behalten:** Auf Knopfdruck entstehen Flashcards (mit Spaced-Repetition-Training), Habit-Vorschläge oder Schritt-für-Schritt-Anleitungen mit Vollbild-Guide-Modus.
4. **Vernetzen:** Jede dieser Ausgaben landet als Markdown-Notiz in einer Obsidian-ähnlichen Wissensbasis: [[Wiki-Links]], Backlinks, automatische Konzept-Seiten, Graph-Ansicht — und als Obsidian-Vault exportierbar.
5. **Wiederfinden:** Lokale Embeddings über Transkripte, Analysen und Notizen ermöglichen Suche in einfachen Worten („das Kochvideo mit der gusseisernen Pfanne").
6. **Aufräumen:** Die App vergleicht Abo-Liste mit tatsächlichem Sehverhalten und schlägt Entabonnierungen vor (ausführbar via API).

---

## 5. Feature-Liste (Module, MoSCoW-priorisiert)

Legende: **M**ust (v1-Kern) · **S**hould (v1, nach Must) · **C**ould (v1.x / v2) · **W**on't (bewusst nicht, siehe §6)

### M1 — YouTube-Integration
| Feature | Prio | Beschreibung |
|---|---|---|
| Google-Login (OAuth 2.0) | M | Sign-in nativ (@react-native-google-signin) und Web (GIS), Scopes: `youtube.readonly` (Basis) + `youtube.force-ssl` (nur für Entabonnieren, beim ersten Unsubscribe nachgefordert) |
| Subscriptions-Liste | M | Alle Abos mit Kanalinfos, lokaler Cache |
| Playlists & Watch Later | M | Eigene Playlists inkl. „Watch Later", Einträge, lokaler Cache |
| Likes | S | Gelikte Videos als weitere Quelle |
| Kanal-/Video-Details | M | Metadaten, Thumbnails, Dauer, lokaler Cache (spart Quota) |
| Quota-Management | M | Budget-Tracker für 10.000 Units/Tag, Batching, Cache-first |

### M2 — In-App-Player & Watch-Tracking
| Feature | Prio | Beschreibung |
|---|---|---|
| IFrame-Player (WebView) | M | Offiziell erlaubte Wiedergabe, Kapitel-Sprünge, Geschwindigkeit |
| Watch-Sessions | M | Fortschritt (Position, Prozent, Dauer) pro Video, pausier-/fortsetzbar |
| „Weiterschauen"-Rail | M | Home-Rail mit Fortschrittsbalken |
| Eigener Verlauf | M | Chronologische lokale History (ab Installation; Ersatz für den fehlenden API-Verlauf) |
| „Als geschaut markieren" (manuell) | S | Für außerhalb geschaute Videos |
| Google-Takeout-Import | C | Historischer Verlauf via Takeout-JSON/HTML-Import (opt-in) |

### M3 — Transkript-Pipeline
| Feature | Prio | Beschreibung |
|---|---|---|
| Untertitel-Extraktion | M | Abruf vorhandener Untertitel (inkl. Auto-CC) inkl. Sprachwahl; **ToS-Grauzone, siehe §7** |
| Chunking & Zeitstempel | M | Transkript in semantische Abschnitte mit Zeitmarken (für Kapitel-Sprünge und Quellen) |
| Lokaler Transkript-Cache | M | Pro Video genau einmal abrufen |
| Lokale Whisper-Transkription (Fallback) | C | whisper.cpp/transformers.js, falls keine Untertitel existieren; erfordert Audio-Beschaffung (eigenes ToS-/Rechte-Thema) |

### M4 — Lokale KI-Engine
| Feature | Prio | Beschreibung |
|---|---|---|
| Engine-Abstraktion (`LLMEngine`) | M | Ein Interface (`generate`, `embed`, später `transcribe`), Backends: nativ llama.cpp (llama.rn), Web WebLLM/transformers.js |
| Modell-Management | M | Download (GGUF via Hugging Face), Speicherplatz-Anzeige, Löschen, Versionierung; Empfehlung je nach Geräte-RAM |
| Chat-Modell (3–4B) | M | z. B. Qwen3-4B / Gemma-3-4B / Llama-3.2-3B (quantisiert Q4); Auswahl im Architektur-Doc |
| Prompt-Templates + JSON-Validierung | M | Strukturierte Outputs (zod-Schemas), Retry bei Parse-Fehler |
| Embedding-Modell | S | Kleines Mehrsprachen-Modell (z. B. multilingual-e5-small / bge-small) für M8 |
| On-Device-Inferenz-UX | M | Fortschrittsanzeige, Abbruch, „läuft lokal — keine Daten verlassen das Gerät"-Hinweis |

### M5 — Video-Analyse
| Feature | Prio | Beschreibung |
|---|---|---|
| TL;DR + Zusammenfassung | M | 2–3 Sätze plus ausführliche Summary, mit Zeitstempel-Quellen |
| Kapitel & Key Points | M | Automatische Kapitel mit Zeitmarken (falls Video keine hat), Bullet-Key-Points |
| „Lohnt sich das?"-Triage | M | Score 1–5 + Begründung + geschätzter „Nutzen pro Minute"; für Watch-Later-Queue vor dem Schauen |
| Längen-Empfehlung | S | „Relevant: 04:12–09:30" — welche Abschnitte sich lohnen |
| Stimmung/Kategorie | C | Grobe Einordnung (Tutorial, Essay, Vlog, Review) zur Filterung |

### M6 — Wissensmodule
| Feature | Prio | Beschreibung |
|---|---|---|
| Flashcard-Generierung | M | Aus Transkript/Analyse; Frage-Antwort-Karten mit Video-Quelle + Zeitstempel |
| Spaced Repetition (SRS) | M | SM-2-Algorithmus lokal, tägliche Review-Queue, Retention-Stats |
| Habit-Ableitung | S | „Aus diesem Video: 3 umsetzbare Gewohnheiten" mit Checklisten-Tracking |
| Schritt-für-Schritt-Anleitungen (Guides) | M | Aus Video extrahierte, geordnete Schritte mit Material-/Werkzeugliste und Zeitstempel-Links; editierbar |
| **Guide-Modus (Vollbild-Schrittkarten)** | M | Eine Karte pro Schritt im Vollbild: großer Text, Fortschritt „Schritt 4/9", Wischen/Weiter, Material-Hinweis je Schritt, Sprung zur Video-Stelle; dazu kompakte Checklisten-Übersicht. Fortschritt wird persistiert (später weitermachen). Ziel: kein Spulen im Video mehr (Persona B) |
| Schritte vorlesen (On-Device-TTS) | S | expo-speech, komplett lokal, DE/EN; freie Hände beim Nachbauen; optional Auto-Weiter nach Schritt |
| Eigene Notizen | S | Freie Markdown-Notizen pro Video, durchsuchbar; Teil der Wissensbasis (M11) |

### M7 — Reise-Modul
| Feature | Prio | Beschreibung |
|---|---|---|
| Orts-Extraktion | S | KI extrahiert Orte/POIs/Route aus Reisevideos (mit Zeitstempeln) |
| Geocoding | S | Opt-in Online (Nominatim/OSM) mit lokalem Cache; **Local-Only-Ausnahme, klar gekennzeichnet**; Alternativ: manuelle Orts-Pinning offline |
| Map-Darstellung | S | Route/Orte auf Karte (react-native-maps nativ, Leaflet Web), Karteikarten pro Ort mit Video-Sprung |
| Trip-Sammlung | C | Mehrere Videos zu einer Reise bündeln, als Plan exportieren |

### M8 — Semantische Suche
| Feature | Prio | Beschreibung |
|---|---|---|
| Embedding-Index | S | Lokale Vektoren über Transkript-Chunks, Analysen, Notizen und Konzept-Seiten (M11) |
| Natürlichsprachliche Suche | S | „Video, wo er die Pfanne ohne Öl benutzt" → Treffer mit Video + Zeitstempel |
| Filter & klassische Suche | S | Kombinierbar: Kanal, Zeitraum, „geschaut >80 %" |
| Such-Verlauf | C | Eigene Queries lokal speichern |

### M9 — Subscription-Hygiene
| Feature | Prio | Beschreibung |
|---|---|---|
| Sehverhalten-Report | S | Pro Kanal: geschaute Videos, Sehquote, „zuletzt geschaut" — aus eigenem Tracking (M2) |
| Entabonnier-Vorschläge | S | Regeln: „0 Views in 90 Tagen", „Quote <10 %"; User wählt aus |
| Unsubscribe via API | S | `subscriptions.delete` (Scope `youtube.force-ssl`, wird erst dann angefragt) |
| „Snooze"/Stummschalten-Liste | C | Kanäle temporär ausblenden, ohne zu entabonnieren |

### M10 — Multi-Plattform & Responsive
| Feature | Prio | Beschreibung |
|---|---|---|
| Responsive Phone/Tablet | M | Bottom Tabs (Phone), Navigation Rail (Tablet) |
| Web-App | M | Sidebar-Layout; KI via WebLLM (WebGPU nötig — Fallback-Hinweis sonst) |
| Apple TV (tvOS) | C | react-native-tvos; **Konsum-View**: Flashcards-Review, Reise-Maps, Summaries, Graph-Ansicht (nur Ansicht), Weiterschauen-Übersicht (kein Player-Zwang, keine KI auf TV nötig) |
| Export/Backup | S | JSON-Export aller lokalen Daten (einzige „Brücke" zwischen Geräten, da kein Sync); zusätzlich Obsidian-Vault-Export (M11) |

### M11 — Wissensbasis (Obsidian-ähnlich)
| Feature | Prio | Beschreibung |
|---|---|---|
| Markdown-Notizen als Wissensformat | M | Jede KI-Ausgabe (Summary, Key Points, Flashcards, Guides, Habits, Trip-Orte) erzeugt/verlinkt automatisch Notizen; zusätzlich freie Notizen. Quelle (Video + Zeitstempel) ist Pflichtfeld |
| [[Wiki-Links]] + Link-Auflösung | M | Obsidian-Syntax; ungelöste Links erlaubt (wie in Obsidian); Umbenennen aktualisiert Links |
| Backlinks-Panel | M | „Wird erwähnt in …" auf jeder Notiz/Konzept-Seite |
| Konzept-Seiten (automatisch) | S | KI erkennt wiederkehrende Begriffe/Themen über Videos hinweg (z. B. „Tiefschlaf", „Gusseisen-Pflege") → Konzept-Notiz sammelt automatisch alle Quellen |
| Graph-Ansicht (interaktiv) | S | Nodes: Konzepte/Notizen/Videos; Kanten: Links; Pan/Zoom, Filter nach Typ, Tap → Notiz. **Vollständig lokal**, keine Online-Visualisierung |
| Obsidian-Vault-Export | M | .md-Dateien mit YAML-Frontmatter (Quelle, Zeitstempel, Tags), Ordnerstruktur (Konzepte/, Guides/, Videos/…), Wiki-Links bleiben [[...]]-Syntax; ZIP-Export |
| Notizen-Editor | M | Markdown-Editor mit Link-Autocomplete auf vorhandene Notizen/Konzepte |

---

## 6. Nicht-Ziele (v1, Won't)

- **Kein Server, kein Sync, kein Multi-Device-Abgleich** (außer manuellem JSON-Export/Import bzw. Vault-Export). Sync wäre v2+ und müsste E2E-verschlüsselt sein.
- **Kein Video-/Audio-Download** (YouTube-ToS).
- **Kein Hintergrund-Playback / Picture-in-Picture-Tricksereien** (YouTube-ToS).
- **Keine Social-Features:** keine Kommentare lesen/schreiben, keine Shares, keine Profile anderer; auch kein Teilen von Notizen/Graph (lokaler Raum).
- **Kein Upload/Verwalten eigener Videos** (kein Creator-Studio).
- **Kein Zugriff auf fremde Nutzerdaten** — ausschließlich das Konto des eingeloggten Nutzers.
- **Kein Ersatz der YouTube-App für Entdecken/Feed-Scrolling** — Buddy ist Companion, kein Drittanbieter-Client mit eigenem Feed-Algorithmus.
- **Kein Obsidian-Ersatz:** Die Wissensbasis nutzt Obsidians Datenformat (Markdown + Wiki-Links) und exportiert dorthin, ersetzt aber keinen vollwertigen Vault-Editor (Plugins, Canvas etc.).

---

## 7. Technische Rahmenbedingungen & Risiken

### 7.1 YouTube Data API — harte Fakten
- **Quota:** Standard-Kontingent 10.000 Units/Tag (z. B. `search.list` = 100 Units!, `subscriptions.list` = 1, `videos.list` = 1). Konsequenz: **kein generelles `search`**, Cache-first, Batching (bis zu 50 IDs pro Call), Quota-Budget im UI sichtbar.
- **Kein Watch-History-Endpunkt.** Der Verlauf ist per API nicht abrufbar. → **Lösung (bestätigt):** In-App-Tracking via M2; optionaler Takeout-Import (Could).
- **Captions-API nur für eigene Videos** (`captions.download` erfordert Video-Ownership). → Transkripte fremder Videos nur über die **inoffizielle Untertitel-Extraktion** (wie sie Bibliotheken à la `youtube-transcript` nutzen). **ToS-Grauzone:** Funktioniert zuverlässig, ist aber nicht abgesichert; YouTube kann das jederzeit ändern/blockieren. Mitigation: (a) klar dokumentiert, (b) nur für vom Nutzer aktiv geschaute Videos, (c) Fallback lokale Whisper-Transkription als Could.
- **Wiedergabe** offiziell nur über den IFrame-Player (nativ via WebView). Download, Hintergrund-Play, Re-Upload sind untersagt.
- **OAuth-Verifizierung:** Scopes `youtube.readonly`/`youtube.force-ssl` sind „sensitive Scopes" → Google-App-Verifizierung nötig für >100 Nutzer; für Entwicklung/Eigenbedarf reicht der Test-Modus (max. 100 Test-User). **Realistische v1-Zielgruppe: persönlicher Gebrauch + kleine Tester-Gruppe.**

### 7.2 Lokale KI — harte Fakten
- Chat-Modell 3–4B quantisiert ≈ 2–2,5 GB Download, 3–4 GB freies RAM zur Laufzeit. **Mindestanforderung:** Geräte mit ≥6 GB RAM empfohlen; auf 4-GB-Geräten kleineres Modell (1–2B) mit Qualitätsverlust.
- Inferenz auf Phone: ~10–25 Token/s (geräteabhängig). Eine Video-Analyse (Summary + Kapitel) dauert typ. 30–90 s → asynchron, mit Fortschritt und Abbruch. Guide-Extraktion und Konzept-Erkennung (M11) laufen als Batch-Jobs im selben Rahmen.
- **Web:** WebLLM braucht WebGPU (Chrome/Edge ok; Safari/Firefox eingeschränkt). Fallback: Web zeigt Ergebnisse an, die auf einem nativen Gerät erzeugt wurden (via Export/Import), plus klare Hinweis-UX.
- **tvOS:** kein verlässliches LLM-Budget → TV nutzt nur bereits erzeugte Daten.
- **TTS (Guide-Modus):** expo-speech ist On-Device (iOS/Android Speech-Engines) — kein Netzwerk, kein Risiko. Web: SpeechSynthesis-API (Browser-lokal).

### 7.3 Plattform-Realität Apple TV
- react-native-tvos funktioniert mit Expo (Config-Plugin, eigener Build). Kein WebView-IFrame-Player auf TV → Wiedergabe auf TV **nicht** Kernfeature; TV = „großer Bildschirm für aufbereitetes Wissen" (Flashcards, Karten, Summaries, Graph-Ansicht).

### 7.4 Geocoding vs. Local-Only
- Offline-Geocoding ganzer Welt ist unpraktikabel. **Entscheidung:** Opt-in Online-Geocoding (Nominatim, 1 Request/Ort, gecacht), klar als einzige neben Google bestehende Netzverbindung gekennzeichnet; Nutzer kann Orte auch manuell pinnen.

### 7.5 Rechtliches/Compliance (kurz)
- App „frisiert" keinen YouTube-Content, speichert keine Videos, sondern Metadaten/Transkripte zum persönlichen Gebrauch. Dennoch: Untertitel-Extraktion ist die einzige echte Grauzone → Risiko akzeptiert, Fallback geplant.
- Google-API-Branding- und ToS-Richtlinien beachten (YouTube-Logo-Nutzung, „powered by YouTube" wo erforderlich).

### 7.6 ADR (2026-07-20): Pro-Tier mit E2E-Sync + Cloud-Analyse (Opt-in)

**Beschluss:** Nach v1 kommt ein **Paid Pro-Tier** mit zwei Modulen — (a) geräteübergreifende **E2E-verschlüsselte Synchronisation** der lokalen Daten, (b) **Cloud-Analyse** (serverseitiges LLM) als klar gekennzeichnetes Opt-in. **Free bleibt unverändert 100 % local-only** — das Leitprinzip 1 (§1) gilt weiterhin für die Free-Version; sämtliche Server-Kommunikation des Pro-Tiers ist Opt-in und pro Feature aktivierbar.

**Architektur-Entscheidungen:**

| Punkt | Entscheidung | Begründung |
|---|---|---|
| Server-Stack | **Firebase** (im bestehenden GCP-Projekt `youtube-buddy-moinsen`): Auth (Google-Provider), Firestore (Sync-Entitäten), Cloud Functions EU (Groq-Proxy) | Gleiches GCP-Projekt wie YouTube-API/OAuth → identische Google-Identität ohne Zweit-Auth; Firestore-Dokumente + Security Rules passen E2E-Ciphertext; erprobter Moinsen-Stack (`expo-firebase`/menulens: Firebase-MCP via CLI-Login, dev/prod-Umgebungen, Rules-Workflow, Emulator). **Nicht** genutzt: Crashlytics/Analytics (Local-only-Regel) |
| Cloud-LLM | **Groq** (Llama-70B-Klasse), Zugriff ausschließlich via Cloud Function (API-Key bleibt serverseitig) | Großer Qualitätssprung ggü. 3–4B on-device, sehr schnell, günstig; gleiche Prompt-Templates + Golden-Set-Gate wie on-device |
| Payment | **RevenueCat** | Store-übergreifende Subscriptions + Entitlements ohne Eigenbau; bewährte Firebase-Kombination |
| Sync-Modell | E2E (Client-seitige Verschlüsselung, Passphrase/Device-Key + Recovery-Code), Firestore-Dokumente pro Entität mit `updated_at`-LWW; Modelle, Caches, Transkript-Rohdaten bleiben lokal | Datenschutz by Design bleibt gewahrt (Server = blind); LWW reicht für Einzelnutzer-Sync |
| Cloud-Analyse | Drittes Backend `CloudEngine` hinter dem `LLMEngine`-Interface; Badge „Cloud (Opt-in)" als Invers zum On-Device-Badge | Keine Feature-Forks — Engine-Abstraktion (§3) trägt das ohne UI-Sonderfälle |

**Whitelist-Erweiterung (Opt-in, erst ab Phase 10.5 aktiv):** Firebase-Endpunkte (`identitytoolkit.googleapis.com`, `securetoken.googleapis.com`, `firestore.googleapis.com`, `*.cloudfunctions.net`), Groq API (`api.groq.com` — nur von der Cloud Function aus), RevenueCat API (`api.revenuecat.com`) + Store-Belege. Kein Analytics-/Crash-SDK, kein eigenes Tracking — auch im Pro-Tier nicht.

**Offene Detailentscheidungen für Phase 10.5:** Schlüsselableitung (Passphrase vs. Device-Key + Recovery), Konflikt-UI bei LWW-Kollisionen, Pro-Preis/Scope-Abgrenzung, Groq-Modell-Pinning via Golden-Set-Benchmark, dev/prod-Projektstruktur (Stack-Konvention: `youtube-buddy-moinsen-dev` neu, Bestandsprojekt wird prod).

---

## 8. Erfolgsmetriken (alle lokal messbar, kein Telemetrie-Server)

| Metrik | Ziel (nach 4 Wochen Nutzung) |
|---|---|
| Anteil geschauter Videos mit erzeugter Analyse | ≥ 40 % |
| Such-Erfolg (Nutzer klickt Treffer mit Zeitstempel) | ≥ 60 % der Suchen |
| Flashcard-Retention (SM-2 „gut"-Quote nach 7 Tagen) | ≥ 80 % |
| Watch-Later-Triage: abgearbeitete Videos/Woche | +50 % ggü. Baseline |
| Entabonnierte tote Kanäle (einmalig) | ≥ 20 % der Abos |
| Analyse-Latenz pro Video (P50 auf Zielgerät) | < 90 s |
| Guides vollständig durchlaufen (Guide-Modus bis letzter Schritt) | ≥ 60 % der gestarteten Guides |
| Wissensbasis-Wachstum: verlinkte Konzept-Seiten | ≥ 5/Woche bei aktiver Nutzung |

---

## 9. Offene Fragen / spätere Entscheidungen

1. **Takeout-Import** (historischer Verlauf): Aufwand mittel, Nutzen hoch für Persona A — als Could in Phase 10 eingeplant, Entscheidung nach erster Nutzung.
2. ~~**Sync v2**~~ → **beschlossen (ADR §7.6, 2026-07-20):** E2E-Sync als Paid-Pro-Modul (Supabase), Umsetzung ab Phase 10.5.
3. **Whisper-Fallback:** Abhängig davon, ob Audio-Beschaffung für Transkription sauber lösbar ist (ToS). Erst nach Phase 3 evaluieren.
4. **Modell-Auswahl final:** Benchmark auf Zielgeräten in Phase 4 (Kandidaten: Qwen3-4B-Instruct, Gemma-3-4B-it, Llama-3.2-3B-Instruct, jeweils Q4_K_M GGUF; Embedding: multilingual-e5-small).
5. ~~**Monetarisierung**~~ → **beschlossen (ADR §7.6, 2026-07-20):** Paid Pro-Tier (E2E-Sync + Cloud-Analyse Opt-in) via RevenueCat; Free bleibt 100 % local-only.
