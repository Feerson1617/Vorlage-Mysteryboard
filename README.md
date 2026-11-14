# MysteryBoard · technischer Funktionsprototyp

Eigenständige, deutschsprachige Arbeitsfläche für Karten und Verbindungen. Ohne Backend, Benutzerkonten, externe Laufzeitressourcen oder automatische Browserspeicherung. React + TypeScript + Vite; eigene SVG-/Pointer-Steuerung, separater Canvas-Export.

Auf `feat/mysteryboard-universal-authoring` liegt die neue universelle Autoren- und Unterrichtsvorlage auf Basis von `e14a09273be38c5501dc36ff3a7b819de298cd3a`. Eine Blanko-HTML bzw. ein einmal installiertes SCORM-Paket öffnet vollständige `.mysteryboard`-Aufgaben, Lehrkraft-Entwürfe und selbsttragende Schüler-PNGs. Editor und KI-Weg teilen ein Inhaltsmodell; veröffentlichte und künftig spezifisch gebaute Aufgaben bleiben bearbeitbar. Der bestehende Board-/Touchkern, History, Hilfe und mehrseitiger Druck werden weiterverwendet. Boden-RC2 einschließlich HTML, SCORM, fachlichen Karten und Tag bleibt unverändert.

**Einstieg:** [Anleitung für Lehrkräfte](LEHRKRAEFTE-ANLEITUNG.md) · [KI-Anleitung](AI-ANLEITUNG.md) · [vollständiges Format](docs/UNIVERSAL-FORMAT.md) · [aktueller Abnahmebericht](docs/UNIVERSAL-ABNAHME.md).

## Direkt ausprobieren

- `artifacts/MysteryBoard-Universal.html`: Blanko-Anwendung mit Lehrkräfteeditor und Dateiimport.
- `artifacts/MysteryBoard-Universal-SCORM-1.2.zip`: dieselbe Anwendung in der SCORM-1.2-Hülle, ohne fest vorgegebenes Fach-Mystery.
- `examples/universal/ki-beispiel.mysteryboard`: zwölf neutrale Karten mit drei eingebetteten Bildformaten und beiden Hilfestufen.
- `examples/universal/unterricht-*.mysteryboard` und `unterricht-schueler.png`: zusammengehörige, im tatsächlichen Browserablauf erzeugte Entwurfs-/Aufgaben-/Schülerdateien.

- `artifacts/tests/MysteryBoard-Vorlage-Medien.html`: zusätzlicher neutraler Druckprüfstand mit drei Bildformaten und langem Text.
- `artifacts/tests/MysteryBoard-Vorlage-Geordnet-5.html`: neutraler Funktionsnachweis mit Z-/V-Präfixen, eigenem Denkimpuls und optionaler Nummernorientierung.
- `artifacts/tests/MysteryBoard-Vorlage-Geordnet-12.html`, `…-18.html`, `…-60.html`: zusätzliche neutrale Mengenprüfungen mit allgemeiner methodischer Hilfe.
- `artifacts/MysteryBoard-klein.html`: 12 Karten, 9 Verbindungen, 2 Testdiagramme.
- `artifacts/MysteryBoard-umfangreich.html`: 60 Karten, 90 Verbindungen, 8 Testdiagramme.
- `artifacts/MysteryBoard-Boden-Klasse11.html`: 18 geprüfte Karten, Inhaltsversion 2.0.0, zwölf Pflichtkarten und sechs Vertiefungen V13–V18.
- `artifacts/MysteryBoard-Boden-Klasse11-RC2.html`: derselbe Boden-Build mit neutral durchmischter Startanordnung, eindeutig als RC2 bezeichnet.
- `artifacts/MysteryBoard-Boden-Klasse11-RC2-SCORM-1.2.zip`: unmittelbar importierbares SCORM-1.2-Paket für den itslearning-Praxistest; enthält die RC2-HTML byteidentisch. [Anleitung und Grenzen](docs/RC2-SCORM.md).

Alle neu gebauten Varianten verwenden denselben Anwendungskern. Die eingefrorenen Boden-Dateien enthalten weiterhin exakt den RC2-Kern. [Neues Mystery mit der Vorlage erstellen](docs/NEUES-MYSTERY.md) beschreibt Inhaltsdatei und Build-Konfiguration. Eine Teambezeichnung oder Vornamen sind beim Beginn einer neuen Arbeit und vor jedem Schülerexport erforderlich. Eine neutrale Gruppenbezeichnung genügt; sie ist im Menü änderbar und Bestandteil der PNG-/QR-Sicherung. Teamlose Altsicherungen bleiben importierbar und bearbeitbar; vor einem neuen Export wird die Teamangabe nachgefragt. Im PNG steht der Titel links und die Teamangabe rechts oben.

