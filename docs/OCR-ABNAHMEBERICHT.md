# MysteryBoard – lokale OCR: Fehler-, Prüf- und Abnahmebericht

Ausgangsstand: `9740c7120bd2c80d06bd158b7276f696c30b67d7`. Entwicklungsbranch:
`feat/mysteryboard-offline-ocr`. Die genaue Quellcommit-ID und alle Dateihashes
stehen zusätzlich im ausgelieferten `VERSION.json` und `MANIFEST.json`.

## Ergebnis des Abschlusslaufs vom 16. November 2026

**Die Cloud-Entwicklungsprüfung ist bestanden; die reale Schul-/LMS-Abnahme bleibt offen.**
Die Datenprüfung umfasst **165 Tests in 24 Dateien**, die vollständige
Chromium-Prüfung **272 Tests (37,4 Minuten)**. Dazu kommen **4 eingefrorene
RC2-Tests**, **5 WebKit-27.2-Tests**, **8 zusätzliche private Original-PDF-Tests**
und **ein weiterer OCR-Test mit beiden privaten 20-/16-Karten-Scans**.
TypeScript und Produktionsbuild liefen innerhalb von `npm run check` erfolgreich.
Kein Merge und keine Veröffentlichung der Anwendung.

| Ausgelieferte Datei | Bytes | SHA-256 |
| --- | ---: | --- |
| `MysteryBoard-Universal.html` | 5.681.723 | `65d62944d1f00237ef552436387533461b17cd832b0b5181fcfc540a634c6c51` |
| `MysteryBoard-Universal-SCORM-1.2.zip` | 2.806.608 | `c84e5a311c926c4e9458566145e68696bae7a9ebd9977eceeaba289f65350f26` |
| `MysteryBoard-OCR-Autorenpaket.zip` | 5.742.828 | `afbb5b5325c836c50ff353b170a9ea027e590e669f9cb0f9ee868fa37ecdbb0c` |
| `MysteryBoard-OCR-SCORM-1.2.zip` | 5.740.661 | `8ca117932e42792fd5c61c19c7c7be70b19f44487b57362525d99b9d0d3ebfe9` |
| Browserexportiertes Beispiel-SCORM ohne OCR | 2.807.792 | `5ea9fd70107f595cf72cd2fee20a6dc3ca14362f1ec024483a1ae37035aca3ee` |

Das deutsche komprimierte Modell umfasst 1.333.102 Bytes. Der abschließende
Machbarkeitslauf im tatsächlichen SCORM-iframe mit Chromium **156.0.8078.79**
benötigte **592 ms Startzeit und 4.495 ms Erkennung** für das neutrale Testbild.
Er lieferte deutsche Zeichen und Textrechtecke, keine externen Anfragen und null
verbleibende Worker nach Abschluss beziehungsweise Startabbruch.
Gemessener JavaScript-Heap: 36.937.460 Bytes benutzt / 45.006.928 bereitgestellt.
Die Summe der Prozess-RSS-Werte lag vor OCR bei 570.703.872 Bytes, am beobachteten
Maximum bei 689.033.216 und danach bei 597.487.616 Bytes. Diese Werte zählen
gegebenenfalls gemeinsame Speicherseiten mehrfach und sind keine garantierte
Obergrenze, keine reine OCR-/WASM-Messung und kein iPad-/M1-Leistungsnachweis.
Die Anwendung wird nicht als vollständig speicherfrei nach OCR ausgegeben;
der Browser kann freigegebene Speicherbereiche weiter reservieren.

Die Rohzeichenfehlerraten der neutralen Layoutscans betragen nach alleiniger
Leerraumnormalisierung **3,70 % (20 Karten)** und **2,72 % (16 Karten)**. Nur
19/20 beziehungsweise 13/16 Titel sind roh exakt; kein vollständiger neutraler
Kartentext stimmt vor Korrektur einschließlich aller Absätze und Satzzeichen
exakt überein. Die tatsächlich im Assistenten manuell korrigierten vier Foto-
und 16 Scankarten stimmen anschließend in Titel, Text und Quelle vollständig
mit dem unabhängigen Solltext überein. Erst danach folgen die zwei absichtlichen
Editoränderungen im Unterrichtsworkflow.

