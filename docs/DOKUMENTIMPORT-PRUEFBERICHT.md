# MysteryBoard Universal: lokaler Word-/PDF-Import

Prüfdatum: 15. November 2026. Ausgangscommit: `35019c364ffef026482250ec75042b38e138fe18`. Entwicklungsbranch: `feat/mysteryboard-local-document-import`. Der endgültige Quellcommit steht in `QUELLSTAND.json` des Abnahmepakets beziehungsweise `PROJECT-VERSION.json` der Projektvorlage. Diese Dateien werden beim Verpacken aus Git erzeugt. Kein Merge, Release-Tag oder Deployment gehört zu dieser Lieferung.

## Ergebnis und Bedienweg

Der bestehende Lehrkräfteeditor enthält **Dokument importieren** mit drei Schritten: Datei auswählen, Karten neben dem Original prüfen, ausdrücklich übernehmen. DOCX und PDF mit Textebene werden auf dem Gerät verarbeitet. Scan-PDFs zeigen den geforderten Hinweis ohne OCR und können als Seitenbild übernommen werden. Es gibt keine KI, externe Dokumentübertragung, automatische Speicherung oder Veröffentlichung.

Der vollständige Weg wurde mit echten Word- und PDF-Dateien in der gebauten Einzel-HTML ausgeführt: Originalvergleich, Kartengrenze teilen/zusammenführen, ergänzen/löschen, Bild ersetzen, Tabelle korrigieren, Pflicht-/V-Karten, Hilfe konfigurieren, Entwurf herunterladen, neue Browsersitzung, Schülerversion herunterladen, Universal-SCORM, Teamname, Touch-Verschieben/Verbinden, Pinch, Original-PNG, neue SCORM-Sitzung, vollständige Wiederherstellung und Weiterarbeit. Beide Formate wurden in allen fünf geforderten Ansichten geprüft.

Eine technisch simulierte Lehrkraft benötigt vom offenen Editor bis zum bestätigten Import sechs Auslösehandlungen: Import öffnen, Dateiauswahl öffnen, Datei im Betriebssystem wählen, nach der Inhaltsprüfung weitergehen, Prüfung bestätigen, übernehmen. Das Lesen und notwendige Korrekturen kommen hinzu. Entwurf sichern/Datei herunterladen, Downloadansicht schließen und Schülerversion erstellen sind bewusst getrennte Handlungen. Ein neues Mystery erfordert außerdem die Auswahl des Ersetzens und eine ausdrückliche Bestätigung. Das ist ein automatisierter Bediennachweis, keine Studie mit Lehrkräften.

Nach der Übernahme erscheint ein eindeutiger Hinweis, dass die Karten jetzt im Entwurf stehen und noch bewusst gesichert beziehungsweise als Schülerversion ausgegeben werden müssen. Originalansicht und Kartenansicht bleiben während der Prüfung erreichbar; schmale Ansichten wechseln zwischen beiden ohne Datenverlust. Word zeigt eine bereinigte Strukturansicht, keine identische Druckansicht des Originals. Die Quelldatei ist zusätzlich lokal ablegbar.

## Architektur und betroffene Dateien

- `src/components/DocumentImport.tsx`: integrierter Assistent, temporäre Vorschläge, Originalvergleich, Kartenbearbeitung, Auswahl, PDF-Ausschnitt, ausdrückliche Übernahme, Abbruch und Ressourcenfreigabe.
- `src/components/AuthorEditor.tsx`: Einstieg, Schutz laufender Bearbeitungen, bestehende Entwurfsübernahme und Downloadwege. Der normale Board-Bereich ist während des Importassistenten ausgehängt; die bisherigen Touch-Ereignisse greifen daher nicht in dessen Schaltflächen ein.
- `src/core/document-import/model.ts`: vorübergehende Dokumentblöcke, konservative Strukturvorschläge, bestehender `Content.cards`-Kartentyp, Validierung und atomare Übernahme über `newDraft`/`reviseDraft`.
- `src/core/document-import/zip.ts`: begrenztes DOCX-Entpacken mit Inhalts-, Größen- und CRC-Prüfungen vor Mammoth.
- `src/core/document-import/parser.worker.ts`: Mammoth, ausdrücklich erlaubte Text-/Tabellen-/Bilddaten, lokale PDF.js-Verarbeitung, Seitenrendern und Begrenzungen in einem terminierbaren Worker.
- `src/components/MediaView.tsx`: zusätzliche optionale verzögerte Bildanzeige für die Word-Originalansicht; bestehende Aufrufer behalten den bisherigen Standard.
- `src/style.css`: an den vorhandenen Editor angepasste, responsive Importansicht.
- `vite.config.ts`, `src/env.d.ts`, `scripts/document-import-assets.ts`: vollständig eingebetteter Worker und lokal gebündelte PDF-Schriften, CMaps und WASM-Decoder.
- `scripts/document-import-licenses.mjs`, `scripts/check-build.mjs`, `package.json`/Lockdatei: festgelegte freie Bibliotheken, vollständige Lizenzbeigaben und bestehende HTML-Größenprüfung.
- Neue Daten-/Browsertests, echte Testdateien und Generator, eigenständig ausführbarer Blackbox-Prüfer, Benchmark, Kaltstart- und Verpackungsskripte, Anleitung und Prüfunterlagen.

