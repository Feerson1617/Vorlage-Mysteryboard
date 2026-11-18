# Lokale OCR für Fotos und Scans

MysteryBoard verwendet denselben Anwendungskern und denselben Importassistenten.
Die zusätzliche Autorenfassung enthält Tesseract.js 7.0.0, Tesseract.js-core 7.0.0
und das deutsche LSTM-Modell `@tesseract.js-data/deu` 1.0.0 (`4.0.0_best_int`).
Englisch, HEIC/HEIF und Handschrift werden nicht zugesichert.

## Bereitstellung

- `MysteryBoard-Universal.html`: selbstständige kompakte Anwendung; Word/PDF-Textebene,
  Bilder als Kartengrafiken und bisherige Funktionen; keine OCR-Engine eingebettet.
- `MysteryBoard-OCR-SCORM-1.2.zip`: universelle Autorenfassung mit sämtlichen lokalen
  OCR-Ressourcen. Als unverändertes SCORM-Paket in itslearning importieren.
- `MysteryBoard-OCR-Autorenpaket.zip`: vollständig entpacken; `python3 start-ocr.py`
  startet einen lokalen statischen Server und öffnet den Browser. Python 3 ist eine
  kostenlose Voraussetzung. Der Server bindet ausschließlich 127.0.0.1 und bietet
  keine Upload-, Speicher- oder API-Funktion. `START.command` ist die Mac-Starthilfe.
  Direktes Öffnen der mehrteiligen OCR-Fassung über `file://` ist wegen der
  Browserregeln kein zugesicherter Startweg.
- Unterrichtsfertige Exporte enthalten weiterhin genau vier SCORM-Dateien und
  keine OCR-Modelle/-Worker. Das OCR-Konfigurations-Metaelement wird nicht vererbt.

Die Grenze von 10.000.000 Bytes pro Anwendungs-HTML bleibt bestehen. Sie gilt
nicht als Größenangabe für ein mehrteiliges ZIP. Engine und Sprachmodell werden
weder in die Einzel-HTML eingefügt noch zur Laufzeit von einem CDN nachgeladen.

## Ablauf für Lehrkräfte

1. Lehrkräfteeditor öffnen, „Foto oder Scan importieren“, Datei wählen. „Foto
   aufnehmen“ bietet die Kamera über die Dateiauswahl an, soweit Safari dies erlaubt.
2. Bei Bedarf Original ansehen und Bild vorbereiten: Drehung, manuelle Schräglage,
   Kontrast, Graustufen/Schwarz-Weiß und Ausschnitt. Schwarz-Weiß vorsichtig verwenden.
   Unbearbeitete Aufnahme zusätzlich einblenden; Zurücksetzen verwirft die Vorbereitung.
   Für den Zuschnitt zuerst im unverdrehten Bild markieren und zuschneiden, danach
   die Drehung anwenden. Ein weiterer Zuschnitt benötigt das Zurücksetzen.
3. „Kartengrenzen und Text erkennen“. Rahmen werden zuerst aus Pixeln gesucht.
   Bei fehlenden Rahmen helfen OCR-Wortpositionen und die vorhandene räumliche
   Erkennung. Grenzen bleiben Vorschläge. Kein zuverlässiges Universalversprechen
   für Schatten, Perspektive, Unschärfe, kleine Schrift oder Handschrift.
4. Nummerierte Region antippen, markieren, Prozentwerte ändern, verschieben,
   teilen, zusammenführen, entfernen oder ergänzen. Grenzänderungen lesen nur die
   betroffenen Karten neu; unbeteiligte Texte bleiben erhalten. Manuelle Änderungen
   werden erst nach Bestätigung ersetzt. Einzelne Karte erneut per OCR lesen möglich.
5. Überschrift, Text, Quelle, Pflicht-/V-Zuordnung und Reihenfolge prüfen. Unsichere
   Wörter sind mit „(?)“ benannt. Rohtext ist einsehbar; Sicherheit ist keine Garantie.
   „Original dieser Karte vergrößert vergleichen“ zeigt einen echten, größeren
   Ausschnitt zum Lesen kleiner Zeichen. Besonders 1912, Dezimalkommas, °C, mg/l, Eigennamen und Buchstaben/Nummern prüfen.
   Auch J/I/| und O/0 können verwechselt werden. Keine automatische fachliche Korrektur.