Private Originale: 20/20 und 16/16 Karten; anonyme Rohzeichenfehlerraten **0,067 %**
und **0,187 %**. Diese Werte gelten ausschließlich für diese beiden gerasterten
Originale und sind keine Zusage für fotografierte Seiten. Öffentliche Nachweise
enthalten nur Anzahlen, Eingabehashes und Kennzahlen; Originale und Volltexte
bleiben privat.

Die eingefrorene Boden-RC2-HTML bleibt bei SHA-256
`21dd6ad5c813ba5bd12ca521f03602a195ccea44ee70769119280e4ca088fd5f`,
ihre SCORM-ZIP bei
`42ac3d51e2e34431efe9b0ca9b0f4e84085d9b651e4fac6747d843bf6091c3a0`.
17 geschützte Dateien wurden byteweise gegen den Ausgangscommit geprüft.

## Umsetzung und Architektur

Es gibt weiterhin genau einen MysteryBoard-Anwendungskern. OCR erweitert den
bestehenden Dokumentimport und übernimmt nach ausdrücklicher Prüfung Karten in
sein bisheriges Format. DOCX, PDF-Textebene, Bereiche, Medien, Hilfen und
Veröffentlichung verwenden weiterhin dieselben Komponenten. Keine zusätzliche
Anwendung, keine zweite Veröffentlichungskette und kein neues Speicherformat.

Tesseract.js **7.0.0**, Core **7.0.0**, deutsches LSTM-Modell
`@tesseract.js-data/deu` **1.0.0**, Variante `4.0.0_best_int`. Verwendung der aktuellen
`createWorker('deu', 1, options)`-API, keine veralteten manuellen
Initialisierungsaufrufe. Der kompatible LSTM-Kern benötigt keine SIMD-/Thread-
oder SharedArrayBuffer-Freigabe. Englisch ist nicht separat enthalten.

Die Universal-Einzeldatei enthält keine OCR-Engine und kein Sprachmodell. Die
OCR-Autorenfassung und ihr universelles SCORM enthalten alle Ressourcen lokal.
Diese Trennung erhält die bestehende Grenze von **unter 10.000.000 Bytes je HTML**.
Schon die bisherigen etwa 5,6 MB plus Kern, Modell und deren Base64-Vergrößerung
wären für eine zusätzliche selbstständige OCR-Einzeldatei ungeeignet. Es gibt
keine versteckte Erhöhung der Grenze und kein Nachladen von CDNs.

Ein kurzlebiger, verborgener Kontext besitzt genau einen OCR-Worker. Abschluss,
Fehler und Abbruch entfernen ihn einschließlich seiner Worker, auch während des
Starts. Sprach-/Programmdateien werden ausschließlich aus dem Paket gelesen;
`cacheMethod: "none"` verhindert den Tesseract-IndexedDB-Cache. Keine Uploadinhalte
werden in localStorage, sessionStorage oder IndexedDB geschrieben. Die normalen
statischen Browsercaches enthalten gegebenenfalls Programmdateien, keine Uploads.

Das daraus exportierte Unterrichts-SCORM enthält weiterhin nur `app.html`,
`launch.html`, `session.js`, `imsmanifest.xml`: kein OCR-Modell, keinen OCR-Host
und keine zusätzlichen OCR-Workerdateien. Das besondere OCR-Metaelement wird
nicht in die Schülerfassung übernommen. Der vorhandene SCORM-Rahmen bleibt bei
Initialize/Finish; keine Antworten, Teamnamen, Zustände oder Bewertungen ans LMS.

## Karten- und Texterkennung

