# Design-Konzept — YouTube Buddy

**Status:** v1.1 (Planungsphase; v1.1: Tab „Wissen", Guide-Modus, Graph)
**Leitidee:** Dark-first „Media-Library" — eine ruhige, kinoreife Oberfläche, auf der Video-Content und KI-Ergebnisse im Vordergrund stehen. Die App fühlt sich an wie eine persönliche Bibliothek, nicht wie ein Feed.

---

## 1. Design-Prinzipien

1. **Content first.** Thumbnails und KI-Ergebnisse dominieren; UI-Chrom tritt zurück (wenig Farbe, viel Dunkelgrau, klare Hierarchie).
2. **Ruhig, nicht gamifiziert.** Kein endloser Scroll-Feed. Rails und Queues mit klarer Anzahl. Einzige „Spielmechanik": Fortschrittsbalken und SRS-Streak, dezent.
3. **Lokal = Vertrauen.** Wo immer KI läuft, signalisiert ein Badge „On-Device". Wo doch einmal Netz nötig ist (Geocoding-Opt-in), wird das explizit gesagt.
4. **Ein System, vier Formfaktoren.** Gleiche Komponenten, unterschiedliche Shells: Bottom Tabs (Phone), Navigation Rail (Tablet), Sidebar (Web/Desktop), 10-foot-UI mit Fokus-Ringen (TV).
5. **Zeitstempel sind Links.** Alles, was die KI aus einem Video extrahiert, springt per Tap zur Stelle im Player.
6. **Wissen ist vernetzt.** Jede KI-Ausgabe ist eine Notiz in der Wissensbasis: sichtbar verlinkt ([[Wiki-Links]]), rückverfolgbar (Backlinks), nie losgelöst von ihrer Quelle.

---

## 2. Design-Tokens

### 2.1 Farben

**Dark Theme (Standard):**

| Token | Hex | Verwendung |
|---|---|---|
| `bg/base` | `#0F1115` | App-Hintergrund |
| `bg/elevated` | `#161A21` | Cards, Panels |
| `bg/overlay` | `#1E242E` | Sheets, Modals, Hover |
| `line/subtle` | `#262D38` | Borders, Divider |
| `text/primary` | `#F2F4F7` | Haupttext |
| `text/secondary` | `#9AA3B2` | Metadaten, Captions |
| `text/tertiary` | `#6B7484` | Platzhalter, deaktiviert |
| `accent/primary` | `#F59E0B` (Amber) | Primäraktionen, aktive States, Fokus-Ring TV |
| `accent/primary-strong` | `#D97706` | Hover/Pressed |
| `accent/on-primary` | `#1A1205` | Text auf Amber |
| `semantic/success` | `#34C759` | Triage 4–5, „geschaut", SRS bestanden |
| `semantic/warning` | `#FF9F0A` | Triage 3, Quota-Warnung |
| `semantic/danger` | `#FF453A` | Triage 1–2, Fehler, Unsubscribe |
| `semantic/info` | `#4A9DFF` | Links, Wiki-Links, Kapitel, Map-Pins, Graph-Kanten |
| `brand/youtube` | `#FF0033` | Nur für YouTube-Pflicht-Branding (Login-Button-Hinweis etc.) |

**Light Theme (Alternativ, gleiche Struktur):** `bg/base #FAFAFC`, `bg/elevated #FFFFFF`, `line/subtle #E4E7EC`, `text/primary #101828`, `text/secondary #475467`, Akzent identisch (`#F59E0B`, Hover `#D97706`).

### 2.2 Typografie

System-Stack (keine Custom-Font in v1): iOS/macOS SF Pro, Android Roboto, Web `system-ui, -apple-system, "Segoe UI", Roboto`.

| Stil | Größe/Zeile (Phone) | Gewicht | Verwendung |
|---|---|---|---|
| Display | 34/40 | 700 | Screen-Titel, große Zahlen (SRS-Stats) |
| Title-1 | 24/30 | 700 | Section-Header, Card-Titel groß |
| Title-2 | 20/26 | 600 | Video-Titel, Sheet-Header |
| Title-3 | 17/22 | 600 | Listen-Titel, Karten-Titel |
| Body | 16/24 | 400 | Fließtext, Summaries, Notiz-Body |
| Body-Strong | 16/24 | 600 | Hervorhebungen |
| Step | 28/36 | 600 | Schritttext im Guide-Modus (Vollbild, aus 1–2 m lesbar) |
| Caption | 13/18 | 400 | Metadaten, Zeitstempel, Badges |
| Mono | 13/18 (SF Mono/Roboto Mono) | 400 | Zeitstempel-Chips, Code-Schritte |

TV-Skalierung: alle Werte × 1,5 (10-foot-UI), min. Body 24 px. Guide-Modus ist bewusst groß: Bedienung aus Armeslänge, Text aus 2 m Entfernung lesbar (Werkstatt/Küche).

### 2.3 Spacing, Radius, Elevation

- **Spacing:** 4-pt-Raster: `4, 8, 12, 16, 24, 32, 48`. Card-Padding 16 (Phone) / 24 (Tablet+).
- **Radius:** `sm 8` (Chips, Badges), `md 12` (Buttons, Inputs), `lg 16` (Cards), `xl 24` (Sheets). Thumbnails `md 12` (Rail) bzw. `lg 16` (Hero).
- **Elevation (Dark):** keine Schatten, Stufung über Hintergrund-Helligkeit (`base → elevated → overlay`) + 1-px-`line/subtle`. Light Theme: weiche Schatten (`0 2 8 rgba(16,24,40,.08)`).
- **Touch-Targets:** ≥ 44×44 pt (Phone/Tablet), im Guide-Modus ≥ 64 pt (dreckige/volle Hände), TV-Fokus-Ziele ≥ 72×72 px mit 3-px-Fokus-Ring `accent/primary` + Scale 1,04.

### 2.4 Iconography & Motion

- Icons: Lucide/Feather-Stil, 1,5-pt-Strich, gefüllt nur für aktive Tabs. Keine Emojis in der UI.
- Motion: 150–250 ms, `ease-out`; Flashcard-Flip 350 ms; StepCard-Wechsel 200 ms (Slide); TV-Fokus-Übergänge 150 ms. Keine autoplayenden Animationen außer Fortschrittsbalken der Inferenz.

---

## 3. Responsive Strategie & Shells

| Breakpoint | Breite | Shell | Layout-Charakter |
|---|---|---|---|
| Phone | < 600 | Bottom Tabs (5: Home, Bibliothek, Suche, Wissen, Mehr) | 1-spaltig, Rails horizontal |
| Tablet | 600–1024 | Navigation Rail (icons+labels, 80 pt) links | 2-spaltig: Liste links, Detail rechts (Split-View) |
| Web/Desktop | > 1024 | Sidebar (240 px, einklappbar auf Rail) | 2–3-spaltig, max. Contentbreite 1200 px, zentriert |
| TV (tvOS) | 1080p+ | Top-Nav oder Sidebar, Fokus-Navigation | Rails mit großen Cards (320×180), Text × 1,5, Safe-Area 5 % |

Gemeinsames Navigationsmodell: **Home · Bibliothek · Suche · Wissen · Mehr** (Einstellungen, Hygiene, Reisen darunter). **Wissen** bündelt die Wissensbasis (M11): Konzepte, Notizen, Guides, Flashcards/SRS, Habits, Graph. Der tägliche SRS-Einstieg bleibt zusätzlich über die Home-Kachel „Heute zu wiederholen" erreichbar. Suche ist auf jeder Plattform per Tastaturkürzel `/` (Web) bzw. Siri-Remote-Suchfeld (TV) erreichbar.

---

## 4. Komponenten-Katalog

| Komponente | Beschreibung | Zustände |
|---|---|---|
| **VideoCard** | Thumbnail 16:9, Dauer-Badge (overlay, unten rechts, `bg/base` 80 % + Caption mono), Fortschrittsbalken 3 px `accent/primary` unten, Titel 2-zeilig, Kanal + „geschaut 60 %" | default / hover / focus(TV, Ring+Scale) / pressed |
| **TriageBadge** | Kreis 28 px mit Score 1–5; Farbe: 4–5 success, 3 warning, 1–2 danger; Tooltip „Lohnt sich: 4/5 — verdichtetes Tutorial, 12 min Kern" | Score 1–5 / loading (Skeleton) |
| **ChapterList** | Zeilen: Mono-Zeitstempel-Chip (`semantic/info`) + Kapiteltitel; Tap → Player-Sprung | default / active (aktuelles Kapitel) |
| **SummaryPanel** | TL;DR (Body-Strong), ausklappbare Langfassung, Key-Points-Bullets, Quellen-Chips mit Zeitstempel | collapsed / expanded / generating (Progress + „On-Device"-Badge) |
| **Flashcard** | 3:2-Card, Vorderseite Frage, Tap → Flip 350 ms, Rückseite Antwort + Quelle; unten SRS-Buttons: „Nochmal / Schwer / Gut / Leicht" | front / back / graded |
| **GuideStepRow** | Nummernkreis, Schritt-Text, optional Zeitstempel-Link, Checkbox für „erledigt" (Checklisten-Übersicht) | todo / done / active |
| **StepCard (Guide-Modus)** | Vollbild: „Schritt 4/9" + Fortschrittsbalken, Schritttext in `Step`-Größe, Material-Hinweis-Chips, Buttons ≥ 64 pt: Zurück / TTS-Vorlesen / „Im Video ansehen" / Weiter; Wisch-Gesten | active / done / tts-playing |
| **NoteCard** | Notiz-Titel, Typ-Icon (Summary/Guide/Konzept/Frei), Snippet, Quellen-Chip (Video + Zeitstempel), Link-Anzahl | default / hover / focus(TV) |
| **WikiLink** | Inline-Link `[[Konzept]]` in `semantic/info`, ungelöste Links gestrichelt unterstrichen (`text/tertiary`) | resolved / unresolved |
| **BacklinkPanel** | Auf Notiz-Detail: Liste „Wird erwähnt in" mit NoteCards (kompakt) | collapsed / expanded |
| **ConceptChip** | Pill mit Konzept-Namen + Anzahl Quellen (z. B. „Tiefschlaf · 6"); Tap → Konzept-Seite | default / active |
| **GraphView** | Pan/Zoom-Canvas: Nodes kreisförmig (Konzept = amber, Notiz = info, Video = secondary), Kanten `line/subtle`; Tap Node → Notiz; Filter-Chips nach Typ. TV: nur Ansicht + Fokus-Navigation auf Nodes | default / node-focused / filtered |
| **MapView-Card** | Karte mit Route (Polyline `semantic/info`) + nummerierte Pins; unter der Karte Ortsliste mit Zeitstempel | — |
| **OnDeviceBadge** | Pill: Punkt `semantic/success` + „On-Device"; invertiert „Online (Opt-in)" in warning für Geocoding | local / online-opt-in |
| **QuotaMeter** | Einstellungen: Balken 10.000 Units/Tag, warning > 80 % | — |
| **EmptyState** | Zentrierte Illustration (Line-Art), Title-3, Caption, Primär-Button | — |
| **ModelRow** | Einstellungen: Modellname, Größe, RAM-Bedarf, Status (Installiert/Lädt %/Empfohlen), Aktionen | — |
| **SearchResultRow** | Thumbnail klein, Titel, Treffer-Snippet mit Highlight (`accent/primary` auf `bg/overlay`), Zeitstempel-Chip; Treffer können Videos, Notizen, Konzepte sein (Typ-Icon) | — |

---

## 5. Screen-Katalog mit Wireframes

ASCII-Wireframes in Phone-Breite (375 pt). Für Tablet/Web gilt: linke Spalte Liste, rechte Spalte Detail (gleiche Komponenten). TV: gleiche Inhalte als Rails mit Fokus.

### 5.1 Onboarding / Login

```
┌─────────────────────────────┐
│                             │
│        ◯ YouTube Buddy      │
│      Dein Wissen. Lokal.    │
│                             │
│  ┌───────────────────────┐  │
│  │  G  Mit Google        │  │
│  │     anmelden          │  │
│  └───────────────────────┘  │
│                             │
│  • Nur Lesezugriff auf YT   │
│  • Alle Daten bleiben auf   │
│    diesem Gerät             │
│  • KI läuft lokal (2 GB     │
│    Modell-Download später)  │
│                             │
│  Was Buddy trackt & warum ▸ │
└─────────────────────────────┘
```

### 5.2 Home

```
┌─────────────────────────────┐
│ Guten Abend, Lena      ⚙ ⌕ │
│                             │
│ WEITERSCHAUEN               │
│ ┌─────────┐ ┌─────────┐ →→  │
│ │▓▓▓▓▓░░░░│ │▓▓░░░░░░░│     │
│ │ 12:40   │ │ 45:20   │     │
│ │ Titel…  │ │ Titel…  │     │
│ └─────────┘ └─────────┘     │
│                             │
│ TRIAGE — WATCH LATER (12)   │
│ ┌─────────────────────────┐ │
│ │ [4] Titel…        18:22 │ │
│ │ [5] Titel…        09:41 │ │
│ │ [2] Titel…        51:03 │ │
│ └─────────────────────────┘ │
│ Analysiere Queue ▸ (lokal)  │
│                             │
│ HEUTE ZU WIEDERHOLEN   14 🂠│
├─────────────────────────────┤
│  ⌂     ▦      ⌕      📖  ⋯  │
│ Home Biblio Suche Wissen Mehr│
└─────────────────────────────┘
```

### 5.3 Bibliothek / Abos

```
┌─────────────────────────────┐
│ Bibliothek                  │
│ [Abos][Playlists][Verlauf]  │
│                             │
│ ● Kanal A      3 ungesehen  │
│ ● Kanal B      1 ungesehen  │
│ ● Kanal C   💤 0 Views/90 T │
│ ● Kanal D      7 ungesehen  │
│ …                           │
│                             │
│ 💤 = Hygiene-Vorschlag ▸    │
├─────────────────────────────┤
│  ⌂     ▦      ⌕     📖   ⋯  │
└─────────────────────────────┘
```

### 5.4 Video-Detail (Player + Kapitel + Summary)

```
┌─────────────────────────────┐
│ ┌─────────────────────────┐ │
│ │                         │ │
│ │     IFrame-Player       │ │
│ │       16:9              │ │
│ └─────────────────────────┘ │
│ Titel zwei Zeilen max…      │
│ Kanal · 24:18 · ▓▓▓░░ 20 % │
│                             │
│ [Summary][Kapitel][Notizen] │
│                             │
│ ⏱ TL;DR ● On-Device         │
│ Kernthese in zwei Sätzen…   │
│ ▸ Ausführliche Summary      │
│                             │
│ KEY POINTS                  │
│ • Punkt 1            04:12  │
│ • Punkt 2            09:30  │
│ • Punkt 3            17:45  │
│                             │
│ [🂠 Flashcards] [✓ Anleitung]│
│ [🗺 Reise extrahieren]      │
│ ▸ In Wissen verlinkt (3)    │
└─────────────────────────────┘
```

### 5.5 Analyse läuft

```
┌─────────────────────────────┐
│ Analysiere Video…      ✕    │
│ ┌─────────────────────────┐ │
│ │   ▓▓▓▓▓▓░░░░░░░  62 %   │ │
│ │   Kapitel werden erstellt│ │
│ │   ● On-Device — keine    │ │
│ │   Daten verlassen das    │ │
│ │   Gerät  · Modell: Qwen3 │ │
│ │   [Abbrechen]            │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

### 5.6 Flashcards-Review

```
┌─────────────────────────────┐
│ Review  7 von 14        ✕   │
│ ┌─────────────────────────┐ │
│ │                         │ │
│ │  Wofür steht der        │ │
│ │  „Zwei-Minuten-Start"?  │ │
│ │                         │ │
│ │  aus: Titel…      04:12 │ │
│ └─────────────────────────┘ │
│        Tippe zum Wenden     │
│                             │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ │
│ │↺   │ │ !! │ │ ✓  │ │ ★  │ │
│ │Noch│ │Schw│ │Gut │ │Lei.│ │
│ └────┘ └────┘ └────┘ └────┘ │
│ Streak: 5 Tage 🔥(dezent)   │
└─────────────────────────────┘
```

### 5.7 Guide-Übersicht (How-To)

```
┌─────────────────────────────┐
│ ‹ Tisch für die Sölch-      │
│   Küche bauen               │
│ aus: Titel… · Kanal · 24:18 │
│ ┌─────────────────────────┐ │
│ │ MATERIAL/WERKZEUG    ▾  │ │
│ │ ☐ Leimholz 120×60       │ │
│ │ ☐ 4 Hairpin-Legs  ☐ Öl  │ │
│ └─────────────────────────┘ │
│ SCHRITTE            4/9 ✓   │
│ ✓ 1 Platte zuschneiden 02:10│
│ ✓ 2 Kanten fräsen     05:44 │
│ ● 3 Beine montieren   11:02 │
│ ○ 4 Schleifen (120→240)15:20│
│ [Schritte bearbeiten]       │
│ ┌─────────────────────────┐ │
│ │ ▶ Guide-Modus starten   │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

### 5.8 Reise-Map

```
┌─────────────────────────────┐
│ ‹ Japan in 14 Tagen         │
│ ┌─────────────────────────┐ │
│ │  MAP (Leaflet/RN Maps)  │ │
│ │   ①Tokyo──②Hakone       │ │
│ │        ╲     │          │ │
│ │      ③Kyoto──④Nara      │ │
│ └─────────────────────────┘ │
│ ROUTE                       │
│ ① Tokyo — Ankunft    01:30  │
│ ② Hakone — Onsen     08:12  │
│ ③ Kyoto — Tempel…    12:45  │
│ ④ Nara — Tagestrip   16:03  │
│ [Als Trip speichern]        │
│ Geocoding: Online (Opt-in) ⚠│
└─────────────────────────────┘
```

### 5.9 Semantische Suche

```
┌─────────────────────────────┐
│ ⌕ kochvideo pfanne ohne öl  │
│ [Semantisch ●] [Filter ▾]   │
│                             │
│ ┌─────────────────────────┐ │
│ │🎬 Titel…          12:40 │ │
│ │ „…Pfanne kommt komplett │ │
│ │  ohne Öl aus…“    06:32 │ │
│ ├─────────────────────────┤ │
│ │📖 Konzept: Gusseisen-   │ │
│ │   pflege · 6 Quellen    │ │
│ └─────────────────────────┘ │
│ 2 Treffer · lokal indiziert │
└─────────────────────────────┘
```

### 5.10 Subscription-Hygiene

```
┌─────────────────────────────┐
│ ‹ Abo-Hygiene               │
│ 182 Abos · 47 inaktiv 💤    │
│ ┌─────────────────────────┐ │
│ │ VORSCHLÄGE              │ │
│ │ ☐ Kanal C  0 Views/90 T │ │
│ │ ☐ Kanal F  Quote 4 %    │ │
│ │ ☐ Kanal K  💤 seit 6 Mo │ │
│ │ [Alle auswählen]        │ │
│ └─────────────────────────┘ │
│ AM MEISTEN GESCHAUT         │
│ ● Kanal A   38 Videos · 82% │
│ ● Kanal D   21 Videos · 64% │
│                             │
│ [ 3 Kanäle entabonnieren ]  │
│ (einmalig Google-Zustimmung)│
└─────────────────────────────┘
```

### 5.11 Einstellungen (Modell-Management)

```
┌─────────────────────────────┐
│ Einstellungen               │
│ KI-MODELLE (lokal)          │
│ ● Qwen3-4B Q4  2,3 GB ✓ inst│
│ ○ Gemma-3-4B   2,5 GB  Laden│
│ ○ MiniLM-L12   0,1 GB  Empf.│
│ Freier Speicher: 41 GB      │
│                             │
│ DATEN (lokal)               │
│ Export als JSON ▸           │
│ Export als Obsidian-Vault ▸ │
│ Alles löschen ▸             │
│                             │
│ YOUTUBE-QUOTA  ▓▓░░ 2.140/  │
│ 10.000 Units heute          │
│                             │
│ Geocoding (Opt-in):  [ ○ ]  │
└─────────────────────────────┘
```

### 5.12 Guide-Modus (Vollbild-Schrittkarte)

```
┌─────────────────────────────┐
│ ✕                Schritt 4/9│
│ ▓▓▓▓▓▓▓▓░░░░░░░░░░░░        │
│                             │
│                             │
│   Beine montieren:          │
│   Hairpin-Legs mit je       │
│   4 Schrauben (4×40 mm)     │
│   an den Markierungen       │
│   festschrauben.            │
│                             │
│   🧰 Akkuschrauber, 4×40    │
│                             │
│ ┌─────┐ ┌─────┐ ┌─────────┐ │
│ │  ‹  │ │ 🔊  │ │ 11:02 🎬│ │
│ │Zurück│ │TTS │ │ im Video│ │
│ └─────┘ └─────┘ └─────────┘ │
│ ┌─────────────────────────┐ │
│ │         Weiter        › │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```
Buttons ≥ 64 pt; Wischen links/rechts = Weiter/Zurück; TTS liest Schritt vor und (optional) schaltet automatisch weiter.

### 5.13 Wissen-Übersicht (Tab „Wissen")

```
┌─────────────────────────────┐
│ Wissen                  ⌕   │
│ ┌─────────────────────────┐ │
│ │ 🂠 14 Karten fällig     │ │
│ │ Review starten        › │ │
│ └─────────────────────────┘ │
│ KONZEPTE                    │
│ [Tiefschlaf·6] [Gusseisen·4]│
│ [Zweiminuten·3] [Shinkansen]│
│                             │
│ GUIDES                      │
│ ▸ Tisch für die Sölch-      │
│   Küche bauen      4/9 ✓    │
│ ▸ Sourdough-Grundrezept     │
│                             │
│ NOTIZEN (zuletzt)           │
│ • Summary: Schlaf opti…  🎬 │
│ • Freie Notiz: Ideen Werk…  │
│                             │
│ ┌─────────────────────────┐ │
│ │ ◉ Wissensgraph ansehen  │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│  ⌂     ▦      ⌕     📖   ⋯  │
└─────────────────────────────┘
```

### 5.14 Notiz-/Konzept-Detail

```
┌─────────────────────────────┐
│ ‹ Konzept                   │
│ Tiefschlaf                  │
│ ┌─────────────────────────┐ │
│ │ Tiefschlaf ist die      │ │
│ │ erholsamste Phase.      │ │
│ │ Verknüpft mit [[Koffein │ │
│ │ ]] und [[Morgenlicht]]. │ │
│ │                         │ │
│ │ Quellen:                │ │
│ │ 🎬 Schlaf opti…   04:12 │ │
│ │ 🎬 Was passiert…  09:03 │ │
│ └─────────────────────────┘ │
│ WIRD ERWÄHNT IN (4)      ▾  │
│ • Summary: Schlaf optim…    │
│ • Flashcard: Halbwertsz…    │
│ • Konzept: [[Koffein]]      │
│ • Freie Notiz: Abendro…     │
│ [In Graph ansehen]          │
└─────────────────────────────┘
```

### 5.15 Graph-Ansicht

```
┌─────────────────────────────┐
│ ‹ Wissensgraph              │
│ [Alle][Konzepte][Videos]    │
│ ┌─────────────────────────┐ │
│ │      (Tiefschlaf)       │ │
│ │       ╱    │    ╲       │ │
│ │  (Koffein) │  (Morgen-  │ │
│ │       ╲    │   licht)   │ │
│ │        ╲   │   ╱        │ │
│ │      🎬 Schlaf optim…   │ │
│ │            │            │ │
│ │   (Gusseisen)──🎬 Pfann…│ │
│ └─────────────────────────┘ │
│ ● Konzept ● Notiz ● Video   │
│ Pinch = Zoom · Tap = öffnen │
└─────────────────────────────┘
```

---

## 6. Key-Flows

### Flow A — Schauen → Analysieren → Verarbeiten
1. Home → „Weiterschauen" → Video-Detail, Player startet, Watch-Session läuft (M2).
2. Bei ≥ 30 % geschaut (oder manuell): Button „Analysieren" → Sheet 5.5, Fortschritt + On-Device-Badge.
3. Ergebnis im Video-Detail (5.4): Summary, Kapitel, Key Points mit Zeitstempel-Links.
4. Nutzer wählt Verarbeitung: **Flashcards** (→ Review-Queue, Einstieg 5.13/Home-Kachel), **Anleitung** (→ 5.7, Guide-Modus 5.12), **Habit-Vorschläge** (→ Checkliste), **Reise** (→ 5.8). **Jede Ausgabe wird automatisch als verlinkte Notiz in der Wissensbasis (M11) abgelegt** — mit Quelle (Video + Zeitstempel).

### Flow B — Wiederfinden
1. Suche-Tab → Query in einfachen Worten (5.9).
2. Lokale Vektorsuche über Transkript-Chunks, Analysen, Notizen und Konzepte; Treffer = Video, Notiz oder Konzept — jeweils mit Snippet + Zeitstempel.
3. Tap → Video-Detail (Player springt zur Stelle) bzw. Notiz-/Konzept-Detail (5.14); Video wird damit Teil der eigenen History (falls noch nicht getrackt).

### Flow C — Abos ausmisten
1. Bibliothek → 💤-Hinweis oder Mehr → Hygiene (5.10).
2. Vorschläge nach Regeln (90 Tage keine Views, Sehquote < 10 %), Nutzer wählt per Checkbox.
3. Beim ersten Unsubscribe: erklärender Dialog → zusätzlicher OAuth-Scope `youtube.force-ssl` → Batch-Unsubscribe via API → lokale Aktualisierung.

### Flow D — Nachbauen mit Guide-Modus (Persona B)
1. Video-Detail → „Anleitung" → Guide-Übersicht (5.7): Material prüfen/abhaken, Schritte überblicken.
2. „Guide-Modus starten" (5.12): Vollbild-Schrittkarten; Handy liegt in der Werkstatt/Küche.
3. Pro Schritt: lesen oder vorlesen lassen (TTS, On-Device), bei Unklarheit „Im Video ansehen" (Sprung zum Zeitstempel, danach zurück zum Schritt).
4. Fortschritt wird gespeichert — unterbrechen und später am selben Schritt weitermachen; Abschluss aktualisiert die verlinkte Guide-Notiz.

### Flow E — Vom Video zum verlinkten Wissen (M11)
1. Wissen-Tab (5.13) → Konzept-Chip „Tiefschlaf" → Konzept-Seite (5.14) mit allen Quellen über Videos hinweg.
2. Backlinks-Panel zeigt, wo das Konzept sonst auftaucht (Summaries, Flashcards, andere Konzepte).
3. „In Graph ansehen" (5.15): Nachbar-Konzepte entdecken („Koffein", „Morgenlicht") → Tap → deren Seite; Wiki-Link-Edit im Editor ergänzt eigene Verknüpfungen.

---

## 7. Barrierefreiheit & Localization

- Dynamic Type/Textskalierung bis 130 % ohne Layout-Bruch; Kontraste ≥ WCAG AA (alle Text-/Hintergrund-Paare in §2.1 geprüft: `#F2F4F7` auf `#0F1115` = 16,1:1; `#9AA3B2` auf `#0F1115` = 7,4:1; Amber `#F59E0B` nur für Grafiken/Aktionen mit `accent/on-primary`-Text).
- Screenreader-Labels für TriageBadge („Bewertung 4 von 5"), Fortschrittsbalken (Prozent), SRS-Buttons; StepCard liest Schritt + Position („Schritt 4 von 9") automatisch vor; GraphView hat eine alternative Listen-Darstellung der Verknüpfungen.
- Guide-Modus: extra große Touch-Targets (≥ 64 pt) und `Step`-Schriftgröße für Bedienung mit eingeschränkter Feinmotorik (Handschuhe, dreckige Hände).
- TV: vollständige Fokus-Navigation, keine Touch-Gesten nötig; Reduced-Motion-Variante (Flip → Fade).
- Sprachen: Deutsch + Englisch UI (i18n von Tag 1); KI-Prompts sprachadaptiv (Summary in UI-Sprache, Quellen im Original); TTS folgt der Sprache der Notiz.