Das gespeicherte MysteryBoard-Format bleibt **Version 3**. Es wurde kein zweites dauerhaftes Kartenmodell und keine Import-Metadatenpflicht eingeführt. Automatische Nummerierung, Inhaltsversionen, Hilfen, Gruppen, Startablage und Medienvalidierung verwenden die bestehenden Funktionen. Hinzufügen erhält die Mystery-ID und vorhandene Hilfen; ein neues Mystery erhält eine neue ID und beginnt ohne fremde Hilfezuordnung. Bestehende Schülerarbeiten werden nicht still auf neue Inhalte umgebogen.

Board-Ereignisbehandlung, PNG-/QR-Code, Datenformat, History, Export und Druckkern wurden nicht geändert. Die eingefrorenen Boden-RC2-Dateien bleiben bytegleich; siehe Hashnachweis unten.

## Bibliotheksprüfung, Lizenzen und Offline-Verpackung

Am Prüftag wurden die verfügbaren Paketversionen abgefragt und festgelegt:

| Bibliothek | Version | Lizenz | Einsatz |
| --- | --- | --- | --- |
| Mammoth | 1.13.0 | BSD-2-Clause | OOXML-Struktur und eingebettete Bilder |
| pdfjs-dist | 6.5.438 | Apache-2.0 | lokale PDF-Textebene und Seitendarstellung |
| htmlparser2 | 12.0.0 | MIT | reine Datenextraktion aus Mammoth-Ausgabe |
| fflate, bereits vorhanden | 0.8.3 | MIT | kontrolliertes ZIP-Entpacken und lokale PDF-Ressourcen |

Die Lockdatei enthält die konkreten transitiven Versionen. Die Lizenzbeigabe im HTML enthält zusätzlich die Schriften-, CMap- und WASM-Lizenzen aus PDF.js. Optionale Node-Canvas-Pakete werden nicht in die Browseranwendung eingebunden. Alle verwendeten Werkzeuge und Assets sind kostenlos. Die selbst erstellten Testtexte und Diagramme sind synthetische Prüfdaten; keine Personen-/Schülerdaten und keine fachliche Unterrichtsfreigabe.

`npm audit --omit=dev` und das vollständige Audit melden jeweils null bekannte Schwachstellen und sind in den Prüfnachweisen abgelegt. Ein Audit ist eine Bestandsaufnahme bekannter Meldungen, kein Beweis für die Abwesenheit unbekannter Sicherheitsprobleme.

Der Parser wird ausschließlich nach einer Dateiauswahl im Lehrkräfte-Import instanziiert. Vorher gibt es keinen Parser-Worker, keinen ausgeführten PDF-/Mammoth-Parser und keine entpackten PDF-Hilfsressourcen. Nach Schließen/Abbruch wird der Worker beendet. Die Einzel-HTML enthält dessen Programm und Ressourcen bereits als eingebettete Daten; physische Dateigröße und Lesen dieser Daten sind daher nicht kostenlos. Ein dynamischer CDN-Import wäre mit der verlangten einzelnen Offline-Datei unvereinbar.