Bei Bildern werden zunächst lange dunkle Pixelstrecken gesucht und zu Rahmen
zusammengesetzt. PDF-Vektoren werden dabei nicht vorausgesetzt. OCR-Wortpositionen
und die bestehende räumliche Gliederung helfen bei fehlenden Rahmen. Danach wird
jede Karte einzeln aus ihrem Ausschnitt erkannt. Die Ganzseitenerkennung erhält
zusätzlich die nicht zugeordneten Texte für den Originalvergleich.

Die Lehrkraft kann Grenzen markieren, durch Prozentwerte verschieben und ändern,
teilen, zusammenführen, hinzufügen und entfernen. Nur betroffene Texte werden neu
gelesen. Andere Karten bleiben erhalten; geänderte Texte werden erst nach
Bestätigung ersetzt. Reihenfolge, Überschrift, Text, Quelle und Pflicht-/V-Gruppe
bleiben bearbeitbar. Unbearbeitetes Bild und vergrößerter echter Kartenausschnitt
bleiben zum Vergleich zugänglich. Keine OCR-Nachzeichnung wird als Original gezeigt.

Niedrige Wortwerte erscheinen mit **(?)** und sprachlichem Hinweis. Auch hohe
Werte garantieren keine Richtigkeit. Zahlen, Kommas, Einheiten, Eigennamen,
Quellen und Originalbezeichnungen müssen geprüft werden. J/I/| und O/0 können
verwechselt werden; es gibt keine automatische fachliche Ersatzvermutung. Jede
OCR-Karte benötigt eine eigene Bestätigung. Textänderungen heben diese auf.
Leere Ergebnisse lassen sich nicht als erfolgreich geprüft übernehmen.

Übernahme ist eine bewusste Aktion. Vorher bleiben vorhandener Entwurf und seine
Änderungskennzeichnung unverändert. Abbruch und Fehler ersetzen keine Entwurfsdaten.
Die bewusste Entwurfs-/PNG-Sicherung bleibt erforderlich; keine automatische Speicherung.

## Nachgewiesene Fehler und Korrekturen

- PDF.js ließ zuvor eingebettete Scanbilder über vier Millionen Pixeln weg. Die
  Seite erschien leer. Der begrenzte Scan-Eingang erlaubt nun bis 24 Millionen
  Pixel; Vorschau und einzelne OCR-Arbeitsbilder bleiben begrenzt. PDF-Karten
  werden zusätzlich einzeln höher aufgelöst gerendert. Das verbessert kleine
  Schrift, ohne eine komplette hochaufgelöste Seite dauerhaft vorzuhalten.
- Dicke Rahmen konnten im leeren sechsten Originalfeld als Inhalt zählen.
  Rahmenpixel werden jetzt vor der Inhaltsprüfung aus den Schriftkandidaten
  entfernt. Die privaten Rasteroriginale werden mit 20 und 16 Karten geprüft.
- Getrennte, drei Pixel breite Rahmen erzeugten bei der WebKit-Rasterung doppelte
  Bereiche. Ein unabhängiger Pixeltest reproduzierte **8 statt 4** Regionen.
  Die Streckenzusammenfassung vergleicht nun auch benachbarte Striche anderer
  Spalten. Derselbe Test prüft anschließend vier überschneidungsfreie Regionen.
- Der automatische Seitenwechsel gilt für OCR-Karten. Die bisherigen schnellen
  PDF-Texte behalten ihren Arbeitsablauf beim Teilen per Textcursor; der
  bestehende Regressionstest deckt diese zunächst gefundene Nebenwirkung ab.
- Beim PDF-Beschnitt wurden PDF-Punkte zunächst wie Rasterpixel behandelt.
  Die Markierung wird jetzt über die tatsächliche Bildgröße umgerechnet.
  Der neue Test reproduzierte **297 statt 830 Pixel** und prüft nach der Korrektur
  die richtige halbe Seitenbreite sowie alle acht Karten der rechten Spalte.
- Ein OCR-Auftrag wird atomar übernommen. Zeichenbudget gilt über alle Seiten
  zusammen; eine neue Seite kann nicht schleichend die bisherige Grenze umgehen.
