# MysteryBoard: Dateiimport im Editor und aufgabenspezifisches SCORM

Prüfung vom 16. November 2026. Ausgangsstand: `38ba0a77ac1f2b8d667f5185724ee4933d159d1a`, Branch `feat/mysteryboard-minimal-start`. Änderungen ausschließlich auf `feat/mysteryboard-classroom-scorm-export`. Der genaue Quellcommit der Lieferung steht in `VERSION.json`; Dateigrößen und SHA-256 stehen in `ERGEBNIS.json`, `PRUEFSUMMEN.json` und `SHA256SUMS.txt`.

## Ergebnis und Umfang

Der Editor verwendet einen gemeinsamen Datei-Einstieg für Drag-and-Drop und die native Dateiauswahl. `.mysteryboard`-Aufgaben öffnen direkt als bearbeitbarer Entwurf, ohne Schüler-Zwischenansicht. Entwürfe bleiben einschließlich ihrer Autorenmetadaten erhalten; die Inhaltsversion wird beim Öffnen nicht erhöht. Word/PDF öffnen denselben bestehenden Importassistenten. Original-Aufgaben-PNGs werden weiterhin gelesen. Schülerstände gehören zum bestehenden Fortsetzen-Einstieg.

Im Veröffentlichungsdialog stehen die Aufgaben-Datei, der neue itslearning-SCORM-Export und die bestehende Aufgaben-PNG zur Verfügung. Das lokal erzeugte Unterrichts-ZIP startet automatisch die darin enthaltene Aufgabe mit Teamabfrage. Die Blankovorlage bleibt beim minimalistischen Drei-Schaltflächen-Start und bietet den Editor weiterhin an.

Die beiden gelieferten Unterrichtspakete wurden im echten Chromium-Browser erzeugt und heruntergeladen, nicht nachträglich aus einer vorgefertigten CLI-Aufgabe gebaut. Es handelt sich um neutrale technische Beispiele mit zwölf beziehungsweise fünf Karten, keine fachliche Musterlösung. Beide stammen aus derselben geöffneten Editor-Sitzung und wurden dort nacheinander bearbeitet und veröffentlicht.

## Technische Änderungen

- **Import:** Zuvor öffnete der allgemeine Dokumentimport Aufgaben zunächst im Schülerplayer; Word/PDF hatten einen gesonderten Einstieg. `src/core/document-file.ts` bündelt jetzt den bestehenden Worker-Dokumentvalidator, die 30-MB-Grenze, die 15-Sekunden-Prüffrist und den echten Bilddecoder für beide Modi. Der neue Dateibereich in `AuthorEditor.tsx` nimmt genau eine Datei an. Ein validiertes Ergebnis ersetzt den bisherigen Entwurf erst nach der ausdrücklich notwendigen Bestätigung bei ungesicherten Änderungen. Abbruch beendet den Worker; verspätete Ergebnisse werden verworfen. Formulare und bereits geöffnete Arbeitsschritte werden durch Drops nicht stillschweigend ersetzt.
- **Vorhandenes Mystery öffnen:** Der Lehrerzugang führt nach Eingabe des Kürzels unmittelbar in den Editor-Dateidialog. Der Schülerimport verwendet unverändert seine eigenen Aufgaben-/PNG-Einstiege und denselben Validator.
- **Word/PDF:** `DocumentImport.tsx` erhält lediglich einen optionalen anfänglichen Dateiparameter. Parser, Vorschläge, Bild-/Tabellenprüfung und die ausdrückliche Übernahme bleiben im bisherigen Assistenten.
- **SCORM-Verpackung:** `src/core/scorm-package.ts` wird vom bisherigen Node-Packager und vom neuen Browser-Worker verwendet. Die ZIP enthält genau `imsmanifest.xml`, `launch.html`, `session.js`, `app.html`. XML-Titel werden maskiert. Alle Produktions-HTMLs müssen einschließlich der Aufgabe kleiner als 10.000.000 Bytes sein. Eine Überschreitung bietet kein ZIP an und lässt Entwurf und Aufgaben-Dateiexport nutzbar.
- **Sichere Einbettung:** `launch-document.ts` kodiert ausschließlich eine durch `publishDraft()` erzeugte Aufgabe im unveränderten Dokumentformat 3 als Base64 in einem nicht ausführbaren JSON-Script. Kartentexte mit schließenden Script-Tags bleiben Text. Beim Start prüft der bestehende Dokumentvalidator erneut die Aufgabe; Entwürfe oder Schülerstände als Startpayload werden abgelehnt.
- **Gleicher Player:** `classroom-scorm.ts` übernimmt ausschließlich den anfänglich erfassten Produktionscode, Styles, Metadaten und Lizenzhinweise. Der aktuelle React-DOM, Formulare, Autorenvorschau und frühere Aufgaben-Startdaten werden nicht serialisiert. Browsertests vergleichen den kompletten JavaScript-Modultext bytegenau mit dem erzeugenden Player. Der Export läuft in einem abbrechbaren lokalen Worker mit Zeitgrenze.
- **Erneuter Export:** Aufgabenspezifische CLI-Builds enthielten ihre ursprüngliche Aufgabe bisher im JavaScript. `scripts/embed-task.mjs` legt sie jetzt separat im gleichen inerten JSON-Platzhalter ab. So kann ein späterer Browserexport einer anderen Aufgabe nicht die frühere Aufgabe im Programmcode mitschleppen. Der CLI-Build verwendet ausdrücklich den Produktionsmodus, nachdem der Validierungsserver geschlossen wurde. Die bestehenden CLI-Dateien bleiben im Editor bearbeitbar.
- **Unterrichtsmodus:** `UniversalApp.tsx` blendet Lehrer- und universelle Startnavigation aus. Der bestehende `App`-Player, Board, Dialoge, PNG-Sicherung, History und Hilfen werden unverändert verwendet. Dies ist eine UI-Trennung, keine Zugriffskontrolle.

