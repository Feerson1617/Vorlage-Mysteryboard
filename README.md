# MysteryBoard · technischer Funktionsprototyp

Eigenständige, deutschsprachige Arbeitsfläche für Karten und Verbindungen. Ohne Backend, Benutzerkonten, externe Laufzeitressourcen oder automatische Browserspeicherung. React + TypeScript + Vite; eigene SVG-/Pointer-Steuerung, separater Canvas-Export.

Die Unterrichtsversion für den 13. November 2026 bleibt unter dem festen Tag `unterricht-2026-11-13-rc1` auf Commit `240d5fcfcac7e5924efe169493c9f7525ba5ed74` erhalten. Dieser Branch `feat/mysteryboard-print-pdf` entwickelt die universelle Druckfunktion unabhängig davon weiter. Seine HTMLs ersetzen die eingefrorenen Unterrichtsdateien nicht. [Unterrichtsdatei und vorbereiteter Pages-Weg](docs/UNTERRICHT-2026-11-13.md).

[Abnahmebericht A–F](docs/PHASEN-A-F-ABNAHME.md): Änderungen, Prüfungen, Artefaktprüfsummen und noch offene Praxistests.

## Direkt ausprobieren

- `artifacts/MysteryBoard-klein.html`: 12 Karten, 9 Verbindungen, 2 Testdiagramme.
- `artifacts/MysteryBoard-umfangreich.html`: 60 Karten, 90 Verbindungen, 8 Testdiagramme.
- `artifacts/MysteryBoard-Boden-Klasse11.html`: 18 geprüfte Karten, Inhaltsversion 2.0.0, zwölf Pflichtkarten und sechs Vertiefungen V13–V18.

Alle Varianten verwenden denselben Anwendungskern. [Neues Mystery mit der Vorlage erstellen](docs/NEUES-MYSTERY.md) beschreibt Inhaltsdatei und Build-Konfiguration. Eine Teambezeichnung oder Vornamen sind beim Beginn einer neuen Arbeit und vor jedem Schülerexport erforderlich. Eine neutrale Gruppenbezeichnung genügt; sie ist im Menü änderbar und Bestandteil der PNG-/QR-Sicherung. Teamlose Altsicherungen bleiben importierbar und bearbeitbar; vor einem neuen Export wird die Teamangabe nachgefragt. Im PNG steht der Titel links und die Teamangabe rechts oben.

Die HTML-Dateien enthalten Programm, Inhaltsdaten, Bilder, Styles und QR-Bibliotheken. Sie können von einem statischen Host ausgeliefert werden; die Anwendung benötigt danach keine Netzwerkverbindung. Lokales Öffnen hängt vom Browser bzw. der Geräteverwaltung ab. iPad-Dateivorschau ist kein vollständiger Webbrowser. Kamera benötigt einen sicheren Kontext und eine passende Einbettungsfreigabe.

**Arbeitsstand sichern:** „Sichern“ → Original-PNG herunterladen → unverändert in „Dateien“ aufbewahren. In einer neuen Sitzung „Fortsetzen“ → Originaldatei auswählen. Große Arbeitsstände benötigen die Originaldatei; nur ausreichend kleine bekommen zusätzlich einen vollständigen QR-Code. Screenshots und Bildoptimierungen können die eingebetteten Daten entfernen.

**Druckfassung:** Im Menü „Druckfassung / PDF“ öffnen, A4 oder A3 quer wählen, fertige Vorschau prüfen und bewusst „Drucken / PDF speichern“ betätigen. Die Ausgabe enthält eine Übersicht, lesbare Karten und vollständige Beziehungen mit Seitenverweisen. Sie verändert den Arbeitsstand nicht und ersetzt keine PNG-Sicherung. [Aufbau, Bedienung und Grenzen](docs/DRUCKFASSUNG.md).

## Entwicklung

Node.js 24 und npm 11 wurden verwendet. Die Unterrichtsversion und die neue Druckentwicklung liegen auf getrennten Branches desselben Repositories. Separate Worktrees halten ihre Tests und Artefakte auseinander; kein zweites Repository ist erforderlich.

```sh
npm ci --cache /tmp/mysteryboard-npm
npm run dev
# Umfangreicher Testdatensatz im Entwicklungsmodus:
npm run dev -- --mode large
npm test
npm run build
npm run test:e2e
```

`npm run check` führt die drei Prüfungen zusammen aus. Die Browserprüfung baut zusätzlich die getrennte 220-Verbindungen-Prüffassung aus den gelieferten QA-Daten (`npm run build:review`); sie gehört nicht zu den Schülerpaketen. Browserprüfungen benötigen Python 3 und Chromium; `CHROMIUM_PATH` kann den Browserpfad überschreiben (Standard `/usr/bin/chromium`). Die Testserver auf 5173/5174 werden durch Playwright gestartet und beendet. Der statische Server dient nur der Prüfung des unveränderten HTML-Artefakts. Auf anderen Systemen den npm-Cachepfad bei Bedarf weglassen.

