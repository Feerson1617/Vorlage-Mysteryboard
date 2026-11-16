# PDF-Karten und Pfeile unabhängig prüfen

Die einzelne **MysteryBoard-Universal-SCORM-1.2.zip** ist die Blankovorlage für den Editortest in itslearning. Die beiden neutralen Beispiel-SCORM-ZIPs starten je eine vorbereitete Aufgabe. Diese Einzel-ZIPs jeweils unentpackt importieren. Das große Abnahmepaket selbst ist keine SCORM-Ressource.

Dieses öffentliche Paket enthält ausschließlich eigene neutrale Vergleichs-PDFs und deren Ergebnisse. Die hochgeladenen Originale und daraus erzeugte Aufgaben liegen getrennt im privaten Originalpaket.

## Vorhandene Downloads prüfen

`VERSION.json` nennt den Quellcommit. `SHA256SUMS.txt` und `PRUEFSUMMEN.json` sichern die Einträge ab. Die Protokolle enthalten die tatsächlichen Testbefehle und Ergebnisse; `browserdownloads/` enthält echte Browserexports und Pfeilbilder beziehungsweise PDF-Ausgaben.

Die PNG-/ZIP-/JSON-Kontrolle benötigt nur Python 3. Die Originalfall-Datei beziehungsweise die entsprechende neutrale Falldatei enthält unabhängig geprüfte Überschriften/Kartentexte:

```sh
python3 projekt/qa/pdf-regions/verify-outputs.py \
  pruefprotokolle/neutral-cases.json browserdownloads MysteryBoard-Universal.html
```

## Quellregression neu ausführen

```sh
cd projekt
npm ci
npx playwright install chromium
export CHROMIUM_PATH="$(node --input-type=module -e 'import {chromium} from "@playwright/test"; console.log(chromium.executablePath())')"
CLASSROOM_SCORM=1 \
PDF_REGION_DOWNLOADS=dist/browser-downloads \
AUTHORING_EXAMPLES_DIR=dist/browser-downloads \
PRINT_EXAMPLES_DIR=dist/browser-downloads \
  npm run check
npm run test:rc2
```

Voraussetzungen für die vollständige bestehende Regression: Node 24, Python 3, Chromium und dessen Systembibliotheken, Poppler und Python `lxml`. Die zusätzlichen tatsächlichen Pfeil-Rastervergleiche verwenden die kostenlosen Python-Pakete **Pillow** und **PyMuPDF**. **ReportLab** wird nur zur optionalen Neuerzeugung der bereits mitgelieferten synthetischen PDFs benötigt, nicht zur Nutzung der Anwendung. Keine dieser Python-Bibliotheken wird im Schülerplayer benötigt.

PDF-Grenzen separat: `npx playwright test tests/browser/pdf-regions.spec.ts tests/browser/pdf-regions-manual.spec.ts`. Sichtbare Pfeile separat: `npx playwright test tests/browser/arrows-visible.spec.ts`.

## Eigene Originale prüfen

`qa/pdf-regions/inspect.mjs` lädt die tatsächliche Universal-HTML in einem echten Browser, importiert eine übergebene PDF, schreibt die erkannten Daten und fotografiert die Originalvorschau. Ergebnisse mit privaten Materialien außerhalb des Repositorys ablegen:

```sh
node qa/pdf-regions/inspect.mjs \
  artifacts/MysteryBoard-Universal.html PRIVATER-ERGEBNISORDNER ORIGINAL.pdf
```

Die vollständigen acht Originalabläufe verwenden dieselbe `pdf-regions.spec.ts` mit `PDF_REGION_CASES` auf eine private JSON-Datei. Deren Inhalt und Pfade liegen nur im privaten Originalpaket. Keine Original-PDF, kein Original-Screenshot und kein abgeleitetes Aufgabenpaket in ein öffentliches Repository kopieren.

Ein echter Safari-, Schul-iPad- und itslearning-Test einschließlich nativer Druckfunktion bleibt offen. Die Chromium- und simulierten LMS-Nachweise sind keine schulische Freigabe.