Keine Änderung an Datenmodell, Schemas, Karten-/Verbindungsmechanik, Touch-Gesten, History, PNG-/QR-Codec, Hilfeeditor oder Druck. Keine neue Abhängigkeit, kein Serverdienst und keine automatische dauerhafte Speicherung. `scorm/launch.html` und `scorm/session.js` sind unverändert. Nur die bisherigen `LMSInitialize("")`/`LMSFinish("")`-Sitzungsaufrufe bleiben bestehen; keine Lerndatenaufrufe.

## Testablauf und Nachweise

Die vollständigen Befehlsausgaben befinden sich unter `pruefprotokolle/`. Die neuen Tests stehen in `tests/classroom-scorm.test.ts` und `tests/browser/classroom-scorm-export.spec.ts`.

```sh
npx tsc --noEmit
npm test
npm run build:universal
node scripts/prepare-universal-tests.mjs

CLASSROOM_SCORM=1 \
CLASSROOM_EXPORT_DIR=/workspace/mysteryboard-classroom-scorm-examples \
AUTHORING_EXAMPLES_DIR=/workspace/mysteryboard-classroom-scorm-examples \
PRINT_EXAMPLES_DIR=/workspace/mysteryboard-classroom-scorm-examples \
INTEGRATION_EXAMPLES_DIR=/workspace/mysteryboard-classroom-scorm-examples \
  npm run check

npm run test:rc2
python3 scripts/validate-scorm.py \
  artifacts/MysteryBoard-Universal-SCORM-1.2.zip \
  artifacts/MysteryBoard-Universal.html MysteryBoard-Universal-v3
python3 qa/classroom-scorm/verify-delivery.py \
  /workspace/mysteryboard-classroom-scorm-delivery \
  /workspace/mysteryboard-classroom-scorm-examples
```

