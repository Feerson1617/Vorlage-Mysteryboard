# MysteryBoard – reduzierte Startseite

16. November 2026. Basis: `e7f50a03a8cb63168cde78ff01ab0d1e9ea9d460` aus `feat/mysteryboard-document-import-integrity`. Neuer Branch: `feat/mysteryboard-minimal-start`.

## Änderung

Die universelle Startseite zeigt nur noch **MysteryBoard**, eine kurze Handlungsaufforderung und die Schüleraktionen **Aufgabe öffnen** / **Arbeit fortsetzen**. Darunter steht der kleinere, zurückhaltende Textbutton **Lehrkräfteeditor**. Die Gestaltung verwendet die vorhandene zentrierte Schülerfläche, Farben und Arial-Typografie. Es gibt keine Dekosymbole, Animationen oder zusätzlichen Informationsboxen. Die langen Lehrer-, Kartennummern- und Speichertexte sind von dieser Startseite entfernt.

Produktionsänderungen ausschließlich in `src/UniversalApp.tsx` und `src/style.css`: Die beiden Schülerbuttons rufen dieselbe bestehende Funktion `openImport` auf. Der gemeinsame Dialog heißt nun neutral **Datei öffnen**. Der Lehrerzugang ruft das vorhandene `openAuthor(true)` auf; **Vorhandenes Mystery öffnen** verwendet ebenfalls den bestehenden Import. Neue Entwürfe, vorhandene Aufgaben/Entwürfe, Word/PDF, Hilfen und Exporte behalten ihre vorhandenen Funktionen. Hinweise und Warnungen in Bearbeitung und Sicherungsdialogen bleiben bestehen.

Anwendungskern, `App.tsx`, Karten/Board, Touch/Pinch, Autoreneditor, Dokumentimport, Hilfesystem, Datenformate, PNG/QR, History und Druckcode wurden nicht verändert. In der SCORM-ZIP bleiben `imsmanifest.xml`, `launch.html` und `session.js` bytegleich zur Basis; nur die gemeinsame aktuelle `app.html` wird neu verpackt. Die eingefrorenen Boden-RC2-Dateien bleiben unverändert.

## Prüfung

Acht zusätzliche Chromium-Browsertests prüfen die tatsächlichen Produktionsdateien: jeweils **HTML und echte SCORM-Einbettung** bei **1024 × 768, 768 × 1024, 600 × 800 und 320 × 700 CSS-Pixeln**, mit Touch. Geprüft sind alle drei Wege:

1. Eine neutrale Aufgaben-Datei öffnen, Team eingeben, Karten verschieben, Pinch und Verbindung bearbeiten.
2. Eine wirkliche Schüler-PNG herunterladen, zur Startseite zurückkehren, sie über **Arbeit fortsetzen** importieren, den vollständigen Inhalt/Arbeitsstand vergleichen und weiterarbeiten.
3. **Lehrkräfteeditor** öffnen, ein leeres Mystery mit einer eigenen Karte erstellen, eine echte Schülerversion exportieren und zur Startseite zurückkehren. Anschließend diese bestehende Aufgabe über den Lehrerzugang öffnen und wieder im vorhandenen Editor bearbeiten.

Zusätzlich: Abbruch des Importdialogs und des Lehrerzugangs, genau drei Startbuttons und ein kurzer Absatz, mindestens 44 × 44 Pixel große Touchflächen, optisch nachgeordneter Lehrerbutton unter den Schüleraktionen, kein Überlaufen des Bildschirms. Die Screenshots der acht Starts wurden tatsächlich erzeugt; Querformat, Hochformat und die schmalste Ansicht wurden visuell geprüft; die iPad-Ansichten sind unter `screenshots/` enthalten.

Die vorhandenen Tests bleiben erhalten. Anpassungen an deren Einstiegshilfen betreffen die neuen Buttonnamen und den neuen Importdialogtitel. Vier Papierproben erwarteten außerdem ausdrücklich den jetzt zu entfernenden langen KI-Absatz. Diese Layout-Erwartung prüft nun dessen Abwesenheit, zusätzlich die exakte kurze Aufforderung und alle drei Startaktionen. Ihre vollständigen Daten-/Export-/Wiederherstellungsprüfungen bleiben erhalten. Der erste Gesamtlauf mit der alten Texterwartung und die anschließenden Prüfungen sind getrennt dokumentiert. Anzahl der bisherigen Tests und Assertions bleibt erhalten; kein Test wurde übersprungen oder abgeschwächt. Die eigenständigen QA-Skripte und kurzen Bedienanleitungen wurden an die Navigation angepasst; der alte Benchmark-Referenzstand behält ausdrücklich seinen alten Selektor.

```sh
AUTHORING_EXAMPLES_DIR=/tmp/mysteryboard-start-downloads \
  npx playwright test tests/browser/minimal-start.spec.ts
CLASSROOM_SCORM=1 \
  AUTHORING_EXAMPLES_DIR=/tmp/mysteryboard-start-regression \
  PRINT_EXAMPLES_DIR=/tmp/mysteryboard-start-print \
  INTEGRATION_EXAMPLES_DIR=/tmp/mysteryboard-start-integration \
  npm run check
npx playwright test tests/browser/release-candidate.spec.ts
npm run test:rc2
python3 scripts/validate-scorm.py \
  artifacts/MysteryBoard-Universal-SCORM-1.2.zip \
  artifacts/MysteryBoard-Universal.html MysteryBoard-Universal-v3
```

Die Ausgabeordner können frei gewählt werden. `npm run check` umfasst sämtliche Daten-, TypeScript-/Build- und Browserprüfungen. Vollständige aktuelle Ausgaben, Schutzvergleich und Testzählung liegen unter `docs/test-evidence/minimal-start/`. **Ergebnis:** 130 Datentests, alle 201 Chromium-Browserfälle und vier eingefrorene RC2-Tests erfolgreich ausgeführt. Im ersten Gesamtlauf bestanden 197 Browserfälle; vier Papierproben stoppten am ausdrücklich entfernten KI-Text. Nach Anpassung dieser Layout-Erwartung wurden alle vier vollständigen Papierabläufe erneut erfolgreich ausgeführt. Die Produktionsdateien blieben zwischen diesen Läufen unverändert. Die acht neuen Startseitentests bestehen zusätzlich im gezielten Lauf und im Gesamtlauf. Ergebniszahlen und Dateiprüfsummen stehen in `ERGEBNIS.json` der Lieferung.

## Lieferung und Grenzen

Die Lieferung enthält aktuelle Universal-HTML, SCORM-1.2-ZIP, Quer-/Hochformat-Screenshots sowie diesen Bericht und Prüfsummen. Die SCORM-ZIP wird **unentpackt als SCORM 1.2** in itslearning importiert; die Startseite enthält kein fest vorgegebenes Mystery. Beide Dateien entstehen aus demselben aktuellen Anwendungskern.

Die Bildschirmprüfung erfolgte mit Chromium und Touch-Unterstützung in CSS-Pixeln; sie ist keine Prüfung auf einem echten iPad. Ein realer Safari-/Schul-iPad-/itslearning-Test und die native Safari-Druckabnahme bleiben offen. Keine schulische Freigabe, kein Merge in `main`, keine Änderung bestehender Release-Tags und kein Pages-/Release-Deployment.