PDF.js läuft samt seiner eigenen Verarbeitung in diesem äußeren Worker. Es wird keine zusätzliche Workerdatei nachgeladen. CMaps, Standardschriften und Decoder kommen aus einer lokalen ZIP-Datenmenge mit festem Zeitstempel. Der PDF-Aufruf erhält ausschließlich die ausgewählten Dateibytes; eigene Datenfabriken erlauben nur gebündelte Ressourcen. Dokument-URLs sind keine Ressourcenquellen. Das SCORM-Paket enthält weiterhin genau `app.html`, `launch.html`, `session.js`, `imsmanifest.xml`; `app.html` ist bytegleich zur gelieferten HTML. Das Manifest und diese Gleichheit werden tatsächlich geprüft.

## Datenintegrität und Grenzen

- Importdatei höchstens 20.000.000 Bytes, PDF höchstens 40 Seiten, höchstens 250.000 Textzeichen, 4.000 Bereiche und 100 Karten im fertigen Mystery.
- DOCX-Zentralverzeichnis vor dem Entpacken prüfen: maximal 2.000 Einträge, 40 MB entpackt, 20 MB pro Eintrag; XML maximal 5 MB. Kein ZIP64, verschlüsseltes/mehrteiliges Archiv, Pfadwechsel, widersprüchliche Einträge oder ungültige CRC. Auffällige Kompressionsverhältnisse werden zurückgewiesen. Tatsächliche Ausgabemengen werden während des Entpackens erneut begrenzt.
- Aktive DOCX-Teile, eingebettete Objekte/Programme, `altChunk`, DTD und externe XML-Entitäten werden nicht verarbeitet. Mammoth darf keine externen Dateien öffnen oder eingebettete Stylemaps übernehmen. Externe Links werden nur als Text extrahiert; keine fremde URL wird als Bild/HTML ausgeführt.
- Mammoth-HTML wird **niemals** in `innerHTML`/`dangerouslySetInnerHTML` übernommen. Ein Parser liest ausschließlich erlaubte Textknoten, Tabellenwerte und zuvor geprüfte Rasterbilder. React stellt die Daten dar. Skriptzeichen im Word-Text bleiben Text.
- PDF-JavaScript-Aktionen auf Dokument-/Seitenebene werden zurückgewiesen, Auswertung/XFA/Netzwerkressourcen sind deaktiviert. Es gibt keine interaktive PDF-Formular-/Annotationsansicht.
- Bilder: bestehende Grenze 3 MB, 4096 Pixel je Kante, vier Millionen Pixel pro Bild; insgesamt zwölf MB und 24 Millionen Pixel. Word prüft die Summe vor zusätzlicher Bilddecodierung; die endgültige Übernahme prüft erneut über die vorhandene Mystery-Validierung und echte Bilddecodierung.
- PDF-Textbestandteile sind zusätzlich auf 20.000 je Seite begrenzt. Seitenbilder werden auf etwa zwei Millionen Pixel begrenzt und bei Bedarf als JPEG erzeugt. Import und Rendern enden nach 45 beziehungsweise 20 Sekunden; eine Lehrkraft kann vorher jederzeit abbrechen.
- Abbruch/Fehler/Dateiwechsel schließen alte Anfragen aus. Erst die bestätigte und validierte Übernahme verändert den Entwurf. Ein unbestätigtes Ersetzen oder verspätetes Worker-Ergebnis kann keinen vorhandenen Entwurf überschreiben.

Diese Grenzen verringern den Aufwand; ein Browser-Worker besitzt keine garantierte harte Obergrenze für den gesamten nativen Prozessspeicher. PDF-Decoder, Canvas und Browser können zusätzlichen Speicher beanspruchen. Ein Schul-iPad-Speicherlimit wird deshalb nicht aus Chromium-V8-Werten abgeleitet. Sehr komplexe oder ungewöhnlich lange/schmale Seiten können die Bildprüfung überschreiten; dann muss das Original vorher vereinfacht oder geteilt werden.

## Originalvergleich und Testdateien

`dateien/` enthält echte OOXML-/PDF-Dateien, deren Ausgangs-HTML, selbst erzeugte Rasterbilder, Word-Originalvergleichs-PDFs und `ORIGINAL-INHALTE.json`. Der Generator liegt im Quellpaket. Die Vergleichs-PDFs A/B geben dieselben Originalinhalte wieder; sie sind keine behauptete Microsoft-Word-Druckausgabe. Keine DOCX/PDF-Erfolgsdatei ist bloß umbenannter Text. Die absichtlich ungültigen Dateien F sind ausdrücklich Fehlerfälle.

