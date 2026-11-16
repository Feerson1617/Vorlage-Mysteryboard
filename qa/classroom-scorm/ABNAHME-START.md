# Abnahmepaket prüfen

Dieses Abnahmepaket ist **keine SCORM-Ressource**. Es enthält die folgenden getrennten Dateien für den Unterricht beziehungsweise die technische Prüfung:

- **MysteryBoard-Universal.html:** Blankovorlage mit Editor und reduziertem Start.
- **MysteryBoard-Universal-SCORM-1.2.zip:** dieselbe Blankovorlage im LMS, geeignet zum Testen des Editors.
- **MysteryBoard-Zwoelf-Beobachtungen-SCORM-1.2.zip:** automatisch startende, im Browser erzeugte Aufgabe mit zwölf neutralen Karten.
- **MysteryBoard-Fuenf-Spuren-SCORM-1.2.zip:** zweite, getrennte Aufgabe mit fünf neutralen Karten.

Die jeweilige **einzelne SCORM-ZIP unentpackt** in itslearning importieren. Das große Abnahmepaket dient der unabhängigen Prüfung und enthält zusätzlich Quellprojekt, Testdateien, echte Schüler-PNGs, Screenshots, Protokolle und SHA-256-Listen. Beide Unterrichtsbeispiele verwenden dieselbe Programmlogik und enthalten keine vertraulichen Musterlösungen.

## Bereits gelieferte Dateien unabhängig prüfen

Im entpackten Abnahmepaket:

```sh
python3 projekt/qa/classroom-scorm/verify-delivery.py . testdateien
```

Dieser Prüfer benötigt nur Python 3, keine Anwendungsmodule und kein Netzwerk. Er kontrolliert ZIP-CRC, Manifest, lokale Ressourcen, identischen Player, getrennte Aufgaben und sämtliche vollständigen PNG-/Projekt-/Wiederherstellungsvergleiche für beide Aufgaben bei vier Bildschirmgrößen.

Für neue Screenshots **der tatsächlich gelieferten HTML-Bytes**, ohne Neubau:

```sh
cd projekt
npm ci
npx playwright install chromium
export CHROMIUM_PATH="$(node --input-type=module -e 'import {chromium} from "@playwright/test"; console.log(chromium.executablePath())')"
node qa/classroom-scorm/screenshots.mjs ..
```

Die Bildschirmprüfung verwendet einen lokalen temporären Server und schaltet den Browser danach offline. Sie prüft die drei Startaktionen, den direkten Lehrerimport und die Erreichbarkeit der SCORM-Schaltfläche bei 1024 × 768, 768 × 1024, 600 × 800 und 320 × 700 CSS-Pixeln. Vorhandene Screenshots werden im entpackten Prüfverzeichnis neu geschrieben.

## Gesamte Quellregression reproduzieren

Im Verzeichnis `projekt`, nach der obigen Installation:

```sh
CLASSROOM_SCORM=1 \
CLASSROOM_EXPORT_DIR=dist/browser-downloads \
AUTHORING_EXAMPLES_DIR=dist/browser-downloads \
PRINT_EXAMPLES_DIR=dist/browser-downloads \
INTEGRATION_EXAMPLES_DIR=dist/browser-downloads \
  npm run check
npm run test:rc2
```

Hier werden Anwendung und Prüffassungen aus dem mitgelieferten Quellcode neu gebaut. Die eingefrorenen RC2-Dateien sind für deren Schutzprüfung separat unverändert enthalten. Systemvoraussetzungen: Node 24, Python 3, Chromium und passende Hostbibliotheken; für die bestehenden PDF-/XML-Prüfungen außerdem Poppler (`pdfinfo`, `pdftotext`) und Python `lxml`. Alle Werkzeuge sind kostenlos. Die ausführlichen tatsächlichen Befehle und Ergebnisse der Cloud-Prüfung stehen in `pruefprotokolle/`.

Der tatsächliche itslearning-Import sowie Safari und verwaltete Schul-iPads bleiben offen. Die mitgelieferten Ergebnisse sind keine schulische Gerätefreigabe. `VERSION.json` nennt den Quellcommit, `SHA256SUMS.txt` und `PRUEFSUMMEN.json` sichern die unveränderten Einträge des Abnahmepakets ab.
