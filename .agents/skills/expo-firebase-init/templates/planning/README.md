# planning/

Eine **selbst-contained Task-Datei** pro Umsetzungs-Task. Der Agent liest genau eine
Task-Datei und kann daraus arbeiten, ohne den Rest des Projekts zu kennen.

Konventionen:

- Dateiname: `task-NN-<kurztitel>.md`, Nummerierung strikt aufsteigend.
- Ein Task ist fertig, wenn seine **Exit-Kriterien** erfüllt und in `STATE.md` vermerkt sind.
- Kein Task N+1 vor Abschluss von Task N (Abhängigkeiten im Header).
- Template: `task-00-template.md` kopieren.
