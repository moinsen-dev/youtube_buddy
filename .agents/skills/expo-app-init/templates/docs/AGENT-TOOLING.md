# AGENT-TOOLING — {{PROJECT_NAME}}

> Inventar und Betriebsanleitung der Agent-Werkzeuge. Nach jeder Änderung an MCPs/Skills/CLIs hier aktualisieren und mit Datum versehen. **Stand:** <YYYY-MM-DD>

## 1. Zielbild

< was der Agent autonom tun soll: Code schreiben, App starten, UI verifizieren, Builds anstoßen, Doku pflegen >

## 2. Status-Inventar (verifiziert am <Datum>)

### 2.1 Skills (User-Scope `~/.agents/skills/`)

- Offizielle Expo/EAS-Skills: `npx -y skills add expo/skills -g -s '*' -y --copy` (Update: `npx -y skills update -g -y`)
- Stack-Skills: `npx skills add moinsen-dev/moinsen-expo-stacks -g -s 'expo-*'`
- **Regel:** Vor jeder Expo-/EAS-Aufgabe den passenden Skill lesen.

### 2.2 MCP-Server (projektlokal: `.mcp.json`)

| Server | Zweck |
| ------ | ----- |
| `expo` (via mcp-remote-Bridge) | Expo-Docs live, SDK-kompatible Paket-Installation, EAS Builds/Workflows/Logs, Store-Daten |
| `chrome-devtools` | Web-Plattform verifizieren (Snapshots, Console, Network, Lighthouse) |

Setup & Troubleshooting: Skill `expo-mcp-setup`.

### 2.3 CLIs und native Toolchains

| Tool | Zweck |
| ---- | ----- |
| node ≥ 22, npm | Laufzeit |
| eas-cli (eingeloggt) | Builds, Submit, Workflows |
| maestro | E2E-UI-Tests |
| Xcode + Simulatoren, Android SDK + AVD, Java 17, CocoaPods | Builds/Runs |
| gh | Repo-Operationen |

Check: `<repo>/scripts/doctor.sh expo-app` (aus moinsen-expo-stacks).

## 3. Einmalige manuelle Schritte

1. Expo-MCP-OAuth über die mcp-remote-Bridge bestätigen (Browser-Flow, Tokens in `~/.mcp-auth/`).
2. `eas init` (Projekt linken → `extra.eas.projectId` in `app.json`), `npx expo install expo-mcp --dev`.
3. Dev-Server künftig: `EXPO_UNSTABLE_MCP_SERVER=1 npx expo start`.

## 4. Autonomie-Regeln (YOLO-Betrieb)

Siehe Skill `eas-autonomy`. Kurzfassung: erlaubt ohne Rückfrage sind Code/Tests/Lint, lokale Builds/Simulatoren, `npx expo install`, EAS-Builds/Workflows lesen+starten. Freigabepflichtig: Store-Submits, öffentliche Review-Antworten, EAS Update auf `production`, Git-Mutationen.

## 5. Verifikations-Loop pro Phase

1. `npm run lint` + `npm test` (+ `npx tsc --noEmit`).
2. App bauen/starten: iOS-Sim, Android-Emulator, Web.
3. UI-Verifikation: Maestro-Flows und/oder Expo-MCP `automation_*`; Web via chrome-devtools-MCP.
4. Design-Token-Check gegen DESIGN.md §2; Exit-Kriterien in STATE.md abhaken.

## 6. Verifikationsprotokoll dieser Inventur

< Datum, was geprüft wurde, Ergebnisse — Vorbild: youtube_buddy/docs/AGENT-TOOLING.md §8 >