Der Build erstellt alle Produktionsvarianten aus `mysteries.json` und prüft die harte Grenze **< 10.000.000 Bytes**. Er scheitert bei Überschreitung. Die zusätzliche Zielgröße liegt bei < 6 MB. `npm run build -- boden-klasse11` baut eine ausgewählte Variante. Der zusätzliche Prüfdatensatz `reuse-example` mit fünf Karten und Vertiefungen Z2/Z5 wird von `npm run test:e2e` mitgebaut; einzeln ist er über `npm run build:example` verfügbar.

## Struktur

| Pfad                        | Zweck                                                         |
| --------------------------- | ------------------------------------------------------------- |
| `src/content/*.json`        | Getrennte Mystery-Inhalte einschließlich Startanordnung und Gruppenmetadaten |
| `mysteries.json`            | Inhaltsauswahl und Ausgabename je eigenständiger HTML        |
| `src/core/model.ts`         | Inhalts- und Zustandsmodell, vollständige Importvalidierung   |
| `src/core/codec.ts`         | Versioniertes, komprimiertes Speicherformat und QR-Grenze     |
| `src/core/png.ts`           | PNG-Chunk-Parser, CRC-Prüfung, Einbetten und Wiederherstellen |
| `src/core/layout.ts`        | Gemeinsame Karten- und Verbindungsgeometrie                   |
| `src/core/export.ts`        | Eigenständiger, zoomunabhängiger Canvas-Renderer              |
| `src/core/print.ts`         | Universelle, lokal paginierte HTML-/SVG-Druckfassung          |
| `src/components/Board.tsx`  | SVG-Ansicht und Pointer-Gesten                                |
| `src/components/Camera.tsx` | Lokale Kameraerkennung mit sauberem Stream-Abbau              |
| `src/App.tsx`               | Sitzungszustand, Rückgängig, kontextbezogene Dialoge          |
| `tests/`                    | Datenintegrität und Browserprüfungen                          |

Neue Inhalte werden als JSON beschrieben und in `mysteries.json` registriert; im Schülerbereich gibt es keine Plattform oder Mystery-Auswahl. Weitere Mysterys benötigen keine Änderung des Anwendungskerns. Änderungen an Kartentexten, IDs oder Bildern müssen eine neue Inhaltsversion erhalten. IDs sind fortlaufende Ganzzahlen ab 1. Pflicht-/Vertiefungsgruppen und Nummernpräfixe werden ausdrücklich über Inhaltsmetadaten zugeordnet. Bilder müssen eingebettete Daten-URIs sein. Keine Daten aus fremden URLs laden.

Die Kartennummer dient ausschließlich als Wiedererkennung. Kartenreihenfolge im Zustand ist zugleich Zeichenreihenfolge; Ziehen hebt eine Karte nach vorn. Rückgängig und Wiederholen teilen sich eine auf 40 Schritte begrenzte Historie im Arbeitsspeicher. Eine neue Bearbeitung verwirft die Wiederholen-Schritte; Laden eines Arbeitsstands setzt beide Historien zurück. Die Ansicht selbst ist kein Bestandteil des gespeicherten fachlichen Arbeitsstands; nach dem Import wird die Übersicht eingestellt.

## Grenzen und weitere Dokumente

- [Eingefrorene Unterrichtsversion und einfacher Pages-Veröffentlichungsweg](docs/UNTERRICHT-2026-11-13.md)
- [Druckfassung/PDF: Bedienung und technische Grenzen](docs/DRUCKFASSUNG.md)
- [Nächste Funktionen: Bildvergrößerung, QR-Bildimport und SCORM-Bewertung](docs/NAECHSTE-FUNKTIONEN.md)
- [Release-Kandidat: Herkunft, Sicherung und aktuelle Prüfungen](docs/RELEASE-KANDIDAT.md)
- [Manuellen HTTPS-/GitHub-Pages-Weg vorbereiten](docs/PAGES.md)
- [Gezielte Work-Kompatibilitätsprüfung für WebKit](docs/WORK-KOMPATIBILITAET.md)
- [Speicherformat und technische Grenzen](docs/FORMAT.md)
- [Aktueller Prüfbericht: verbindliche Teamzuordnung und kompakte Kopfzeile](docs/UNI-01-02-ABNAHME.md)
- [Vorheriger Prüfbericht: universelle Vorlage und Boden 2.0.0](docs/UNIVERSELLE-VORLAGE-ABNAHME.md)
- [Neues Mystery mit der Vorlage erstellen](docs/NEUES-MYSTERY.md)
- [Unterrichtserprobung Boden-Mystery](docs/UNTERRICHTSERPROBUNG.md)
- [Frühere Zweitkorrektur ab 2518a53](docs/KORREKTUR-2518a53.md)
- [Erster Nachbesserungsbericht zu f02b411](docs/NACHBESSERUNG.md)
- [Ursprünglicher Testbericht zu f02b411](docs/TESTBERICHT.md)
- [Testanleitung für Schul-iPad und Canva Code](docs/PRAXISTEST.md)
- [Empfehlung für Auftrag 2](docs/AUFTRAG-2.md)

Dies ist ein technischer Prototyp. Eine reale Schul-iPad-/Canva-Abnahme wurde nicht durchgeführt. Es gibt keine SCORM-Implementierung; eine spätere Verpackung darf keine Teamangaben, Antworten oder Arbeitsstände über die Lernplattform speichern.
