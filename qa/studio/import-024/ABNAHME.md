# Dokumentimport in MysteryBoard Studio 0.2.4

Die Referenz für 0.2.3 ist Commit `03e7d6ddb85313634e32f5194b35fc116628e913`. Die Prüfdateien sind neutrale Eigenkonstruktionen, ergänzt durch die bereits vorhandenen neutralen OCR- und Fehlerbeispiele. Die drei Seiten der privaten Original-PDF sind durch ihren SHA-256-Wert und separat festgelegte Rechtecke in PDF-Punkten identifiziert. In der öffentlichen Ablage stehen dazu ausschließlich Koordinaten und Messergebnisse.

## Befunde und Grenzen

| Bereich | Ursache in 0.2.3 und Verhalten in 0.2.4 |
|---|---|
| PDF-Bild mit Text | Der frühere Import übernahm einen visuellen Rahmen nur bei leerer Textebene. Studio rendert räumlich getrennte Fotos einzeln und bewahrt Text und Quelle editierbar. Bei Vektorgrafik, überdruckten Beschriftungen, aneinanderstoßenden Kacheln oder mehr als vier Bildern rendert es den vollständigen Rahmen. Die darin sichtbare Transkription wird für diesen Bereich aus der Schülerkarte entfernt. |
| PDF-Grafiktypen | Der Worker folgt den PDF.js-Transformationen für Formulare, Inline-Bilder, Bildgruppen, Spiegelung und wiederholte Masken. PDF.js rendert den tatsächlichen sichtbaren Ausschnitt mit Masken und Clipping. Die Erkennung verwendet umschließende Rechtecke, weshalb schräg beschnittene oder überlappende Objekte eine manuelle Auswahl benötigen können. Transparenz, Kacheln und die drei Vierteldrehungen sind in P06/P07 enthalten. |
| Rahmen und Tabellen | Der bestehende Rasteralgorithmus erkennt achsenparallele Linien und schmale gefüllte Streifen. Die äußerste erkannte Kartenfläche schützt verschachtelte Tabellen. Abstände, versetzte Überschriften oder unvollständige und abgerundete Rahmen liefern Vorschläge. Eine Strichzeichnung allein beweist keine Kartengrenze. Die Originalvorschau, die gestrichelten Grafikmarkierungen, manuelle Bereiche und Bildübernahme dienen der Kontrolle. |
| Wissenschaftliche Beschriftungen | Diagramm, Tabelle und zugehörige Beschriftungen können als ein Originalbild erhalten werden. Der unabhängige Vergleich kontrolliert das Seitenverhältnis und Farbabweichungen in neun Teilflächen je neutralem Bild. Semantische Tabellenzellen, mathematische Notation, hochgestellte Zeichen und handschriftliche Einträge benötigen den Abgleich mit der Originalansicht. |
| Scan und OCR | Der bestehende lokale OCR-Pfad bleibt für fotografierte und gescannte Seiten zuständig. Ein seitenfüllendes Bild mit bereits vorhandener Textebene wird zur Kontrolle markiert. Lokale OCR-Vorschläge benötigen Einzelbestätigung. Als Titelblatt zurückgestellte Seiten starten keine automatische OCR. Die Vergleichstests verwenden u. a. Fotos mit schwachem Kontrast, Schräglage, Schatten und Unschärfe. Die Prüfergebnisse entsprechen keiner Garantie für einzelne Zahlen oder Handschriften. |
| Word | Vor Mammoth prüft der begrenzte ZIP-/XML-Pfad Objektarten und externe Medienbeziehungen. Das Studio nennt beispielsweise Textfeld, Diagramm, SmartArt, Kopf-/Fußzeile oder verbundene Tabellenzellen und bietet den lokalen PDF-Weg an. Die echte Word-Paginierung ist in der Absatzansicht unbekannt. In P13 und P14 entstanden die Ersatz-PDFs durch LibreOffice aus genau den neutralen DOCX-Dateien. Beide gedruckten Seiten werden tatsächlich als Bildkarten gespeichert und im SCORM verglichen. Ein Ausdruck muss in der Ursprungsanwendung selbst vollständig aussehen. |
| Schutzgrenzen | 20 MB Eingabe, 40 PDF-Seiten, 100 Karten, 12 MB bzw. 24 Megapixel für die Projektmedien bleiben wirksam. Laufzeit und Grafikaufwand sind begrenzt. Überlange oder unlesbare Eingaben, aktive Inhalte und Passwortschutz lösen eine begründete Ablehnung aus. Bei fehlenden Bildressourcen ist ein kleinerer Ausschnitt oder eine lokal verkleinerte/flache PDF praktikabel. |
| Originalvergleich | Bei möglichen Mehrspalten-, Tabellen- oder Seitenfortsetzungen muss die Lehrkraft Zugehörigkeit und Reihenfolge kontrollieren. Ungefähr rechteckige Bildgrenzen, Schriftumrisse, komplexe Word-Gruppierung, teilweise außerhalb der Seite liegende Inhalte und stark verdeckte Fotos haben keine allgemeine automatische Vollständigkeitsgarantie. Ein Originalausschnitt kann ausschließlich das im Original sichtbare Material erhalten. |