| Fall | Inhalt / tatsächlicher Nachweis |
| --- | --- |
| A | 12 Word-Karten, 9 Pflicht und V3/V8/V12; sämtliche Titel, Absätze, Quellen und Gruppen am separaten Originalmanifest verglichen |
| B | 6 Word-Karten, zwei echte Rasterbilder, bearbeitbare Messwerttabelle mit allen Dezimalzahlen, Uhrzeiten und Einheiten; Listen und Quellen erhalten |
| C | 12 PDF-Karten auf sechs Seiten; Textebene mit allen Originaltexten/Quellen und gleichem vollständigem Veröffentlichungsweg wie B |
| D | zwei Spalten, sechs Karten, Rahmen, zwei Grafiken und Messwerttabelle auf einer PDF-Seite; richtige sechs Vorschläge, Originalwerte, echte Seitendarstellung und proportionaler Ausschnitt geprüft |
| E | echtes bildbasiertes PDF ohne Text; keine erfundene Texterkennung, leere Textauswahl, ausdrücklich übernommene Bildkarte |
| F | defekte Dateien/.doc, Kompressionsmuster, aktiver Word-Part, Medienüberschreitung, echte harmlose PDF-JavaScript-Aktion, Skriptzeichen und externer Verweis; Fehler/keine Fremdanfrage/unveränderter Altentwurf geprüft |
| G/H | über zwei Seiten laufender Kartentext sowie Abbruch eines 38-Seiten-PDFs; anschließend weiterhin bedienbarer Editor |

Der separate Prüfer unter `browserpruefung/` importiert keinen Anwendungscode und liest PNG-Daten mit Node-zlib und SHA-256 selbst. Originalmanifest und echte Download-Dateien dienen als Vergleich. Zusätzlich liest ein zweiter Parser (`python-docx`, Skript `word-original.py`) die tatsächlichen Worddateien und vergleicht alle Originalabsätze/Quellen, Tabellenzellen und eingebetteten Bildbytes unabhängig von Mammoth. Das ist eine getrennt ausführbare Blackbox-Prüfung derselben erstellenden KI; eine unabhängige menschliche oder externe KI-Abnahme wird nicht behauptet.

## Im Test gefundene und behobene Probleme

1. Die Lizenzzusammenstellung verwendete zunächst das Arbeitsverzeichnis für die Lockdatei. Der vorhandene Test mit einem isolierten Buildverzeichnis deckte das auf. Die Pfade werden jetzt relativ zum Skript aufgelöst; der ursprüngliche Größen-Test bleibt unverändert.
2. Ein Hinweis innerhalb des Titelfeld-Labels veränderte dessen zugänglichen Namen. Der zusätzliche Ersatztest fand das. Der Hinweis steht nun außerhalb des Labels und ist über `aria-describedby` zugeordnet.
3. Die vorsichtige PDF-Kartenerkennung akzeptierte anfangs Uhrzeiten wie `08:00` als nummerierte Überschriften. Der zusätzliche Originalvergleich des komplexen PDFs zeigte neun statt sechs Vorschläge. Hinter einem bloßen Nummern-Trennzeichen ist jetzt Leerraum oder das Textende nötig; Uhrzeiten und Dezimalwerte bleiben Kartentext. Ein Daten- und echter PDF-Browsertest sichern das ab. Beim erweiterten Originalvergleich wurde außerdem die letzte Tabellenspalte falsch in die rechte Textspalte einsortiert: Die Trennlinie lag zwischen den Überschriftsanfängen und damit innerhalb der linken Spalte. Sie liegt jetzt vor dem rechten Spaltenanfang im Zwischenraum. Sämtliche Originalwerte werden bei der richtigen Karte geprüft.
4. Mammoth behandelt Fehler seiner Bildkonverter intern als Warnungen. Die neu erzeugte Datei mit sieben 4-Megapixel-Bildern machte sichtbar, dass eine Gesamtgrenzenüberschreitung dadurch eine gekürzte Vorschau erlaubte. Ein festgehaltener Gesamtgrenzenfehler wird nach Mammoth erneut ausgelöst; der gesamte Import scheitert verständlich und atomar. Der strenge Test wurde beibehalten.

Die vollständigen vorherigen Gesamtläufe und die endgültigen Ergebnisse sind getrennt abgelegt. Die Fehlversuche sind keine bestandenen Abnahmen.

## Testbefehle und Ergebnisse