Die HTML-Dateien enthalten Programm, Inhaltsdaten, Bilder, Styles und QR-Bibliotheken. Sie können von einem statischen Host ausgeliefert werden; die Anwendung benötigt danach keine Netzwerkverbindung. Lokales Öffnen hängt vom Browser bzw. der Geräteverwaltung ab. iPad-Dateivorschau ist kein vollständiger Webbrowser. Kamera benötigt einen sicheren Kontext und eine passende Einbettungsfreigabe.

**Arbeitsstand sichern:** „Sichern“ → Original-PNG herunterladen → unverändert in „Dateien“ aufbewahren. In einer neuen Sitzung „Fortsetzen“ → Originaldatei auswählen. Große Arbeitsstände benötigen die Originaldatei; nur ausreichend kleine bekommen zusätzlich einen vollständigen QR-Code. Screenshots und Bildoptimierungen können die eingebetteten Daten entfernen.

## Entwicklung

Node.js 24 und npm 11 wurden verwendet. Im vorhandenen Checkout arbeiten; für Cloud-Aufgaben ist kein weiterer Worktree nötig.

```sh
npm ci
npx playwright install chromium
npm run dev
# Umfangreicher Testdatensatz im Entwicklungsmodus:
npm run dev -- --mode large
npm test
npm run build
CLASSROOM_SCORM=1 npm run test:e2e
npm run package:universal
npm run test:rc2
# Vollständigen Projektordner verpacken (neuer Ausgabepfad):
npm run package:project -- ausgabe/MysteryBoard-Universal-Projektvorlage.zip
```

`CLASSROOM_SCORM=1 npm run check` führt Datenprüfung, Produktionsbuild und gesamte Browserprüfung einschließlich des neuen SCORM-Unterrichtskreislaufs zusammen aus. Die Browserprüfung baut zusätzlich die getrennte 220-Verbindungen-Prüffassung aus den gelieferten QA-Daten (`npm run build:review`); sie gehört nicht zu den Schülerpaketen. Browserprüfungen benötigen Python 3, Chromium, `lxml` für die separate XML-Prüfung und für die tatsächliche PDF-Prüfung Poppler (`pdfinfo`, `pdftotext`; `pdftoppm` für Sichtprüfungen); `CHROMIUM_PATH` kann den Browserpfad überschreiben (vorhandener System-Chromium, sonst Playwright-Installation). Die Testserver auf 5173/5174 werden durch Playwright gestartet und beendet. Der statische Server dient nur der Prüfung des unveränderten HTML-Artefakts. Auf Linux müssen die zu Chromium passenden Systembibliotheken verfügbar sein. Für macOS lassen sich Python/Poppler mit den üblichen kostenlosen Paketwerkzeugen installieren. Pillow war nur zur Erzeugung der bereits mitgelieferten eigenen Prüfgrafiken nötig, nicht zur Nutzung oder zum normalen Build.

Der Build erstellt alle Produktionsvarianten aus `mysteries.json` und prüft die harte Grenze **< 10.000.000 Bytes**. Er scheitert bei Überschreitung. Die zusätzliche Zielgröße liegt bei < 6 MB. `npm run build -- boden-klasse11` baut eine ausgewählte Variante. Der zusätzliche Prüfdatensatz `reuse-example` mit fünf Karten und Vertiefungen Z2/Z5 wird von `npm run test:e2e` mitgebaut; einzeln ist er über `npm run build:example` verfügbar.

Die Boden-Variante ist auf diesem Branch als `previewOnly` konfiguriert: neue technische Vergleichsbuilds landen ausschließlich unter `artifacts/previews/`, niemals über den RC2-Dateien. Diese Vorschauen sind vom Git-Tracking ausgeschlossen und keine Unterrichtslieferung. `release:rc2` ist auf dem neuen Entwicklungsstand gesperrt. Für den neutralen Nachweis genügt `npm run build -- ordered-5`.

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
| `src/components/Board.tsx`  | SVG-Ansicht und Pointer-Gesten                                |
| `src/components/Camera.tsx` | Lokale Kameraerkennung mit sauberem Stream-Abbau              |
| `src/App.tsx`               | Sitzungszustand, Rückgängig, kontextbezogene Dialoge          |
| `tests/`                    | Datenintegrität und Browserprüfungen                          |

