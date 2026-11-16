# Touch-Steuerung und eindeutige PNG-Sicherung prüfen

`MysteryBoard-Universal-SCORM-1.2.zip` ist die universelle Blankovorlage für itslearning. `MysteryBoard-Unterrichtsbeispiel-SCORM-1.2.zip` startet eine neutrale Aufgabe unmittelbar mit der Teamabfrage. Diese Einzel-ZIPs unentpackt als SCORM-Ressource importieren. Das große Abnahmepaket selbst ist keine SCORM-Ressource.

Die Universal-HTML kann unabhängig vom LMS verwendet werden. Es wird nichts automatisch gespeichert; die vorbereitete PNG muss bewusst heruntergeladen und unverändert aufbewahrt werden. Schülernamen, Spielstände, Antworten und Bewertungen werden nicht an das LMS übertragen.

## Mitgelieferte Nachweise

- `VERSION.json`: tatsächlicher Quellcommit; `SHA256SUMS.txt` und `PRUEFSUMMEN.json`: Datei- und Eintragsprüfsummen.
- `TOUCH-UND-PNG-PRUEFBERICHT.md`: Ursachen, Änderungen, Befehle, vollständige Ergebnisse und Grenzen.
- `pruefprotokolle/`: Gesamtlauf, Baseline-Reproduktion, Pointer-Ereignisse und Positionsmessungen in vier Größen. Die Baseline-Reproduktion zeigt die zwei erwarteten Fehler des unveränderten Vorgängerstands.
- `browserdownloads/`: echte PNGs und Screenshots aus den drei vollständigen 1024er-Browserkreisläufen, unabhängig ausgelesene MBX3-Daten und Integritätsnachweise aller vier Größen. Die wiederholten hochauflösenden PNGs der weiteren Größen sind nicht nochmals enthalten; ihre vollständigen Daten und tatsächlichen Dateiprüfsummen sind protokolliert.
- `projekt/`: vollständiger Quellcode mit Tests und eigenen neutralen PDF-/Word-/Medienfixtures. Die eingefrorenen Boden-Dateien bleiben bytegleich. Keine hochgeladenen Original-PDFs oder daraus abgeleiteten Aufgaben werden hier veröffentlicht.

## Vorhandene Dateien unabhängig prüfen

Die Kontrolle verwendet Python 3 und dessen Standardbibliothek, keinen Anwendungscode oder Anwendungscodec:

```sh
python3 projekt/qa/touch-saving/verify-bundle.py .
python3 projekt/qa/touch-saving/verify-png.py \
  'Team Nordseeküste_Strömungen und Küsten – Übungsaufgabe.png' /tmp/mbx3.json
```

## Alle Tests erneut ausführen

```sh
cd projekt
npm ci
npx playwright install chromium
export CHROMIUM_PATH="$(node --input-type=module -e 'import {chromium} from "@playwright/test"; console.log(chromium.executablePath())')"
CLASSROOM_SCORM=1 \
TOUCH_EVIDENCE_DIR=dist/touch-saving \
PDF_REGION_DOWNLOADS=dist/regression-downloads \
AUTHORING_EXAMPLES_DIR=dist/regression-downloads \
CLASSROOM_EXPORT_DIR=dist/regression-downloads \
PRINT_EXAMPLES_DIR=dist/regression-downloads \
INTEGRATION_EXAMPLES_DIR=dist/regression-downloads \
  npm run check
npm run test:rc2
```

Nur die neuen Fälle: `npx playwright test tests/browser/touch-stability.spec.ts tests/browser/png-saving.spec.ts`. Node 24/npm 11, Chromium mit Systembibliotheken, Python 3, Poppler und `lxml` werden für die vollständige bestehende Suite benötigt. Die sichtbaren Pfeil-Rastervergleiche verwenden zusätzlich Pillow und PyMuPDF. ReportLab dient nur zur optionalen Neuerzeugung der mitgelieferten eigenen PDFs. Keine dieser Python-Bibliotheken ist eine Laufzeitabhängigkeit des Schülerplayers.

Chromium/CDP-Touch ist eine reproduzierbare Emulation. Es ist kein echter Schul-iPad-/Safari-/itslearning-Nachweis und keine Messung der Bildrate auf einem iPad. Native Teilen-/Dateien-Dialoge, Endungsbehandlung durch iPadOS und native Safari-Druckfunktion bleiben dort zu prüfen.