Die Ausgabeverzeichnisse können frei gewählt werden. `npm run check` umfasst alle Datentests, TypeScript, Produktionsbuilds und die gesamte Chromium-Browsersuite. Die eingefrorene RC2 wird separat gegen ihre tatsächlichen HTML-/ZIP-Bytes getestet. **Ergebnis des vollständigen Laufs: 134 Datentests und 210 Chromium-Browsertests bestanden, ohne Fehler oder übersprungene Fälle. Zusätzlich alle vier eingefrorenen RC2-Tests bestanden.** Damit bleiben die bisherigen 130 Daten- und 201 Browserfälle erhalten; hinzu kommen vier Daten- und neun Browserfälle. Der Chromium-Gesamtlauf dauerte 18,1 Minuten. Einzelheiten stehen im beiliegenden `ERGEBNIS.json` und am Ende der vollständigen Protokolle.

Die neun neuen Browserfälle prüfen:

1. Bei **1024 × 768, 768 × 1024, 600 × 800 und 320 × 700 CSS-Pixeln** jeweils zwei aufeinanderfolgende Aufgaben-Drops, unmittelbare Bearbeitbarkeit, unveränderten Inhalt/Hash/Version nach dem Öffnen, Kartenänderung und Hilfeänderung.
2. Den tatsächlichen ZIP-Download, CRC-Prüfung zusätzlich mit Pythons unabhängigem ZIP-Leser, SCORM-1.2-Manifest und lokale Dateiverweise; identischen Player-Modultext und Wrapperbytes, erhaltene Lizenzhinweise und HTML-Größe.
3. Entpacken in ein neues Verzeichnis, echter Start von `launch.html` mit simulierter LMS-API, richtige Aufgabe ohne Aufgabenimport, Teamabfrage und ausgeblendeten Lehrerzugang.
4. Reale Touch-Kartenbewegung und Pinch per Chromium-CDP, beschriftete Verbindung, Undo/Redo, Darstellung des bearbeiteten Textes als Text und des originalen Bildes, geänderter Denkimpuls.
5. Herunterladen einer echten PNG mit vollständigem Schülerdokument, neue Browser-/SCORM-Sitzung, Import genau dieser PNG, vollständiger Snapshotvergleich einschließlich Aufgabe, Team, Kartenpositionen, Farben, Kategorien, Beziehungen und Ansicht; anschließend eine weitere Verbindung. Zwölf und fünf Karten werden jeweils vollständig wiederhergestellt.
6. Keine externen Netzwerkanfragen; keine lokalen/sessionbezogenen Speichereinträge; ausschließlich Initialize/Finish an der simulierten LMS-API.
7. Beschädigte JSON-Datei, mehr als 30 MB, gültiger Bildkopf mit beschädigten Bilddaten, Mehrfachdrop, verspätetes Dateilesen nach Abbruch, abgelehnte und bestätigte Ersetzungsabfrage. Ein importierter Lehrkraftentwurf wird unverändert wieder exportiert; ausgeblendete Karten und Autorenmetadaten gelangen nicht in das Schülerpaket.
8. Word-Drop und PDF-Dateiauswahl öffnen denselben Assistenten. Dessen Abbruch erhält den Entwurf.
9. Eine mit echten gültigen Bildern erzeugte zu große Unterrichts-HTML wird abgelehnt; der vollständige Aufgaben-Dateiexport bleibt verfügbar. Ein erneuter SCORM-Export aus einem aufgabenspezifischen CLI-Build enthält ausschließlich die neue Aufgabe.

Die bestehende Regression deckt zusätzlich die bisherigen zwölf/60 Karten, Medien, Tabellen, Quellen, Split/Merge, Hilfekategorien, Startablage, PNG-Grenzfälle, History, Druck und Touch-Sicherheitsfälle ab. Kein vorhandener Test wurde entfernt, übersprungen oder abgeschwächt. Navigationserwartungen in den bestehenden Tests und eigenständigen QA-Skripten wurden an den nun ausdrücklich auszuwählenden Dateiexport und den direkten Editorimport angepasst; die Daten- und Sicherheitsassertionen bleiben erhalten beziehungsweise wurden ergänzt. `test-preservation.json` dokumentiert Anzahl und Änderungen.