Neue portable Inhalte werden mit dem grafischen Editor oder dem dokumentierten `create:mystery`-/`build:mystery`-Weg erzeugt. Die bestehende Registry `mysteries.json` bleibt für bisherige feste Prüfausgaben erhalten. Weitere Mysterys benötigen keine Änderung des Anwendungskerns. Änderungen an Kartentexten, IDs oder Bildern müssen eine neue Inhaltsversion erhalten. IDs sind fortlaufende Ganzzahlen ab 1. Pflicht-/Vertiefungsgruppen und Nummernpräfixe werden ausdrücklich über Inhaltsmetadaten zugeordnet. Bilder müssen eingebettete Daten-URIs sein. Keine Daten aus fremden URLs laden.

Die Kartennummer dient ausschließlich als Wiedererkennung. Kartenreihenfolge im Zustand ist zugleich Zeichenreihenfolge; Ziehen hebt eine Karte nach vorn. Rückgängig und Wiederholen teilen sich eine auf 40 Schritte begrenzte Historie im Arbeitsspeicher. Eine neue Bearbeitung verwirft die Wiederholen-Schritte; Laden eines Arbeitsstands setzt beide Historien zurück. Die Ansicht selbst ist kein Bestandteil des gespeicherten fachlichen Arbeitsstands; nach dem Import wird die Übersicht eingestellt.

## Grenzen und weitere Dokumente

- [Aktuelle Universalprüfung: Autorenmodell, vollständige Dateien, SCORM, fortgesetzte Bearbeitbarkeit](docs/UNIVERSAL-ABNAHME.md)

- [Aktuelle Integrationsprüfung: Startablage, Hilfesystem und Druck/PDF](docs/PRINT-INTEGRATION-ABNAHME.md)

- [Vorheriger Vorlagen-Prüfbericht: geordnete Startablage und zweistufige Hilfe](docs/TEMPLATE-ORDERED-HELP-ABNAHME.md)
- [RC2-Abnahme: neutrale Anordnung und SCORM 1.2](docs/RC2-ABNAHME.md)
- [RC2: fachliche Voraussetzungen und unveränderte Karten](docs/RC2-FACHPRUEFUNG.md)
- [RC1-Release-Kandidat: Herkunft, Sicherung und damalige Prüfungen](docs/RELEASE-KANDIDAT.md)
- [Manuellen HTTPS-/GitHub-Pages-Weg vorbereiten](docs/PAGES.md)
- [Gezielte Work-Kompatibilitätsprüfung für WebKit](docs/WORK-KOMPATIBILITAET.md)
- [Speicherformat und technische Grenzen](docs/FORMAT.md)
- [Frühere Prüfung: verbindliche Teamzuordnung und kompakte Kopfzeile](docs/UNI-01-02-ABNAHME.md)
- [Vorheriger Prüfbericht: universelle Vorlage und Boden 2.0.0](docs/UNIVERSELLE-VORLAGE-ABNAHME.md)
- [Neues Mystery mit der Vorlage erstellen](docs/NEUES-MYSTERY.md)
- [Unterrichtserprobung Boden-Mystery](docs/UNTERRICHTSERPROBUNG.md)
- [Frühere Zweitkorrektur ab 2518a53](docs/KORREKTUR-2518a53.md)
- [Erster Nachbesserungsbericht zu f02b411](docs/NACHBESSERUNG.md)
- [Ursprünglicher Testbericht zu f02b411](docs/TESTBERICHT.md)
- [Testanleitung für Schul-iPad und Canva Code](docs/PRAXISTEST.md)
- [Empfehlung für Auftrag 2](docs/AUFTRAG-2.md)

Dies ist eine technische Prüflieferung. Eine reale itslearning-/Safari-/Schul-iPad-/Canva-Abnahme wurde nicht durchgeführt. Die SCORM-1.2-Hülle initialisiert und beendet nur die Sitzung, ohne Arbeitsstände, Teamnamen oder Leistungsdaten über die API zu lesen oder zu schreiben. RC1 bleibt unter `unterricht-2026-11-13-rc1` erhalten; RC2 bleibt unter `unterricht-2026-11-13-rc2` eingefroren. Die ursprünglichen Unterrichts- und Entwicklungsbranches bleiben unverändert; diese Erweiterung liegt ausschließlich auf `feat/mysteryboard-universal-authoring`.