- Auf gemischten Seiten werden unveränderte Textebenen erhalten. Automatische,
  weit ausgedehnte Überschriftsbereiche werden für eine zusätzliche unabhängige
  Bildkarte auf ihren tatsächlichen Textumfang begrenzt. Wirkliche Überlappungen
  werden zurückgewiesen, statt Text ungeprüft doppelt zu übernehmen.

Fotos: höchstens 20 MB, 24 Millionen Eingangspixel, 12000 Pixel Kantenlänge;
Dateistruktur und Abmessungen vor dem Decoder prüfen. Arbeitsbilder höchstens
vier Millionen Pixel. PDF weiterhin höchstens 20 MB und 40 Seiten, höchstens
100 Karten. Insgesamt höchstens 250.000 Textzeichen und 4.000 separate Abschnitte.
OCR-Start maximal 20 Sekunden; Auftrag maximal drei Minuten; PDF-Ausschnitt
maximal 20 Sekunden. Fehler erhalten den Entwurf und bieten kleinere Aufnahme,
manuelle Auswahl oder erneute Aufnahme an.

## Prüfung und Originaltreue

Neutrale Materialien sind echte Bild-/PDF-Dateien mit eigenen gedruckt gestalteten
Texten, keine vorgegebenen OCR-Antworten. Die Fotosimulationen enthalten Drehung,
Schräglage, Schatten, Kontrastverlust, kleine Schrift und Unschärfe. Sie ersetzen
keine Aufnahmeprüfung mit einer echten Schulkamera. Private Original-PDFs wurden
zusätzlich zu reinen Bild-PDFs gerastert; diese Dateien und ihre Texte bleiben
außerhalb des öffentlichen Repositorys und öffentlichen Abnahmepakets.

`Pruefnachweise/Originalvergleich.json` vergleicht Rohtexte mit dem unabhängig von
OCR erzeugten Solltext. Es nennt Zeichendifferenzen, einzelne kritische Werte,
Überschriften und Absatzgrenzen. Die Zeichenfehlerrate normalisiert nur Leerraum;
sie ist kein pauschales Qualitätsmaß für Fotos. Der unveränderte Rohtext bleibt
separat erhalten. Satzzeichen, Absätze und einzelne Zeichen sind tatsächlich
fehlerhaft. Es wird kein 100-Prozent-Erkennungsversprechen gegeben.

`Korrigiert-*.json` enthält die im Browser wirklich eingetragenen und anschließend
wieder ausgelesenen Korrekturen. Die Workflow-Protokolle belegen danach zwei
Editoränderungen, Hilfen/Nummernfarben, Entwurf, frische Sitzung, Schülerversion,
entpacktes Unterrichts-SCORM, Team, Bewegung, gerichteten Pfeil und vollständige
PNG-Wiederherstellung. Die ursprünglichen Schülerfunktionen und Datenformate
werden dabei nicht ersetzt.

Prüfergebnisse, Browserstände und Dateigrößen stehen im versiegelten
`Pruefnachweise/ABSCHLUSS.json`. `full-check.log` belegt den Abschlusslauf.
`pixel-duplicate-reproduction.log` dokumentiert den absichtlich fehlschlagenden
Nachweis vor der Korrektur; Kandidaten- und `*-before-*`-Protokolle dokumentieren
frühere Prüfschritte.
107 der 108 bereits vorhandenen Testdateien bleiben gegenüber der Ausgangsbasis
bytegleich. In einer Datei wurde ausschließlich der überholte exakte Hinweis
„Texterkennung ergänzen wir später“ an die neue Funktion angepasst und eine
zusätzliche Prüfung ergänzt: Die kompakte Universal-HTML startet keine OCR ohne
Zusatzpaket. Kein Test und keine Assertion wurden entfernt oder abgeschwächt. Die geschützten Kern-/Sicherungs-/Druck-/Boden-Dateien sind gesondert
gehasht. Neue Tests prüfen die OCR sowie die zusätzlich gefundenen Grenzfehler.

