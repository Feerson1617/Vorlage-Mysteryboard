# Touch-Steuerung und eindeutige Schüler-PNG-Sicherung

16. November 2026, Europe/Berlin. Basis: `50c6b59e8688abea8863eb27f2753840f2391df5`. Neuer Branch: `fix/mysteryboard-touch-png-saving`. Quellcommit, vollständige Ergebnisse und Produktionsprüfsummen stehen in den Metadaten der fertigen Lieferung.

## Reproduzierte Ursachen

In `Board.tsx` erzeugte `pointermove` einen React-Preview-State. `pointerup` übernahm diesen State aus dem letzten abgeschlossenen Render. Bei unmittelbar aufeinanderfolgenden Ereignissen konnte dort noch die vorherige Vorschau oder `null` stehen: Die Karte blieb an der alten Position oder verlor die letzte Bewegung. Die tatsächliche Loslasskoordinate wurde nicht für die neue Position ausgewertet.

Der bisherige `ResizeObserver` rief bei jeder Meldung die Übersicht auf. Auch eine wiederholte Meldung ohne echte Größenänderung konnte dadurch die während einer Geste gewählte Vergrößerung zurücksetzen. Die aktuelle Ansicht gelangte außerdem erst beim nächsten React-Render in ihre Referenz.

Zwei Browserfälle reproduzieren beide Fehler in der unveränderten vorherigen Produktions-HTML mit einer neutralen zwölfteiligen Aufgabe. Die Baseline-Protokolle enthalten tatsächliche DOM-Koordinaten und Pointer-Ereignisse: 50 Bewegungsereignisse plus Loslassen innerhalb desselben JavaScript-Tasks und eine erneute ResizeObserver-Meldung während einer aktiven Geste. Die zwei erwarteten Baseline-Fehlschläge sind getrennt von der abschließenden Regression dokumentiert.

## Gezielte Änderungen

**`src/components/Board.tsx`:** Aktive Pointer-ID, Ausgangsstand, Ausgangsansicht und Gestenursprung liegen in einer stabilen Referenz. Die abschließende Kartenposition wird unmittelbar aus dieser Referenz und der Loslasskoordinate berechnet. Der so abgeschlossene Stand wird sofort in der aktuellen Referenz geführt, damit zwei abgeschlossene Gesten auch ohne Renderpause aufeinander aufbauen.

Die Vorschau aktualisiert sich höchstens einmal je Animationsframe aus dem neuesten Positionsstand. Beim Abschluss oder Abbruch wird ein noch vorgemerkter Frame verworfen. Ein abgeschlossener Drag erzeugt genau einen History-Schritt; einzelne Moves erzeugen keinen. Kartenlayouts und bestehende Verbindungsgeometrie werden wiederverwendet. Während einer Kartenvorschau werden nur die an dieser Karte beteiligten Verbindungen neu berechnet. Beschriftungspriorität, Linientreffflächen, Zeichenreihenfolge und sichtbare Pfeile bleiben erhalten.

Eine zusätzliche Prüfung deckte einen Fehler in dieser neuen Zwischenspeicherung auf: Tastatur-Undo einer unbeteiligten Verbindung während eines laufenden Drags konnte eine alte Vorschau mit der neuen Verbindungsliste kombinieren und die Darstellung abbrechen. Der endgültige Code verwendet eine Vorschau nur, solange ihr Ausgangsstand noch der aktuelle Arbeitsstand ist. Der zusätzliche Browserfall prüft den vollständigen Erhalt aller Karten, das Abbrechen ausschließlich der Geste und das anschließende Redo der Verbindung. Nach dieser Korrektur wird die gesamte Regression erneut ausgeführt.

Mehrfingergesten konsumieren weiterhin alle beteiligten Finger bis zum Loslassen. Pointer-/Touch-Abbruch und unerwarteter Capture-Verlust verwerfen die vorläufige Kartenbewegung. Capture-Verlust hebt einen Finger nicht künstlich auf. Nach normalem Abschluss ist die aktive Geste vor der Capture-Freigabe beendet; verspätete Ereignisse setzen den übernommenen Stand nicht zurück. Dokumentweite Weiterleitung erreicht Bewegung und Abschluss auch außerhalb des SVG, falls die Erfassung nicht zustande kommt. Eine externe Änderung des Arbeitsstands während einer Geste verwirft deren veraltete Vorschau.

Der ResizeObserver unterscheidet echte Größenänderungen von wiederholten Meldungen. Während einer Geste erfolgt keine automatische Übersicht. Verschiebt sich die SVG-Fläche im Viewport, werden die lokalen Gestenkoordinaten entsprechend versetzt, damit derselbe Weltpunkt unter dem Finger bleibt. Tatsächliche Größenänderung im Ruhezustand und ausdrücklich gewählte Übersicht bleiben unterstützt. Ein versetztes Loslassen ohne vorausgehende Ziehbewegung bleibt eine verworfene Auswahl und wird nicht neu als Bearbeitung interpretiert.

