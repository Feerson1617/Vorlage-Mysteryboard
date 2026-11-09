# MysteryBoard · technischer Funktionsprototyp

Eigenständige, deutschsprachige Arbeitsfläche für Karten und Verbindungen. Ohne Backend, Benutzerkonten, externe Laufzeitressourcen oder automatische Browserspeicherung. React + TypeScript + Vite; eigene SVG-/Pointer-Steuerung, separater Canvas-Export.

## Direkt ausprobieren

- `artifacts/MysteryBoard-klein.html`: 12 Karten, 9 Verbindungen, 2 Testdiagramme.
- `artifacts/MysteryBoard-umfangreich.html`: 60 Karten, 90 Verbindungen, 8 Testdiagramme.

Die HTML-Dateien enthalten Programm, Inhaltsdaten, Bilder, Styles und QR-Bibliotheken. Sie können von einem statischen Host ausgeliefert werden; die Anwendung benötigt danach keine Netzwerkverbindung. Lokales Öffnen hängt vom Browser bzw. der Geräteverwaltung ab. iPad-Dateivorschau ist kein vollständiger Webbrowser. Kamera benötigt einen sicheren Kontext und eine passende Einbettungsfreigabe.

**Arbeitsstand sichern:** „Sichern“ → Original-PNG herunterladen → unverändert in „Dateien“ aufbewahren. In einer neuen Sitzung „Fortsetzen“ → Originaldatei auswählen. Große Arbeitsstände benötigen die Originaldatei; nur ausreichend kleine bekommen zusätzlich einen vollständigen QR-Code. Screenshots und Bildoptimierungen können die eingebetteten Daten entfernen.

## Entwicklung

Node.js 24 und npm 11 wurden verwendet. Im vorhandenen Checkout arbeiten; für Cloud-Aufgaben ist kein weiterer Worktree nötig.

```sh
npm ci --cache /tmp/mysteryboard-npm
npm run dev
# Umfangreicher Testdatensatz im Entwicklungsmodus:
npm run dev -- --mode large
npm test
npm run build
npm run test:e2e
```

`npm run check` führt die drei Prüfungen zusammen aus. Browserprüfungen benötigen Python 3 und Chromium; `CHROMIUM_PATH` kann den Browserpfad überschreiben (Standard `/usr/bin/chromium`). Die Testserver auf 5173/5174 werden durch Playwright gestartet und beendet. Der statische Server dient nur der Prüfung des unveränderten HTML-Artefakts. Auf anderen Systemen den npm-Cachepfad bei Bedarf weglassen.

Der Build erstellt beide Varianten und prüft die harte Grenze **< 10.000.000 Bytes**. Er scheitert bei Überschreitung. Die zusätzliche Zielgröße liegt bei < 6 MB.

## Struktur

| Pfad                        | Zweck                                                         |
| --------------------------- | ------------------------------------------------------------- |
| `src/content/*.json`        | Getrennte Test-Mysterys einschließlich Startanordnung         |
| `src/core/model.ts`         | Inhalts- und Zustandsmodell, vollständige Importvalidierung   |
| `src/core/codec.ts`         | Versioniertes, komprimiertes Speicherformat und QR-Grenze     |
| `src/core/png.ts`           | PNG-Chunk-Parser, CRC-Prüfung, Einbetten und Wiederherstellen |
| `src/core/layout.ts`        | Gemeinsame Karten- und Verbindungsgeometrie                   |
| `src/core/export.ts`        | Eigenständiger, zoomunabhängiger Canvas-Renderer              |
| `src/components/Board.tsx`  | SVG-Ansicht und Pointer-Gesten                                |
| `src/components/Camera.tsx` | Lokale Kameraerkennung mit sauberem Stream-Abbau              |
| `src/App.tsx`               | Sitzungszustand, Rückgängig, kontextbezogene Dialoge          |
| `tests/`                    | Datenintegrität und Browserprüfungen                          |

Neue Inhalte werden als JSON beschrieben. Im Prototyp bezeichnet `small`/`large` die Build-Auswahl; im Schülerbereich gibt es keine Plattform oder Mystery-Auswahl. Ein Datensatz kann ohne Änderung des Anwendungskerns ersetzt werden. Änderungen an Kartentexten, IDs oder Bildern müssen eine neue Inhaltsversion erhalten. IDs sind fortlaufende Ganzzahlen ab 1. Bilder müssen eingebettete Daten-URIs sein. Keine Daten aus fremden URLs laden.

Die Kartennummer dient ausschließlich als Wiedererkennung. Kartenreihenfolge im Zustand ist zugleich Zeichenreihenfolge; Ziehen hebt eine Karte nach vorn. Rückgängig hält höchstens 40 Änderungen im Arbeitsspeicher. Die Ansicht selbst ist kein Bestandteil des gespeicherten fachlichen Arbeitsstands; nach dem Import wird die Übersicht eingestellt.

## Grenzen und weitere Dokumente

- [Speicherformat und technische Grenzen](docs/FORMAT.md)
- [Tatsächlich ausgeführte Tests und offene Praxisabnahme](docs/TESTBERICHT.md)
- [Testanleitung für Schul-iPad und Canva Code](docs/PRAXISTEST.md)
- [Empfehlung für Auftrag 2](docs/AUFTRAG-2.md)

Dies ist ein technischer Prototyp. Eine reale Schul-iPad-/Canva-Abnahme wurde nicht durchgeführt. Es gibt keine SCORM-Implementierung; ein späterer Adapter kann validierte `Work`-Daten übernehmen, ohne Inhaltsdaten oder Board-Steuerung zu verändern.