Die vollständigen Befehle, Ausgaben, Browserinformationen, Download-Dateien und Screenshots liegen unter `pruefnachweise/`. Die unveränderten Einzeldateien wurden über einen ausschließlich lokalen Prüfserver geladen und danach bei abgeschaltetem Browsernetzwerk geprüft. Ein zusätzlicher direkter `file://`-Versuch scheitert in dieser Umgebung an `ERR_BLOCKED_BY_ADMINISTRATOR`; das ist kein bestandener Dateiaufruf. Der direkte Dateiaufruf auf Mac/iPad bleibt daher ausdrücklich offen. Arbeitsverzeichnisse in menschenlesbaren Protokollen wurden für die portable Lieferung neutralisiert; Programmcode und Produktionsdateien sind unverändert.

```sh
npm ci --cache /tmp/mysteryboard-document-import-npm-cache
npm audit --omit=dev --json
npm audit --json
CLASSROOM_SCORM=1 \
  AUTHORING_EXAMPLES_DIR=/tmp/mysteryboard-import-downloads \
  PRINT_EXAMPLES_DIR=/tmp/mysteryboard-import-print \
  INTEGRATION_EXAMPLES_DIR=/tmp/mysteryboard-import-integration \
  npm run check
npm run test:rc2
npm run package:universal
python3 scripts/validate-scorm.py \
  artifacts/MysteryBoard-Universal-SCORM-1.2.zip \
  artifacts/MysteryBoard-Universal.html MysteryBoard-Universal-v3
```

Die Ausgabeordner können frei gewählt werden; die Namen in den Protokollen entsprechen dem tatsächlichen Lauf. `npm run check` enthält sämtliche Vitest-Tests, TypeScript/Produktionsbuild, Testbuilds und die gesamte Playwright-Suite. Abgedeckt sind bestehende R1/R1b-/verspätete Klick-/Mehrfingertests, Pan/Pinch/Drag, Nummern/Startablage, Karten-/Hilfeeditor, PNG-/QR und neue Sitzung, SCORM-/Versionsschutz, A4/A3-Druck sowie 60 Karten/220 Verbindungen und manipulierte Mystery-Dateien.

**Bestanden: 117 Datentests in 18 Dateien, 188 Chromium-Browsertests (173 bestehende und 15 neue), vier zusätzliche eingefrorene RC2-Tests sowie zwölf Prüfgruppen des separaten Blackbox-Prüfers.** Die endgültige Ergebnisübersicht steht in `pruefnachweise/RESULTS.json`. Die Sammelroutine `scripts/collect-document-import-evidence.py` bricht bei einem fehlgeschlagenen Gesamtlauf, unvollständigen Mindestzahlen oder einer anderen als der tatsächlich geprüften HTML-Prüfsumme ab.

Für die Prüfung der tatsächlich entpackten Lieferung:

```sh
cd browserpruefung
npm ci
npx playwright install chromium
npm test
node benchmark.mjs ..
```

Für den Build aus der tatsächlich entpackten vollständigen Projektvorlage:

```sh
sh qa/document-import/cold-build.sh
```

Das Skript installiert aus der Lockdatei, validiert echte importierte Word-/PDF-Ergebnisse, erzeugt eine neue Mystery-Datei über den bestehenden CLI-Weg, baut und verpackt HTML/SCORM und vergleicht beide bytegenau mit den mitgelieferten Referenzen. Keine Verbindung zum ursprünglichen Checkout und keine vorhandenen `node_modules` sind nötig. Die Quellvorlage enthält sämtliche Programm-/Testdateien, Originaldokumente, vollständige Protokolle und aktuelle Downloadbeispiele einschließlich Schüler-PNGs. Doppelte aktuelle Screenshotkopien werden dort aus Platzgründen weggelassen; alle neuen Screenshots befinden sich im vollständigen Abnahmepaket. Die erstmalige Installation von Prüf-/Buildwerkzeugen benötigt Paketquellen; die fertige Anwendung und ihre Dokumentverarbeitung benötigen diese nicht.

## Größe, Startzeit und Speicher