Der unabhängige Standardbibliothek-Prüfer `qa/classroom-scorm/verify-delivery.py` importiert weder Anwendungscode noch deren Codec. Er liest die echten ZIPs, XML-Manifeste und JSON-Startdaten, vergleicht Player und Wrapper, prüft alle CRCs und entpackt Schüler-PNG-Daten selbst mit SHA-256-Prüfung. Für alle acht Aufgaben-/Viewportkombinationen vergleicht er vollständige Original-, PNG- und Wiederherstellungsdokumente und bestätigt das Weiterarbeiten.

Der erste Entwicklungsversuch und der erfolgreiche Wiederholungslauf sind gesondert protokolliert. Dabei wurde ein Fehler im leeren, formatierten JSON-Platzhalter erkannt: Leerzeichen um `null` führten zum Fehlerbildschirm. Der Startleser behandelt diese jetzt korrekt; ein eigener Datentest schützt den Fall. Weitere frühe Testfehler betrafen den tatsächlichen Namen „Fortsetzen“ im Aufgabenstart und die ausdrücklich zu bestätigende Assistenten-Schließabfrage. Diese Tests wurden am vorhandenen Ablauf berichtigt.

## Produktionsdateien

| Datei | Bytes | SHA-256 |
| --- | ---: | --- |
| MysteryBoard-Fuenf-Spuren-SCORM-1.2.zip | 2818670 | `1dfe4759ee59376dc0c090bc44f5c9b8953d6e632a0cffb7f3bacea46efa5e91` |
| MysteryBoard-Universal-SCORM-1.2.zip | 2787939 | `ac80fdd8e6c3de441e40e805079343f937108a3a847cb5dbe5b8f0a8ee3c593a` |
| MysteryBoard-Universal.html | 5583930 | `bdff8ca1f6e51b4ce26b5fc1d70cb425770ebc38668822f0f40b50423fd492ee` |
| MysteryBoard-Zwoelf-Beobachtungen-SCORM-1.2.zip | 2818910 | `b3aea4eaf3c14462c513ae17c364250fd862d5776ebec68d0cbc2490d4d2bf74` |

## Grenzen und offene Abnahmen

- Geprüft mit **Chromium 156.0.8078.79**, Node 24.22.1 und Playwright 1.65.0 unter Linux. Touch-Emulation ist kein echter Schul-iPad-Test.
- **WebKit 26.5:** nicht installiert. **WebKit 27.2:** installiert, aber Start scheitert an fehlenden Hostbibliotheken, zunächst `libharfbuzz-icu.so.0`. Keine erfolgreiche WebKit-Abnahme behauptet; tatsächlicher Startfehler steht in `webkit-availability.json`.
- Die Cloud-Richtlinie sperrt Chromium-Navigation zu `file://`. Browserprüfungen laden ausschließlich die tatsächlichen Produktions-/ZIP-Dateien über einen lokalen Testserver; anschließend wird die Verbindung offline geschaltet. Es werden keine externen Anwendungsressourcen benötigt. Das direkte Öffnen heruntergeladener Dateien unter macOS/Safari und die verwaltete iPad-Dateiauswahl bleiben echte Geräteprüfungen.
- **itslearning:** nur simulierte SCORM-1.2-API getestet. Der echte Ressourcenimport und Schülerstart im verwendeten Kurs bleiben offen. LMS-Oberfläche und Berechtigungen können abweichen.
- **Safari/Schul-iPad:** Dateidialog, Downloads/Teilen, große Medien, Gesten, PNG-Sicherung und Wiederherstellung in einer neuen Sitzung sowie native Druckfunktion real prüfen.
- Keine dauerhafte Ablage durch ZIP-Erzeugung bewiesen. Keine schulische Freigabe. Kein Merge in `main`, kein Release und keine Pages-Veröffentlichung. Fachliche Karten und eingefrorene Boden-RC2 bleiben unverändert.

Die Anleitung `UNTERRICHTS-SCORM-ANLEITUNG.md` beschreibt die Bereitstellung für Lehrkräfte. Das Abnahmepaket enthält die tatsächlichen Browserdownloads, Beispiel-Schülerstände, Originalimportdateien, Screenshots, Quellprojekt und vollständigen Testprotokolle; eigene SHA-256-Listen sichern jeden Eintrag ab.