**`src/App.tsx`:** Schüler verwenden ausschließlich **Sichern** beziehungsweise **Kleineres Sicherungsbild**. Der zusätzliche Menüpunkt **Projektdatei sichern** und sein nicht mehr erreichbarer Exportcallback entfallen. Der vorhandene Rückfall vom großen auf das kompakte PNG bleibt erhalten. Schlagen beide fehl, erscheint die verständliche Fehlermeldung, der geöffnete Stand bleibt erhalten und es gibt kein JSON-/Projektdatei-Ersatzformat.

**`src/core/filenames.ts`:** Der tatsächliche Teamname und Mystery-Titel ergeben **Teamname_Mysterytitel.png**. Umlaute, lesbare Leerzeichen und zulässige Zeichen bleiben erhalten; technische IDs, Zufallswerte und Datumszusätze entfallen. Verbotene Dateisystemzeichen und unsichtbare Steuerzeichen werden entfernt. Die Gesamtlänge bleibt innerhalb von 200 UTF-8-Bytes, ohne Unicodezeichen oder Endung abzuschneiden. Vollständig ungeeignete Namen führen zu einer verständlichen Meldung statt zu einem heimlichen generischen Ersatznamen. Ein fehlender Teamname wird weiterhin vor dem Sichern nachgefragt.

**`src/UniversalApp.tsx`:** Heruntergeladene Lehrkraftdateien verwenden `application/octet-stream` mit ausdrücklich gesetzter `.mysteryboard`-Endung. Ihr kodierter Inhalt bleibt dasselbe JSON-Dokumentformat. Lehrkraftentwurf, Aufgabenexport und Import älterer Schüler-Projektdateien bleiben unterstützt. Der tatsächliche native Dateien-/Teilen-Dialog von Safari und iPadOS bleibt gesondert zu prüfen; ein anderer MIME-Typ ist kein solcher Gerätenachweis.

PNG-Renderer, `mySt`-Chunk, MBX3-Codec, Validatoren, Schemas, History und Datenmodell sind unverändert. Universelle Schülerarbeiten und Unterrichts-SCORM sichern weiterhin Inhalte, Medien, Hilfemetadaten, Team, Kartenstand und Verbindungen vollständig als MBX3. Eingefrorene und ältere technische Varianten behalten ihre bisherigen Formate. Erzeugung oder Download bestätigen weiterhin keine dauerhafte externe Ablage. Der Dirty-Zustand wird dadurch nicht als gespeichert quittiert; keine automatische Speicherung wurde eingeführt.

## Tatsächliche Messungen und Nutzungstests

`tests/browser/touch-stability.spec.ts` vergleicht die tatsächlichen Bildschirmkoordinaten aus der SVG-Matrix mit den eingespeisten Fingerkoordinaten. Dafür wird keine Geometriefunktion der Anwendung verwendet. Pointer-ID, Koordinaten, Vertrauensstatus und zeitliche Ereignisfolge werden zusätzlich protokolliert. Screenshots ergänzen die Messdaten.

- Vier Größen: 1024 × 768, 768 × 1024, 600 × 800 und 320 × 700 CSS-Pixel.
- Je Größe 60 Karten/220 Beziehungen, Zoom 0,15 / 0,55 / 1,5 / 2,8 und je Zoom 50 native Moves mit Richtungswechseln.
- Je Größe 30 aufeinanderfolgende abgeschlossene Drags, danach genau 30-mal Undo und Redo mit vollständigem Positions- und Reihenfolgevergleich.
- Ziehen an Text und Bildern über andere Karten bis nahe zum Bildschirmrand, verschiedene Kartengrößen und mitgeführte Verbindungen/Pfeile.
- Pinch mit versetztem Loslassen und anschließender neuer Bewegung, tatsächlicher Pointer-Abbruch, echte Capture-Freigabe, verspätete Ereignisse nach Abschluss sowie Viewportrotation während der Bewegung.
- 50 Moves plus Release ohne Renderpause; die Release-Endkoordinate unterscheidet sich ausdrücklich vom letzten Move. Zwei abgeschlossene Drags innerhalb eines Tasks behalten zwei Undo-Schritte.
- Tastatur-Undo einer unbeteiligten Verbindung bei gehaltenem Finger verwirft ausschließlich die überholte Vorschau; Redo und alle Karten bleiben funktionsfähig.