6. Jede OCR-Karte einzeln am Original bestätigen. Leere Ergebnisse neu aufnehmen,
   manuell ausfüllen oder entfernen. Nach jeder Textkorrektur erneut bestätigen.
7. Übernahme ausdrücklich bestätigen. Erst dann ändert sich der geöffnete Entwurf.
   Anschließend wie bisher Entwurf sichern und Schülerversion/Unterrichts-SCORM erzeugen.

Bei Textebenen-PDFs bleibt die schnelle bisherige Extraktion erhalten. OCR wird für
reine Scan-Seiten angeboten. Auf gemischten Seiten nur fehlende Ausschnitte ergänzen;
überlappende Texte werden durch die bestehenden Bereichsprüfungen zurückgewiesen.

## Ressourcen und Datenschutz

Nur ein OCR-Worker, bei Bedarf. Er gehört zu einem verborgenen, kurzlebigen
Originalkontext. Abschluss/Fehler/Abbruch entfernen diesen Kontext einschließlich
seiner Worker, auch während der Initialisierung. Kein `localStorage`, IndexedDB,
Service Worker oder Modellcache: `cacheMethod: "none"`. Temporäre Bilder und Texte
liegen nur im Arbeitsspeicher. Der Browser kann statische HTTP-Dateien normal cachen;
dort werden keine Uploadinhalte übertragen. Worker-, Kern- und Modellpfade sind lokal.
Der SCORM-Rahmen verwendet weiterhin nur Initialize/Finish, keine Lernendenwerte.

Fotos: höchstens 20 MB, 12000 Pixel Kantenlänge, 24 Millionen Eingangspixel;
Abmessungen vor dem Decoder prüfen. Arbeitsbilder maximal vier Millionen Pixel.
PDFs weiterhin höchstens 20 MB/40 Seiten; eingebettete Scanbilder kontrolliert bis
24 Millionen Pixel statt früherer Auslassung über vier Millionen. OCR-Ausschnitte
werden aus der PDF höher aufgelöst gerendert, jeweils unter vier Millionen Pixel.
Normale PDF-Vorschau und Speicher-/Kartengrafikgrenzen bleiben bestehen.
Über alle importierten Seiten zusammen gelten weiterhin 250.000 Textzeichen
und höchstens 4.000 separate Dokumentabschnitte. OCR-Start maximal 20 Sekunden; ein Auftrag maximal drei Minuten; PDF-Ausschnitt
maximal 20 Sekunden. Abbruch verwirft einen laufenden Auftrag atomar. Keine dauerhafte
Speicherung ersetzt die bewusste Entwurfs-/PNG-Sicherung.

Safari, Kamera, Speicherdruck auf verwalteten Schul-iPads und itslearning benötigen
echte Plattformtests. Cloud-Chromium ist keine schulische Freigabe.

## Reproduzieren

```sh
npm ci --cache /workspace/.npm-cache
python3 scripts/create-ocr-fixtures.py
npm run check
npm run package:ocr
python3 qa/ocr/verify-package.py artifacts/MysteryBoard-OCR-SCORM-1.2.zip artifacts/OCR-integrity.json
python3 qa/ocr/verify-package.py artifacts/MysteryBoard-OCR-Autorenpaket.zip artifacts/OCR-integrity.json
node qa/ocr/feasibility.mjs /tmp/ocr-evidence
python3 qa/ocr/compare-originals.py /tmp/ocr-evidence
```

`OCR_EVIDENCE_DIR` bestimmt das Ziel der Browsernachweise. Private Originale nur
außerhalb des Repositorys rasterisieren; `OCR_PRIVATE_CASES` verweist auf die private
Fallliste. Originaldateien und daraus abgeleitete Inhalte gehören nicht in Git.