## Grenzen und noch notwendige Abnahme

- **WebKit 27.2 ist eine Linux-Browserprüfung, kein echter Safari-/Schul-iPad-Test.**
  WebKit 26.5 ist nicht verfügbar. Die fünf belegten WebKit-Prüfungen umfassen
  20-/16-Karten-Scan, Foto-OCR, beide fehlenden lokalen Ressourcen und den
  pixelgenauen PDF-Beschnitt.
- Echte itslearning-Installation, verwaltete Schul-iPads, Safari auf dem Ziel-Mac,
  Kameradialog, große reale Fotos, Speicherdruck und native Druckausgabe müssen
  auf den tatsächlichen Geräten geprüft werden. Keine schulische Freigabe.
- Die neutrale 64-MiB-Zusatzbelastung und die Prozess-/Heap-Messungen sind Cloud-
  Messungen. Sie beweisen weder iPad-Speichersicherheit noch M1-Geschwindigkeit.
  Der gemessene RSS-Wert summiert Browserprozesse; gemeinsame Seiten können
  mehrfach enthalten sein. JavaScript-Heap ist kein vollständiger WASM-Speicherwert.
- Schatten, Unschärfe, Perspektive und feine Schrift können die automatische
  Aufteilung verhindern. Überlappungen werden ehrlich abgelehnt; manuelle
  Einzelmarkierung wird als Fallback geprüft. Gegebenenfalls neu fotografieren.
- Schräglage wird manuell korrigiert; keine automatische Perspektivkorrektur.
  Zuschnitt erfolgt vor der Drehung; erneuter Zuschnitt nach Zurücksetzen.
  Schwarz-Weiß ist optional und kann feine Zeichen verlieren. Standard ist Farbe.
- HEIC/HEIF, Handschrift und ein englisches Modell sind nicht zugesichert.
- Beim Wechsel zwischen CDP-Touch-Dragging und dem nativen Playwright-Tap kann
  Cloud-Chromium auch auf einer minimalen HTML-Seite das nächste Kompatibilitäts-
  click verschlucken. Der Grenzentest prüft die echte Touch-Markierung und danach
  echte Tastaturaktivierung; andere OCR-Grenzaktionen werden nativ angetippt.
  Es wird kein künstliches DOM-click zur Umgehung eingespritzt. Durchgehende
  Fingerbedienung nach dem Markieren bleibt zusätzlich am realen iPad zu prüfen.
- Der lokale Serverstart benötigt kostenloses Python 3. Direktes `file://` für
  das mehrteilige OCR-Paket wird nicht zugesichert. Das OCR-SCORM ist der
  priorisierte Bereitstellungsweg und benötigt keinen Lehrer-npm-Build.

Kein Merge in main, keine Pages-Veröffentlichung, kein öffentlicher Release und
keine Änderung an der eingefrorenen Boden-RC2. Private Quellen werden nicht als
öffentliche Testmaterialien ausgegeben.

## Betroffene Dateien

| Bereich | Dateien und Zweck |
| --- | --- |
| Importoberfläche | `src/components/DocumentImport.tsx`: OCR, Korrektur, Vorbereitung, Originalvergleich und atomare Übernahme; `AuthorEditor.tsx`: Fotozugang und Dateirouting; `PdfRegionEditor.tsx`: Erläuterung der bestehenden Bereichswerkzeuge |
| OCR und Eingangsprüfung | `src/core/document-import/ocr.ts`, `scan.ts`: lokale Sitzung, Bildprüfung, Pixelrahmen und Zwischenwerte; `model.ts`: zusätzliche Dateiformate; `parser.worker.ts`: begrenzte Scan-/Ausschnittrasterung und Abbruch |
| Verpackung | `ocr/`, `scripts/package-ocr.mjs`, `scripts/prepare-universal-tests.mjs`; `src/core/classroom-scorm.ts` entfernt die OCR-Aktivierung aus Unterrichtsexporten |
| Darstellung | Ausschließlich `.ocr-*`-Regeln in `src/style.css` |
| Prüfung und Lieferung | `tests/offline-ocr.test.ts`, `tests/browser/offline-ocr.spec.ts`, neutrale OCR-Fixtures, `qa/ocr/`, `scripts/package-ocr-review.py`, `playwright.ocr-webkit.config.ts` |
| Abhängigkeiten | `package.json`, `package-lock.json`: festgelegte freie Tesseract-/Modellversionen |