Exakte Messzahlen und größte Positionsabweichung stehen in `touch-metrics.json` und `ERGEBNIS.json`. Gemessen wird Positionsgenauigkeit nach Bildausgaben unter Linux-Chromium, keine zugesicherte Bildrate oder Ende-zu-Ende-Verzögerung eines Schul-iPads.

`qa/touch-saving/arrows-during-drag.mjs` kontrolliert zusätzlich in HTML und universeller SCORM die tatsächlichen Bildschirmkoordinaten der Linienendpunkte und Pfeilpolygone relativ zur bewegten Karte. Vier Größen, drei ausdrücklich erreichte Zoomstufen und beide gespeicherten Richtungen werden mit nativen Touch-Bewegungen geprüft. Der Prüfer lädt dafür das tatsächlich erzeugte Schüler-PNG und importiert keine Geometriefunktion der Anwendung.

`tests/browser/png-saving.spec.ts` durchläuft drei Betriebsarten in allen vier Größen: Produktions-Universal-HTML, echte universelle SCORM-Einbettung und im Browser erzeugtes Aufgaben-SCORM. Zwei Karten werden bewegt, Pfeile in beiden Richtungen beschriftet und die Hilfe verwendet. Tatsächliche große und kompakte PNG-Downloads werden auf Dateiname, MIME-Typ, Signatur, CRCs und MBX3-Daten geprüft. Eine neue Browser-/SCORM-Sitzung stellt den vollständigen Stand wieder her; danach wird weitergearbeitet und erneut gesichert. Der Standardbibliothek-Prüfer `qa/touch-saving/verify-png.py` liest die Dateien ohne Anwendungscodec. Original und Wiederherstellung müssen vollständig übereinstimmen.

Zusätzlich werden vollständiger Canvas-Fehlschlag und Rückfall vom großen zum kompakten PNG absichtlich ausgelöst. Es darf kein Ersatzformat und kein verlorener Stand entstehen. Lehrkraftentwurf und Aufgabendatei behalten im echten Download Endung und Inhalt.

## Testtreiber getrennt untersucht

Beim Wechsel von rohem CDP-Touch zu einem sofort folgenden Playwright-Tipp konnte Chromium ein natives `click` auslassen. Das wurde auf einfachem HTML ohne React, MysteryBoard oder Klickschutz reproduziert. `qa/touch-saving/driver-click-probe.mjs` vergleicht jeweils 40 Eingabefolgen mit und ohne zwei abgeschlossene Bildausgaben nach dem Drag. Die tatsächlichen Ausfallzahlen stehen unter `driver-probe/minimal-clicks-comparison.json`.

Der gemeinsame Browserhelfer prüft zusätzlich, dass die übernommene Kartenposition zwei Bildausgaben übersteht, bevor er zur normalen Touchscreen-Bedienung zurückkehrt. Er wiederholt keine fehlgeschlagenen Tipps und ruft keine Anwendungsfunktion künstlich auf. Die strengen Same-Task-/Release-Tests enthalten diese Wartephase nicht. Die Klickbehandlung der Anwendung wurde für diesen isolierten Testtreibereffekt nicht erweitert.

Bestehende Fälle, die früher Schüler-Projektdateien herunterluden, vergleichen denselben vollständigen Stand jetzt aus einem echten PNG. Die `.mysteryboard`-Snapshots in den Prüfdateien werden ausschließlich vom Testskript aus dem PNG erzeugt; sie sind kein angebotener Schülerexport. Keine bisherigen Inhalts-, Wiederherstellungs- oder Sicherheitsassertionen wurden entfernt oder gelockert. Die Abwesenheit des zusätzlichen Menüpunktes wird ebenfalls geprüft.

## Vollständige Prüfkommandos

```sh
CLASSROOM_SCORM=1 \
TOUCH_EVIDENCE_DIR=/workspace/mysteryboard-touch-final-evidence/downloads \
PDF_REGION_DOWNLOADS=/workspace/mysteryboard-touch-final-evidence/regression-downloads \
CLASSROOM_EXPORT_DIR=/workspace/mysteryboard-touch-final-evidence/regression-downloads \
AUTHORING_EXAMPLES_DIR=/workspace/mysteryboard-touch-final-evidence/regression-downloads \
PRINT_EXAMPLES_DIR=/workspace/mysteryboard-touch-final-evidence/regression-downloads \
INTEGRATION_EXAMPLES_DIR=/workspace/mysteryboard-touch-final-evidence/regression-downloads \
  npm run check
npm run test:rc2
node qa/touch-saving/driver-click-probe.mjs PRUEFORDNER/driver-probe
node qa/touch-saving/arrows-during-drag.mjs \
  artifacts/MysteryBoard-Universal.html \
  artifacts/MysteryBoard-Universal-SCORM-1.2.zip \
  /workspace/mysteryboard-touch-final-evidence/downloads/html-1024-Original.png \
  PRUEFORDNER/pfeile-waehrend-drag
python3 projekt/qa/touch-saving/verify-bundle.py ENTPACKTES-ABNAHMEPAKET
```