Konkrete endgültige Größen/Prüfsummen stehen in `pruefnachweise/artifact-integrity.json` und in den SHA-256-Verzeichnissen der Lieferung. Alle neu gebauten Einzel-HTMLs werden gegen die unveränderte Grenze **unter 10.000.000 Bytes** geprüft. Die neue Universal-HTML umfasst **5.562.510 Bytes**, die Vergleichsversion **818.650 Bytes**. SHA-256 der neuen HTML: `8fdd8fe9b960a14fa40baf2e9b8699f8fa22ad8eaf3fd5c44a62719eb515e40f`. Das Universal-SCORM umfasst **2.778.623 Bytes**, SHA-256 `17c5f153095c7524dc0de55eace7896df0c6a950a8f5537cf355300ee165b814`. Die Anwendung bleibt eine einzige Offline-Datei; es gibt kein stillschweigend notwendiges Zusatzpaket.

Der Benchmark führt je Version fünf frische Chromium-Kontexte aus. Er misst die Zeit bis zum benutzbaren Universal-Einstieg, V8-Heap und separat erfassten Backing-Storage sowie einen echten Word-Import. Die vollständigen Einzelmessungen stehen unter `pruefnachweise/benchmark/`. Gemessen wurden im Median **402 ms** bis zum benutzbaren Einstieg bei der Vergleichsversion und **631 ms** bei der Importversion (**+229 ms**). Der benutzte Haupt-V8-Heap lag bei **3.720.268 / 3.725.100 Bytes**; der separat erfasste Backing-Storage wuchs von ungefähr **1,14 auf 10,23 MB**. Die geringe Heapdifferenz allein würde den zusätzlichen Speicherbedarf deshalb unterschätzen. Der Word-Import B benötigte **1.361 ms** bis zur Prüfung; der Worker zeigte etwa **6,83 MB** benutzten V8-Heap und **9,54 MB** Backing-Storage. Vor Dateiauswahl und nach Schließen: **null Parser-Worker**. Die Hauptseite behält die eingebetteten Programmdaten. Die Ergebnisse gelten für Cloud-Linux/Chromium mit seinen Schwankungen, nicht für M1, Safari oder verwaltete iPads. Ein schnellerer/gleich schneller Schülerstart wird nicht behauptet: Die größere HTML erhöht Lese-/Startaufwand, auch wenn kein Parser startet. V8-Heapwerte sind keine vollständige Prozess-RAM-Messung.

## Unveränderter Boden-RC2 und offene Abnahme

`artifacts/MysteryBoard-Boden-Klasse11.html` und `MysteryBoard-Boden-Klasse11-RC2.html` bleiben jeweils 459.542 Bytes mit SHA-256 `21dd6ad5c813ba5bd12ca521f03602a195ccea44ee70769119280e4ca088fd5f`.

Das eingefrorene RC2-SCORM behält SHA-256 `42ac3d51e2e34431efe9b0ca9b0f4e84085d9b651e4fac6747d843bf6091c3a0`. Der Schutzlauf vergleicht die Dateien zusätzlich direkt mit dem Ausgangscommit. Es werden keine RC2-Dateien neu erzeugt oder veröffentlicht.

Noch offen bleiben:

- Echter Safari-/verwalteter Schul-iPad-Test mit DOCX und PDF, Download-/Dateiauswahl, Worker/WASM/OffscreenCanvas, Speicherbelastung und Abbruch. Ohne diese Geräte keine schulische Freigabe.
- WebKit 26.5 nicht verfügbar; der dokumentierte Startversuch mit WebKit 27.2 scheitert an fehlenden Systembibliotheken. Daraus entsteht kein WebKit-Erfolg.
- Reale itslearning- und gegebenenfalls Canva-Veröffentlichung/Einbettung, verwaltete Dateiberechtigungen und reale native Safari-Druckausgabe.
- Fachliche Prüfung sämtlicher importierter Karten am Original. Word-Layout und komplexe PDF-Lesereihenfolgen sind keine universell fehlerfreie Rekonstruktion. Rahmen werden angezeigt, aber nicht durch einen geometrischen Layout-Detektor fachlich interpretiert. PDF-Tabellen bleiben Text oder ausdrücklich gewähltes Bild, bis eine Lehrkraft sie manuell strukturiert.
- OCR, automatische semantische Kartenerkennung, passwortgeschützte Dokumente, verlustfreie Rekonstruktion beliebiger Word-Objekte und jede automatische Veröffentlichung sind nicht Bestandteil dieser Phase.

Die Importfunktion liefert geprüfte Vorschläge für die vorhandene universelle Architektur. Die Lehrkraft entscheidet über Inhalte und Schülerversion; Geräte-/LMS-Abnahmen werden nicht vorweggenommen.