## Vollständige Prüfkommandos

Die Umgebung verwendet Node 24. Die nachfolgenden Befehle werden im
Projektverzeichnis ausgeführt; die Logs und genauen Versionsnummern liegen im Paket.

```sh
# Vollständige bestehende und neue Regression: Daten, TypeScript, Produktion,
# Testbuilds, tatsächliche Universal-/Unterrichts-SCORMs und Chromium.
CLASSROOM_SCORM=1 OCR_EVIDENCE_DIR=/workspace/mysteryboard-ocr-evidence npm run check

# Eingefrorene Unterrichtsfassung.
npm run test:rc2

# Zusätzliche private Original-PDF-Prüfung; die Quelldateien bleiben privat.
PDF_REGION_CASES=/workspace/mysteryboard-pdf-regions-private/private-cases.json \
PDF_REGION_DOWNLOADS=/workspace/mysteryboard-ocr-private/legacy-downloads \
npx playwright test tests/browser/pdf-regions.spec.ts \
  --output=test-results/ocr-private-pdf --reporter=list

# Bild-PDFs der privaten Originale.
python3 qa/ocr/private-scans.py \
  /workspace/mysteryboard-pdf-regions-private/private-cases.json \
  /workspace/mysteryboard-ocr-private
OCR_PRIVATE_CASES=/workspace/mysteryboard-ocr-private/scan-cases.json \
OCR_EVIDENCE_DIR=/workspace/mysteryboard-ocr-private \
npx playwright test tests/browser/offline-ocr.spec.ts \
  --grep 'Private Originale' --output=test-results/ocr-private-rasters --reporter=list

# Tatsächliches OCR-SCORM in WebKit 27.2: fünf positive/negative Fälle.
OCR_EVIDENCE_DIR=/workspace/mysteryboard-ocr-webkit-evidence \
npx playwright test --config playwright.ocr-webkit.config.ts \
  tests/browser/offline-ocr.spec.ts \
  --grep 'echte 20-|Fotokarten mit Umlauten|fehlende lokale Ressource|Prozentmarkierung entspricht'

# Unabhängige ZIP-, Entpack-, Modellgzip-, SHA- und Manifestprüfung.
python3 qa/ocr/verify-package.py \
  artifacts/MysteryBoard-OCR-SCORM-1.2.zip artifacts/OCR-integrity.json
python3 qa/ocr/verify-package.py \
  artifacts/MysteryBoard-OCR-Autorenpaket.zip artifacts/OCR-integrity.json
python3 qa/ocr/check-local-start.py

# Unveränderte Browser-Engine, Wortrechtecke, Abbruch und Ressourcenmessung.
node qa/ocr/feasibility.mjs /workspace/mysteryboard-ocr-evidence
python3 qa/ocr/compare-originals.py /workspace/mysteryboard-ocr-evidence

# Eigenständige Standardbibliothek-/PNG-Prüfung der echten Schülerdownloads.
python3 qa/touch-saving/verify-png.py INPUT.png OUTPUT.json
```

Der WebKit-Start benötigte fünf freie Debian-Laufzeitbibliotheken im bestehenden
Cloud-Browserordner. Die Systeminstallation wurde nicht verändert. Versionen,
Paketpfade und geprüfte SHA-256-Werte stehen in `WebKit-Laufzeitpakete.json`.
WebKit-Sandbox-/Cache-Umgebungswerte in der QA-Konfiguration betreffen ausschließlich
den gekapselten Cloud-Testbrowser und sind keine Anwendungseinstellung.