Die tatsächlichen Original-PDFs werden über die vorhandene `pdf-regions.spec.ts` mit `PDF_REGION_CASES` auf eine private Falldatei und vollständig getrennten Ausgaben geprüft. Originale, Texte, Screenshots und abgeleitete Aufgaben bleiben außerhalb des öffentlichen Repositorys. Die öffentliche Suite enthält weiterhin eigene neutrale 20-/16-Karten-PDFs, Word-Fixtures, Tabellen und Medien.

Ergebniszahlen, vollständige Protokolle und Prüfsummen stehen in den Liefermetadaten. Die bestehende Regression umfasst weiterhin 220 Verbindungen, Undo/Redo, Word/PDF, Editor, Drag-and-Drop, Hilfen, Pfeilraster in PNG/A4/A3, Druck, alte PNGs/Projektdateien, Offlinebetrieb und SCORM-Sitzungen. Die drei eingefrorenen Boden-Dateien werden byteweise gegen die Basis geprüft.

## Abschließendes Ergebnis

**160 Datentests in 23 Dateien bestanden. 253 Chromium-Browsertests in 30 Dateien bestanden**, keine übersprungenen Fälle. Der vollständige abschließende Lauf nach der zusätzlichen Undo-Korrektur dauerte 28,1 Minuten. Die bisherigen 226 Browsertests bleiben enthalten; hinzu kommen 27 gezielte Fälle für Touch, Dateinamen, MIME und PNG-Sicherung.

Zusätzlich bestanden **acht vollständige Original-PDF-Browserabläufe** am endgültigen Anwendungskern, einschließlich 20 beziehungsweise 16 Karten und frischer PNG-Wiederherstellung. Die Originalinhalte bleiben privat. **Vier RC2-Browsertests** bestehen; alle drei eingefrorenen Dateien bleiben bytegleich. **Acht unabhängige Pfeil-Folgeprüfungen mit 192 Messpunkten** bestehen. Die 48 tatsächlichen PNG-Downloads aus den zwölf neuen Kreisläufen werden zusätzlich unabhängig auf eingebettete Daten und gültige Bildpixel geprüft. Exakte Prüfsummen, Messwerte und Dateien stehen in den Liefermetadaten.

Die Touch-Protokolle enthalten **1.000 Positionsmessungen**, darunter 120 abgeschlossene aufeinanderfolgende Drags. Die größte beobachtete Abweichung beträgt **0,01795 CSS-Pixel**. In den 192 zusätzlichen Pfeilmessungen beträgt der größte Abstand zwischen tatsächlicher Spitze und tatsächlichem Linienendpunkt **0 CSS-Pixel**. Diese Zahlen beschreiben die protokollierten Chromium-Prüfungen nach Bildausgaben; sie ersetzen keine Geräte-/Latenzmessung. Alle **48 finalen PNGs** wurden vollständig als Bild dekodiert und ihre eingebetteten Daten unabhängig geprüft.

## Offene Geräteabnahme

WebKit 26.5 ist nicht installiert. Der vorhandene WebKit-27.2-Launcher startet wegen fehlender Hostbibliothek `libharfbuzz-icu.so.0` nicht; ein neuer Startversuch ist protokolliert. Diese Prüfungen werden nicht als bestanden ersetzt.

Die tatsächlichen Produktionsbytes wurden über lokale HTTP-Adressen geladen und anschließend offline geprüft. Direkte `file://`-Navigation wird von der Cloud-Browserrichtlinie blockiert; ein erfolgreicher direkter Datei-Aufruf auf dem Mac wird deshalb nicht behauptet.

Weiter erforderlich: echte Schul-iPads mit Safari, schnelles/langsames Ziehen unter Gerätebelastung, Fingerwechsel und Betriebssystemunterbrechungen, Orientierung, itslearning-Einbettung, tatsächliche Downloads/Teilen nach „Dateien“, `.mysteryboard`-Endungen und PNG-Wiederherstellung nach vollständigem Schließen. Auch native Safari-Druckfunktion bleibt offen. Weder schulische Freigabe noch reale iPad-/Mac-Leistung werden behauptet.

Kein Merge in `main`, kein Release und keine Pages-Veröffentlichung. Fachliche Karten, eingefrorene Boden-RC2, Speicherformate, PNG-/QR-Konzept, Hilfesystem und Drucksteuerung bleiben erhalten.