## Unabhängige Prüfungen

- `fixtures.py` legt Inhalte, Sollzahlen und Referenzbereiche vor dem App-Lauf fest. `matrix.mjs` prüft den tatsächlich gebauten Studio-Renderer. `roundtrip.mjs` speichert und öffnet jedes akzeptierte neutrale Projekt und vergleicht alle freigegebenen Daten mit dem Inhalt der erzeugten SCORM-1.2-ZIP.
- `limits.mjs` importiert negative Dateien bei bereits vorhandener Karte. Danach überprüft es erneut deren Text. Der Test kontrolliert zusätzlich die Warnung für eine unsichere Scan-Textebene und die Netzwerkzugriffe.
- `compare-neutral.py` verwendet PyMuPDF und Pillow als zweite Rendering-Implementierung. Die Referenz stammt aus den vorgegebenen PDF-Koordinaten.
- `inspect-original.mjs` vergleicht die in der Anwendung angezeigten Karten auf allen drei Seiten mit 9, 12 und 11 festgelegten Rechtecken. `verify-original.py` kontrolliert separat die komplette Textfolge aller 31 Textbereiche nach Normalisierung von Weißraum/Ligaturen, die Abmessungen und sechs Bildteilflächen von M2.
- Die beiden komplexen neutralen Fälle sowie P01 durchlaufen den Lehrer- und Schülerablauf in `editor-023.mjs`. P04 und P05 erfordern zusätzlich die manuelle Zuordnung der außenstehenden Grafik. Die Tests kontrollieren tatsächliche SCORM-ZIP und Schüler-PNG, eine neue Sitzung, Farben, Texte, Positionen und die Trennung interner und freigegebener Pfeile.
- `windows.mjs` protokolliert BrowserWindow-Fenster und -Inhalt, Quartz-Display, nutzbare Arbeitsfläche, CSS-Viewport, DPR, Pinnwand, Schaltflächen und die IHDR-Pixelmaße jedes Screenshots. Vergleiche verwenden identische Ist-Größen. Ein Ziel außerhalb der verfügbaren Arbeitsfläche bleibt als offen ausgewiesen.

## Nachstellen

Voraussetzungen sind die im Lockfile festgelegten Node-Pakete sowie PyMuPDF, Pillow, ReportLab und python-docx. Beispielbefehle im Repository:

```sh
npm ci
npm test
npm run build
npm run studio:build
npm run test:e2e
npm run test:rc2
python3 qa/studio/import-024/fixtures.py /tmp/mb-fixtures
node qa/studio/import-024/matrix.mjs /tmp/mb-fixtures /tmp/mb-matrix
python3 qa/studio/import-024/compare-neutral.py /tmp/mb-fixtures /tmp/mb-matrix
node qa/studio/import-024/limits.mjs /tmp/mb-fixtures /tmp/mb-matrix
```

Für P01 benötigt der Workflow das Repository-Actions-Secret `STUDIO_QA_PDF_URL` mit einer befristeten privaten HTTPS-Downloadadresse für die unveränderte PDF. Die Adresse muss die PDF direkt liefern und zwei Abrufe im selben Lauf erlauben. Der Linux-Vorabjob prüft Download und SHA-256 vor dem Start von Build und Regression. Der Mac-Runner lädt die PDF separat in sein temporäres Verzeichnis, prüft ihre SHA-256 erneut und setzt `STUDIO_EXEC` auf das ausführbare Programm der aus der DMG kopierten App. Er löscht das private Verzeichnis nach dem P01-Test. Die zwei JSON-Nachweise enthalten ausschließlich Prüfdaten und entstehen erst nach dem bestandenen Programmablauf und dem unabhängigen Originalvergleich. Die Paketierung erfordert beide Nachweise und prüft vor dem Upload die ZIP-Integrität und die SHA-256-Werte. Die genauen Befehle für Apple Silicon, die beiden Browserengines und die Regression stehen in [.github/workflows/studio-macos-024.yml](../../../.github/workflows/studio-macos-024.yml).
