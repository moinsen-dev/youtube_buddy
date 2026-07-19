# AGENT-TOOLING.md — YouTube Buddy

**Stand:** 2026-07-19 (verifiziert an diesem Datum, siehe §8)
**Zweck:** Inventar und Betriebsanleitung aller Werkzeuge für vollautonome, AI-getriebene Entwicklung mit **kimi-code** (YOLO-Mode, ohne menschliche Interaktion). Ergänzt `AGENTS.md`; ändert nichts an PRD/DESIGN/ARCHITECTURE/ROADMAP.

Quellen: [Expo: AI agents](https://docs.expo.dev/agents/) · [Expo Skills](https://docs.expo.dev/skills/) · [Expo MCP Server](https://docs.expo.dev/mcp/) · [agent-device](https://docs.expo.dev/agents/agent-device/) · [Kimi Code: MCP](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/mcp.html) · [Kimi Code: Migration](https://www.kimi.com/code/docs/en/kimi-code-cli/guides/migration.html)

---

## 1. Zielbild

kimi-code soll jede Roadmap-Phase (0–12) autonom umsetzen: Code schreiben, App auf iOS/Android/Web starten, UI per Screenshot/Tap verifizieren, Tests laufen lassen (Jest, Maestro), Builds via EAS anstoßen und auswerten, Doku pflegen. Menschliche Interaktion nur noch bei den Punkten in §5 (einmalig) und §6 (freigabepflichtige Aktionen).

## 2. Status-Inventar (verifiziert)

### 2.1 Skills — User-Scope `~/.agents/skills/`

- **22 Expo-Skills installiert** (16 `expo-*`, 6 `eas-*`), Quelle `expo/skills`, Format: native `SKILL.md` mit Frontmatter — von kimi-code auto-discovery kompatibel.
  - Framework: `expo-app-clip`, `expo-brownfield`, `expo-data-fetching`, `expo-dev-client`, `expo-dom`, `expo-examples`, `expo-module`, `expo-native-ui`, `expo-project-structure`, `expo-router`, `expo-skill-eval`, `expo-skill-feedback`, `expo-tailwind-setup`, `expo-ui`, `expo-upgrade`, `expo-web-to-native`
  - EAS (Paid Plan): `eas-app-stores`, `eas-hosting`, `eas-observe`, `eas-simulator`, `eas-update-insights`, `eas-workflows`
- Installiert via: `npx -y skills add expo/skills -g -s '*' -y --copy`
- Update-Mechanismus: `npx -y skills update -g -y`
- **Regel:** Vor jeder Expo-/EAS-Aufgabe den passenden Skill lesen (z. B. `expo-router` vor Navigation, `expo-upgrade` bei SDK-Wechsel, `eas-workflows` für CI).

### 2.2 MCP-Server — `~/.kimi-code/mcp.json` (aktive Config, siehe §4)

| Server | Transport | Status | Zweck für YT Buddy |
|---|---|---|---|
| `expo` | stdio via `mcp-remote`-Bridge → `https://mcp.expo.dev/mcp` | ✅ **aktiv & authentifiziert** (nativer HTTP-Eintrag hängt in 0.27.0 — §4, §8) | Expo-Docs live, SDK-kompatible Paket-Installation, EAS Builds/Workflows/Logs, TestFlight-/Store-Daten, lokale UI-Automatisierung |
| `chrome-devtools` | stdio (`npx chrome-devtools-mcp`) | ✅ aktiv | Web-Plattform verifizieren (Snapshots, Console, Network, Lighthouse) |
| `patrol` | stdio (`dart run patrol_mcp`) | ✅ aktiv | Flutter-Test-Framework (andere Projekte) — für YT Buddy (RN/Expo) **nicht primär**; stattdessen Maestro |
| `marionette` | stdio (Wrapper-Skript) | ✗ broken (`marionette_mcp` nicht installierbar) | iOS-Sim-Automatisierung; obsolet, sobald Expo-MCP lokal läuft |
| `gdai-mcp` | stdio (`uv`, Godot-Plugin) | ✗ nicht aktiv | Godot-Projekt, für YT Buddy irrelevant |

Hinweis: Die Legacy-Datei `~/.kimi/mcp.json` (alte Python-Linie, siehe §4) enthält dieselben Server plus `expo`; sie wird vom aktuellen kimi-code nicht mehr gelesen und bleibt unangetastet.

### 2.3 CLIs und native Toolchains

| Tool | Version/Stand | Zweck |
|---|---|---|
| node / npm | v22.22.0 / 11.18.0 | Laufzeit (erfüllt Anforderungen: agent-device ≥ 22.12, kimi-npm ≥ 22.19) |
| yarn / pnpm / bun | ✅ | alternative Paketmanager |
| git / gh | ✅, authentifiziert als `udiedrichsen` (Scopes: repo, workflow, read:org, gist) | Repo-Operationen, PRs |
| eas-cli | 21.0.1, eingeloggt als **`moinsen_uli`** (Paid Plan) | Builds, Submit, Workflows, Update, Simulator |
| maestro | 2.6.0 | E2E-UI-Tests (Roadmap-Konvention) |
| Xcode | 26.6; Sims u. a. iPhone 17 Pro (booted), 17 Pro Max, 17e, Air | iOS-Builds/-Runs |
| Android SDK | adb ✅, AVD `Pixel_9a` | Android-Builds/-Runs |
| openjdk | 17.0.19 | Android-Builds |
| CocoaPods | 1.17.0 | iOS-Abhängigkeiten |
| jq | ✅ | JSON-Verarbeitung in Skripten |
| expo-cli (global) | — bewusst nicht installiert | veraltet; immer `npx expo` (projektlokal) nutzen |
| watchman | ✗ fehlt, **optional** | schnelleres File-Watching; `brew install watchman` |
| fastlane | ✗ fehlt, **nicht nötig** | wird durch EAS Submit ersetzt |

## 3. Expo MCP Server — Detail

- **Typ:** Streamable HTTP · **URL:** `https://mcp.expo.dev/mcp` · **Auth:** OAuth (Personal Access Token empfohlen). Expo-Account erforderlich (vorhanden: `moinsen_uli`, Paid Plan).
- Endpoint-Check (2026-07-19): antwortet `401` + `WWW-Authenticate: Bearer` ohne Token — d. h. Server erreichbar, Auth zwingend.

**Server-Capabilities** (ohne lokalen Dev-Server verfügbar):
- Doku/Lernen: `read_documentation`, `search_documentation` (⚠️ erfordert **EAS Paid Plan** — vorhanden), `learn`
- Pakete: `add_library` (installiert SDK-kompatible Versionen via `npx expo install`)
- EAS Workflows: `workflow_create`, `workflow_validate`, `workflow_list`, `workflow_info`, `workflow_logs`, `workflow_run`, `workflow_cancel`
- EAS Builds: `build_list`, `build_info`, `build_logs`, `build_run`, `build_cancel`, `build_submit`
- Stores: `testflight_crashes`, `testflight_feedback`, `appstore_reviews`, `appstore_reply_review`, `appstore_delete_review_response`, `playstore_crashes`, `playstore_reviews`, `playstore_reply_review`

**Lokale Capabilities** (ab SDK 54, nur mit laufendem Dev-Server): `automation_tap`, `automation_take_screenshot`, `automation_find_view`, `collect_app_logs`, `open_devtools`, `expo_router_sitemap`. Setup im Projekt (ab Phase 0):

```sh
npx expo install expo-mcp --dev
npx expo whoami || npx expo login
EXPO_UNSTABLE_MCP_SERVER=1 npx expo start
```

Nach jedem Start/Stop des Dev-Servers muss die MCP-Verbindung im Agenten neu aufgebaut werden.

**Limitationen:** nur ein Dev-Server gleichzeitig; lokale iOS-Capabilities nur Simulator (keine physischen Geräte) und nur macOS.

**Datenschutz:** Expo trainiert keine Modelle mit MCP-Daten; der MCP-Server betreibt selbst kein Modell. Screenshots/Logs laufen als Proxy über Expo-Server zum lokalen MCP-Client. Während MCP-Sessions keine echten Nutzerdaten in der App verwenden.

## 4. kimi-code — zwei Produktlinien, Installation, MCP-Config

**Wichtig: Es gibt zwei Produktlinien mit unabhängigen Versionsnummern — nicht verwechseln.**

| | Legacy: `kimi-cli` (Python) | Aktuell: `kimi-code` (Node.js) |
|---|---|---|
| Quelle | PyPI `kimi-cli` (z. Z. 1.49.0) | npm `@moonshot-ai/kimi-code` / Homebrew `kimi-code` (z. Z. **0.27.0**) |
| Daten-Verzeichnis | `~/.kimi/` | `~/.kimi-code/` (oder `$KIMI_CODE_HOME`, hier nicht gesetzt) |
| Status | wird schrittweise abgekündigt | **aktiv genutzt** |

- **0.27.0 ist der aktuelle Stand der neuen Linie** — `kimi upgrade` meldet „up to date" korrekt. Die höheren 1.4x-Nummern gehören der Legacy-Python-Linie; ein „Upgrade auf 1.x" existiert nicht und ist nicht nötig.
- **Migration ist bereits erfolgt** (2026-07-17, Beleg: `~/.kimi-code/migration-report.json`): Config, MCP-Server und Sessions wurden von `~/.kimi/` nach `~/.kimi-code/` übernommen. Die Alt-Daten bleiben unverändert, die alte Linie stört nicht. Nachinstallieren/Updaten: `brew upgrade kimi-code` (installiert ist die Homebrew-Variante `/opt/homebrew/bin/kimi`).
- **MCP-Config:** User-Level `~/.kimi-code/mcp.json` (projekt-Level möglich: `<repo>/.mcp.json` bzw. `.kimi-code/mcp.json`; stdio-Einträge dort starten Befehle beim Session-Start → nur in vertrauenswürdigen Repos).
- **Expo MCP läuft über eine stdio-Bridge — nicht über den nativen `url`-Eintrag.** Befund (2026-07-19, Session-Logs): Der native HTTP-Transport von kimi 0.27.0 erkennt den Server korrekt (`needs-auth`), der OAuth-Flow speichert valide Tokens (`~/.kimi-code/credentials/mcp/`), aber jeder Connect **mit** gespeichertem Token hängt bis zum 30-s-Timeout (`status=failed reason="Timed out after 30000ms"`). Token und Server sind einwandfrei (direkter `curl initialize` mit dem Token → HTTP 200). Workaround und Dauerlösung:
  ```json
  "expo": { "command": "npx", "args": ["-y", "mcp-remote", "https://mcp.expo.dev/mcp"] }
  ```
  `mcp-remote` führt seinen eigenen OAuth-Flow (einmalig Browser) durch und cached die Tokens mit Refresh unter `~/.mcp-auth/`. Danach verbindet sich die Bridge bei jedem Session-Start selbstständig. Der native `url`-Eintrag kann nach einem kimi-Fix erneut getestet werden (§8).
- **MCP-Server laden beim Session-Start:** nach jeder Änderung an `mcp.json` neue Session starten (`/new` oder kimi neu starten).
- Im YOLO-Mode (`kimi -y`) werden MCP-Calls automatisch genehmigt — deshalb nur vertrauenswürdige Server eintragen und die Freigabeliste in §6 beachten.

## 5. Einmalige manuelle Schritte (Checkliste)

1. ~~Expo MCP authentifizieren~~ — **erledigt (2026-07-19):** OAuth über die `mcp-remote`-Bridge (Browser-Flow), Tokens in `~/.mcp-auth/` gecacht; End-to-end verifiziert (`search_documentation`, `read_documentation`). Falls die Tokens einmal verfallen/gelöscht werden: `npx -y mcp-remote https://mcp.expo.dev/mcp` ausführen und im Browser bestätigen.
2. Optional: `brew install watchman`.
3. **Phase 0, im Projekt:** `eas init` (Projekt linken → `extra.eas.projectId` in `app.json`), `npx expo install expo-mcp --dev`, Dev-Server künftig mit `EXPO_UNSTABLE_MCP_SERVER=1 npx expo start`.
4. **Privacy-Härtung (erledigt):** chrome-devtools-MCP läuft mit `--no-usage-statistics` (in `~/.kimi-code/mcp.json` gesetzt). Für Maestro bei Bedarf `MAESTRO_CLI_NO_ANALYTICS=1` in der Shell setzen. Expo-Skills-Telemetrie ist opt-in (Default: aus) — nicht aktivieren.

## 6. Autonomie-Regeln (YOLO-Betrieb)

- **Ohne Rückfrage erlaubt:** Code/Tests/Lint, lokale Builds und Simulatoren, `npx expo install`, Maestro-Flows, EAS-Builds/Workflows **lesen und starten** (`build_run`, `workflow_run`), Doku-Pflege.
- **Nur mit ausdrücklicher Freigabe** (outward-facing oder kostenrelevant): Store-Submits (`eas submit`, `build_submit`), öffentliche Review-Antworten (`appstore_reply_review`, `playstore_reply_review`), EAS Update auf `production`-Channel, Git-Mutationen (bestehende Regel in AGENTS.md).
- **Quota-/Kosten-Disziplin:** YouTube-API weiterhin mit `quota_log` (PRD); EAS-Builds verbrauchen Build-Minuten des Plans — sparsam triggern, Logs vor erneutem Build lesen.
- **Local-only-Abgrenzung:** Die Netzwerk-Whitelist in PRD §7 gilt für die **App-Runtime**. `mcp.expo.dev`, `api.expo.dev` und EAS-Endpunkte sind reine **Build-Time-Tooling**-Endpunkte und kein App-Netzwerkverkehr — die Whitelist bleibt unverändert.

## 7. Verifikations-Loop pro Phase (autonom)

1. `npm run lint` + `npm test` (Jest, core > 80 %).
2. App bauen/starten: iOS-Sim (iPhone 17 Pro), Android-Emulator (Pixel_9a), Web (`npx expo start --web`).
3. UI-Verifikation: Maestro-Flows (Kern-Flows) und/oder Expo-MCP `automation_*` (Screenshots, Taps per testID); Web zusätzlich via chrome-devtools-MCP (Snapshot, Console, Lighthouse).
4. Design-Token-Check gegen DESIGN.md §2; Exit-Kriterien der Phase in STATE.md abhaken.

## 8. Verifikationsprotokoll dieser Inventur (2026-07-19)

- Tool-Pfade/Versionen per `command -v` + `--version` geprüft (§2.3).
- `eas whoami` → `moinsen_uli` (eingeloggt); `gh auth status` → `udiedrichsen` aktiv.
- Expo-Skills: nach Installation 22 Verzeichnisse mit `SKILL.md` in `~/.agents/skills/` verifiziert (Frontmatter-Format geprüft).
- Versionen gegengeprüft: npm `@moonshot-ai/kimi-code` = **0.27.0** (= installierte Homebrew-Version, aktuellste der neuen Linie); PyPI `kimi-cli` = 1.49.0 (Legacy-Linie). `~/.kimi/latest_version.txt` (1.47.0) stammt vom Legacy-Client und ist kein Upgrade-Hinweis.
- Expo-MCP-Eintrag zunächst **irrtümlich in der Legacy-Datei** `~/.kimi/mcp.json` ergänzt → in frischen Sessions `TOOL_MISSING`. Nach Korrektur in `~/.kimi-code/mcp.json`: Server wird erkannt, frische Sessions exponieren `mcp__expo__authenticate` (Status `needs-auth`).
- `curl`-Probe auf `https://mcp.expo.dev/mcp` → `401 invalid_token` ohne Auth (OAuth-Pflicht bestätigt).
- **OAuth-Login (nativer Flow) erfolgreich:** Tokens unter `~/.kimi-code/credentials/mcp/` (access + refresh, `expires_in: 3600`, Scope `mcp:access`). Token direkt per `curl initialize` geprüft → HTTP 200, `serverInfo: Expo MCP Server 1.0.0`.
- **Client-Bug bestätigt:** Mit gespeichertem Token schlägt der native HTTP-Connect von kimi 0.27.0 in drei Sessions fehl (`status=failed reason="Timed out after 30000ms"`, Session-Logs), Discovery-Endpunkte antworten per curl in <50 ms → Problem liegt im kimi-HTTP-Transport, nicht bei Token/Server/Netz.
- **Lösung Bridge:** `expo`-Eintrag als stdio (`npx -y mcp-remote https://mcp.expo.dev/mcp`); OAuth-Flow der Bridge öffnete automatisch den Browser, Bestätigung, Tokens gecacht in `~/.mcp-auth/`. Danach: Session-Log ohne expo-Fehler (verbunden), `mcp__expo__search_documentation` liefert Ergebnisse (**Paid-Plan-Feature funktioniert**), `mcp__expo__read_documentation` liefert Seiteninhalt — End-to-end verifiziert.
- Bei zukünftigen kimi-Versionen: nativen `url`-Eintrag erneut testen (Eintrag in `~/.kimi-code/mcp.json` tauschen, neue Session, Session-Log auf `expo … status=failed` prüfen).
- kimi-Logs (`~/.kimi-code/logs/` bzw. Legacy `~/.kimi/logs/`): `chrome-devtools` + `patrol` verbinden; `marionette` schlägt fehl (`marionette_mcp` fehlt); `gdai-mcp` wird nicht gestartet.

## 9. Optionale Ergänzungen (bei Bedarf)

- **agent-device** (Callstack, MIT): agent-native CLI für Geräte-Kontrolle, RN-Komponenten-Inspektion, Profiling, Maestro-Interoperabilität, Geräte-Clouds. Setup: `npm i -g agent-device@latest` + `npx skills add callstack/agent-device`. Sinnvoll, sobald reale Geräte/Profiling anstehen (frühestens Phase 4+).
- **Argent** (Software Mansion): MCP-basiertes Toolkit für Simulator-Kontrolle/Debugging — Alternative zu obigem.
- **EAS Workflows (CI/CD):** `.eas/workflows/*.yml` mit Maestro-Job (Paid Plan) — relevant ab der Phase, in der PR-Tests automatisiert werden; Skill `eas-workflows` liegt bereit.
- **eas-simulator** (Paid, experimentell): Cloud-Simulatoren inkl. Browser-Streaming — Fallback, falls lokale Sims einmal nicht verfügbar sind; Skill `eas-simulator` liegt bereit.
