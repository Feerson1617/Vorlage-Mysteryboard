# Dokumentimport: Nacharbeit zu Datenintegrität und tatsächlicher Lieferung

15. November 2026. Repository: `Feerson1617/Vorlage-Mysteryboard`. Ausgangscommit: `8418a445248893c2ba01bea673d84febcdf36537`. Ausschließlicher Arbeitsbranch: `feat/mysteryboard-document-import-integrity`. Hauptbranch, vorheriger Importbranch und eingefrorene Boden-RC2 bleiben unverändert. Keine neue Laufzeitabhängigkeit, kein Merge, kein Pages-Deployment.

Der endgültige **Quellcommit** steht in `QUELLSTAND.json` des Abnahmepakets und `PROJECT-VERSION.json` der Projektvorlage. Ein anschließender **Liefercommit** legt ausschließlich die fertigen ZIPs, Prüfsummen und Schlussnachweise unter `artifacts/delivery/document-import-integrity/` desselben neuen Branches ab. Dieser zweite Commit verändert keinen Anwendungscode. Dadurch lassen sich die wirklichen Dateien über commitgebundene HTTPS-Links herunterladen. Die Archive enthalten ihre eigenen Quelldaten und entryweisen SHA-256-Verzeichnisse; die Projektvorlage enthält keine rekursiven Kopien ihrer eigenen Liefer-ZIPs.

## P1: Fehler reproduziert und korrigiert

Die unveränderte gebaute HTML des Ausgangsstands wurde in Chromium tatsächlich ausgeführt. Nach Import von Word B wurde der erste Kartentext bewusst auf `Material 1` gesetzt, bei Zeichenposition 7 geteilt und unmittelbar wieder zusammengefügt. Sowohl die sichtbaren Felder als auch die **wirklich heruntergeladene** `.mysteryboard`-Datei enthielten:

```text
Text:   Materia\n\nl 1
Quelle: Eigene technische Vorlage B1.\nEigene technische Vorlage B1.
```

Ursache: `split()` kopierte die Quelle auf beide Hälften. `mergeImported()` behandelte diese anschließend wie eigenständige Karten, fügte Absatztrenner ein und hing beide Quellen aneinander. Die bisherigen End-to-End-Tests verglichen ursprüngliche Quellen vor der Teilung, prüften danach jedoch überwiegend den Gleichstand zwischen einer bereits fehlerhaften Entwurfsdatei und ihren Folgeexporten. Deshalb konnten sie den Originalitätsfehler nicht erkennen. Diese Prüflücke ist jetzt geschlossen; alte Protokolle sind keine Abnahme dieser Korrektur.

Die Korrektur bleibt im bestehenden Importassistenten:

- `splitImported()` merkt sich zusammengehörige Hälften und den Originalzustand in einer flüchtigen `WeakMap`. Das bestehende Kartenmodell wird weiterverwendet. Kein zusätzlicher Schlüssel gelangt in eine Mystery-Datei, kein Browser-/LMS-Speicher wird benutzt.
- `canRejoinImported()` prüft den tatsächlichen Teilungszusammenhang und alle unveränderten Felder einschließlich Tabellenzellen. Unveränderte Hälften werden durch `mergeImported()` exakt auf die ursprüngliche Karte zurückgesetzt. Wörter, Leerzeichen, Absatzumbrüche, Quelle, Bild, Bildbeschreibung, Tabelle und Pflicht-/V-Gruppe bleiben erhalten. Auch verschachtelte unveränderte Teilungen sind rücksetzbar.
- Inhaltliche Änderungen, eine andere Nachbarkarte oder eine nicht mehr eindeutige Zuordnung lösen die normale Zusammenführung aus. **Vorher** wird ausdrücklich gefragt: Texte werden durch Absätze verbunden, die zweite Überschrift bleibt als Text erhalten, die gemeinsame Karte verwendet die Gruppe der ersten Karte. Abbrechen ändert nichts. Eine automatische Rekonstruktion aus bloß ähnlichem Text wird nicht versucht.
- Bei normalen Zusammenführungen werden identische vollständige Quellenblöcke einmal übernommen, unterschiedliche Quellenblöcke in ihrer ursprünglichen Schreibweise erhalten. Unterschiedliche Beschreibungen desselben Bildes und passende Tabellenüberschriften bleiben ebenfalls erhalten. Verschiedene Bilder oder inkompatible Tabellen werden weiterhin abgewiesen. Zu lange zusammengeführte Bild-/Tabellenbeschreibungen führen zu einer verständlichen Ablehnung. Keine stillen Medien-/Tabellenverluste oder Kürzungen.
- Bereits zuvor fehlerhaft ausgegebene Dateien werden nicht anhand einer Vermutung umgeschrieben. Für diese Inhalte ist ein erneuter Import beziehungsweise Vergleich mit dem Original nötig. Die neue Lieferung enthält frisch erzeugte, geprüfte Beispiele.

Betroffene Anwendungssourcen: `src/core/document-import/model.ts` und `src/components/DocumentImport.tsx`. Schülerplayer, Board-/Touchcode, Datenformat 3, PNG-/QR-Sicherung, ID-Verwaltung, History, Export und Druckkern sind unverändert.

## Tests der Datenintegrität

Die zusätzlichen Datentests prüfen exakte Rücksetzung am Wortzwischenraum, mitten im Wort, vor/im/nach Absatzumbruch sowie mit Bild/Bildbeschreibung, Messwerttabelle, mehrzeiligem Quellentext und V-Karte. Hinzu kommen unterschiedliche Quellen/Tabellenbeschriftungen, verschachtelte Teilungen, veränderte Hälften beziehungsweise Tabellen, gleich aussehende eigenständige Karten und nicht verlustfrei vereinbare Medien.

Vier neue reale Browsertests führen die Kombinationen bei **1024 × 768, 768 × 1024, 600 × 800 und 320 × 700** durch. Sie speichern den Entwurf, vergleichen alle betroffenen Felder sowie die Originalbildbytes und Tabellen mit der Ausgangsdatei, schließen die Sitzung, öffnen den Entwurf neu und prüfen die anschließend heruntergeladene Aufgaben-Datei. Ein fünfter Test prüft Warnung/Abbrechen und anschließend bestätigte Zusammenführung verschiedener eigenständiger Karten samt beiden Quellen und vollständiger Tabelle im echten Download.

Die bisherigen zehn Word-/PDF-Workflows wurden **verstärkt**: Originaltext und Quelle müssen nach Split/Merge sowie im tatsächlichen Entwurfs-/Aufgaben-Download exakt erhalten sein. Kein bisheriger R1/R1b- oder Boden-RC2-Test wurde abgeschwächt oder entfernt.

## P2/P3: Aktuelle Bytes, alle Fälle und zwei Inhaltsversionen

Das Abnahmepaket enthält die tatsächlich geprüfte aktuelle Universal-HTML und eine SCORM-ZIP mit bytegleicher `app.html`. Sämtliche echten Original-/Referenzdateien A–H und ihre Quelldaten sind enthalten. Der eigenständig ausführbare Prüfer unter `browserpruefung/` importiert keinen Anwendungscode; er startet eigene lokale Prüfserver, lädt die gelieferten HTML-/SCORM-Bytes und arbeitet nach dem Laden mit abgeschaltetem Browsernetzwerk.

Für **Word B und PDF C** laufen bei 1440 × 1000 sowie allen vier geforderten Ansichten:

1. Originalvergleich sämtlicher Texte, Titel, Quellen, Gruppen und Word-Tabellenzellen; Word-Originalbilder zusätzlich bytegenau vergleichen.
2. Exakter Split/Merge, Ergänzen/Löschen, Bild-/Tabellenkorrektur und Pflicht-/V-Zuordnung, Hilfekonfiguration.
3. Tatsächlichen Entwurf herunterladen, neue Sitzung, Aufgabe herunterladen und vollständig vergleichen.
4. Eine Kartenangabe bewusst ändern und **zweiten Entwurf und zweite Aufgabe** mit derselben Mystery-ID und neuer Inhaltsversion herunterladen. Beide Fassungen bleiben getrennte Dateien.
5. Die echte SCORM-App öffnen; Teamname, Touch-Verschieben, Pinch, Pfeilverbindung, Rückgängig und Wiederholen. Undo entfernt die Verbindung; Redo stellt den vollständigen vorherigen Arbeitsstand wieder her.
6. A4 und A3 als echte PDFs aus dem vorbereiteten Anwendungs-Druckinhalt erzeugen. Das Papierformat wird geprüft; alle zwanzig PDFs werden zusätzlich mit `pdfinfo` und `pdftotext -raw` auf Format, erste Originaltexte und genau eine erste Quelle kontrolliert. Der Raw-Modus erhält die Zeichenreihenfolge des PDF-Inhaltsstroms, statt parallele Druckspalten zeilenweise miteinander zu mischen; diese Chromium-PDF-Ausgabe ist keine native Safari-Druckabnahme.
7. Original-PNG bewusst herunterladen, in neuer SCORM-Sitzung vollständig wiederherstellen und weiterarbeiten.
8. Inhaltsversion 2 separat in SCORM öffnen; anschließend die alte Version-1-PNG einlesen und ihren vollständigen ursprünglichen Inhalt/Arbeitsstand nachweisen. Keine Mischung der beiden Fassungen.

A wird als echte Worddatei mit zwölf Karten und V3/V8/V12 verglichen. D prüft beide Spalten, sechs Karten, Quellen und sämtliche Tabellenwerte mit tatsächlicher Seitenansicht; der vorhandene Browsertest prüft zusätzlich den proportionalen Ausschnitt. E bleibt ein Bild-PDF ohne vorgetäuschte OCR. G wird tatsächlich über zwei Seiten gelesen und als Entwurf mit dem vollständigen fortgesetzten Text geprüft. Fehlerfälle F und Abbruch H erhalten den vorhandenen A-Entwurf exakt. Der zweite Word-Parser `python-docx` bestätigt separat Originaltexte, Quellen, Tabellenzellen und Bildbytes der Ausgangs-DOCX-Dateien.

Der separate Prüfer wurde von derselben erstellenden KI geschrieben. Er ist unabhängig startbar und verwendet keinen Anwendungscode; eine externe menschliche oder fremde KI-Abnahme wird daraus nicht behauptet.

## Befehle und frische Ergebnisse

```sh
CLASSROOM_SCORM=1 \
  AUTHORING_EXAMPLES_DIR=/tmp/mysteryboard-integrity-downloads \
  PRINT_EXAMPLES_DIR=/tmp/mysteryboard-integrity-print \
  INTEGRATION_EXAMPLES_DIR=/tmp/mysteryboard-integrity-integration \
  npm run check
npm run test:rc2
python3 scripts/validate-scorm.py \
  artifacts/MysteryBoard-Universal-SCORM-1.2.zip \
  artifacts/MysteryBoard-Universal.html MysteryBoard-Universal-v3
```

Die tatsächlichen Ausgabeverzeichnisse des frischen Laufs stehen im Protokoll. **Bestanden: 130 Datentests in 19 Dateien, 193 Chromium-Browsertests (188 bestehende plus fünf neue Integritätstests), vier zusätzliche Boden-RC2-Tests und zwölf Prüfgruppen des separaten Paketprüfers.** Die frische Gesamtsuite lief 14,9 Minuten; die Ergebniszahlen werden in `pruefnachweise/RESULTS.json` festgehalten. Vollständige Konsolenprotokolle und alle Test-/Schrittdatensätze aus Playwright werden mitgeliefert; aktuelle Download-Dateien und Screenshots sind direkt enthalten. Die als `reproduktion/VORHER…` gekennzeichneten Dateien zeigen ausdrücklich den alten Fehler und sind keine aktuellen Schüleraufgaben.

Ein erster Zusatztestlauf gegen die noch alte HTML bestätigt den ursprünglichen Fehler. Bei der Erweiterung des Paketprüfers war außerdem dessen erster Druckselektor zu streng: `getByLabel('Papierformat', {exact:true})` fand in dieser vorhandenen Oberfläche kein Element. Der echte Druckdialog wurde separat geöffnet; sein eindeutiger zugänglicher Rollenname ist `combobox "Papierformat"`. Der Prüfer verwendet nun genau diese Rolle mit unverändert striktem Namen. Es wurde dafür kein Anwendungscode geändert und keine Druckprüfung abgeschwächt. Die Diagnose und der fehlgeschlagene Versuch sind separat enthalten.

## Entpackte Lieferung selbst prüfen

Im vollständig entpackten Abnahmepaket:

```sh
cd browserpruefung
npm ci
npx playwright install chromium
npm test
node benchmark.mjs ..
python3 word-original.py ../dateien
```

Für den optionalen zweiten Wordparser ist das kostenlose Paket `python-docx` nötig. Ein vorhandener System-Chromium wird erkannt, ein anderer Pfad kann mit `CHROMIUM_PATH` angegeben werden. Der Prüfer ist über Node/Playwright ohne manuelle Browserbedienung startbar; eine Browserengine und deren Systembibliotheken bleiben technische Voraussetzungen. Ergebnisse entstehen unter `browserpruefung/ergebnisse/`. Die ZIPs lassen sich zusätzlich mit `PRUEFUNG-ZIPS.py` in einen neuen Ordner entpacken und gegen alle Inhaltsprüfsummen kontrollieren.

Im Wurzelordner der vollständig entpackten Projektvorlage:

```sh
sh qa/document-import/cold-build.sh
```

Der Kaltstart installiert eigene Abhängigkeiten aus der Lockdatei, validiert die frisch importierten Word-/PDF-Dateien, erzeugt eine neue Mystery-Aufgabe über den vorhandenen CLI-Weg und verlangt bytegleiche HTML-/SCORM-Ausgaben. Quellcode, Tests, Originaldokumente, Protokolle und Schüler-PNGs sind enthalten. Doppelte aktuelle Screenshotkopien bleiben aus Platzgründen im vollständigen Abnahmepaket. Es gibt keine Abhängigkeit vom ursprünglichen Cloud-Checkout. Einmalige Werkzeuginstallation benötigt Paketquellen; die Anwendung und ihre Dokumentverarbeitung arbeiten offline.

## P4: Dateigröße, Start, Worker und WASM

Die aktuelle HTML bleibt unter der unveränderten Grenze **10.000.000 Bytes**. Exakte endgültige Größen, SHA-256-Werte und Quellcommit stehen in den Liefermanifesten. Die bisherigen Offline-Bibliotheken bleiben festgelegt: Mammoth 1.13.0 (BSD-2-Clause), PDF.js 6.5.438 (Apache-2.0), htmlparser2 12.0.0 (MIT), fflate 0.8.3 (MIT). Es wird kein neuer Dienst und keine neue Laufzeitbibliothek ergänzt.

Der neue Benchmark misst fünf frische Chromium-Kontexte je Referenz-/Importfassung sowie tatsächliche Word-B-, PDF-C- und PDF-D-Importe. Bei PDF wird bis zur fertigen Seitenanzeige gemessen. Haupt-/Worker-V8-Heap und **separater Backing-Storage** werden ausgewiesen; nur der Haupt-Heap würde den Bedarf der eingebetteten Programmdaten unterschätzen. Vor der Dateiauswahl und nach dem Schließen werden die Worker gezählt. Schüleraktionen starten keinen Importparser.

Die drei tatsächlich gebündelten Decoderdateien `jbig2.wasm`, `openjpeg.wasm` und `qcms_bg.wasm` umfassen zusammen **421.077 Bytes**; Größen und SHA-256 je Datei stehen im Nachweis. `quickjs-eval.wasm` ist kein Bestandteil des lokalen Ressourcenpakets. Diese Dateigröße ist keine Messung eines allokierten WASM-Speichers. Die C/D-Prüfdokumente sind kein Worst-Case-Nachweis für JBIG2-/JPEG2000-Decodierung. Die CDP-Zahlen erfassen nicht zuverlässig sämtliche nativen Canvas-/GPU-/Decoder-/Prozessspeicheranteile.

Aktuelle Messung (Chromium 156, Cloud-Linux): Referenzstart **342 ms**, aktuelle Importfassung **617 ms** im Median aus je fünf frischen Kontexten. Die Referenz ist ausdrücklich Commit 35019c3 ohne Dokumentimport, kein isolierter Vorher-/Nachher-Benchmark des P1-Patches. Haupt-V8-Heap: 3.720.260 / 3.726.476 Bytes; Backing-Storage: 1.138.792 / 10.231.545 Bytes. Der zusätzliche Datenbedarf wird damit sichtbar ausgewiesen.

| Tatsächlicher Import | Bis zur fertigen Prüfung | Worker-V8 benutzt | Worker-Backing-Storage | Worker vor Datei / nach Schließen |
| --- | ---: | ---: | ---: | --- |
| Word B | 833 ms | 6.835.028 Bytes | 9.539.532 Bytes | 0 / 0 |
| PDF C mit gerenderter Seite | 1.360 ms | 7.545.392 Bytes | 9.630.185 Bytes | 0 / 0 |
| PDF D mit gerenderter Seite | 1.335 ms | 7.671.064 Bytes | 9.682.053 Bytes | 0 / 0 |

Die aktuelle Universal-HTML umfasst **5.564.484 Bytes**, SHA-256 `55d3b4b5bc23e0e4070629a5e08488f34b685e157ead5144024a05f25183ec03`; gegenüber 8418a44 sind das 1.974 zusätzliche Bytes. Das aktuelle Universal-SCORM umfasst **2.779.368 Bytes**, SHA-256 `d603dcbec91ce0ddb57327b2c18016b6498b306995ac620c3a79f41bc65494ef`. Die komplette HTML bleibt unter 6 MB Zielgröße und unter der unveränderten harten 10-MB-Grenze.

Die vollständigen Einzelmessungen stehen unter `pruefnachweise/benchmark/`. Sie gelten ausschließlich für Cloud-Linux/Chromium. Speicherbedarf und Reaktionszeit auf echten verwalteten Schul-iPads bleiben zu messen. Weder native iPad-Druckfunktion noch Safari-/itslearning-/Canva-Freigabe werden behauptet.

## Unveränderter Schutzstand und offene Grenzen

Boden-Klasse11 und Boden-RC2 bleiben jeweils 459.542 Bytes, SHA-256 `21dd6ad5c813ba5bd12ca521f03602a195ccea44ee70769119280e4ca088fd5f`. Das eingefrorene RC2-SCORM behält SHA-256 `42ac3d51e2e34431efe9b0ca9b0f4e84085d9b651e4fac6747d843bf6091c3a0`. Die Dateien werden direkt gegen Ausgangscommit 8418a44 verglichen; alle vier zusätzlichen RC2-Tests laufen erneut.

Offen: WebKit 26.5 ist nicht vorhanden; WebKit 27.2 scheitert an fehlenden Hostbibliotheken. Der direkte `file://`-Aufruf ist auf dieser Maschine administrativ gesperrt. Die tatsächlichen Einzeldateien werden deshalb über localhost geladen und anschließend offline geprüft. Der direkte Dateiaufruf auf dem Zielgerät bleibt offen. Echte Safari-/Schul-iPad-/itslearning-/Canva-Tests, native iPad-Druckausgabe und physischer Gesamtspeicher bleiben separate Abnahmen.

OCR bleibt außerhalb dieses Auftrags. Ungewöhnliche Word-/PDF-Layouts müssen weiterhin am Original kontrolliert werden; eine universell fehlerfreie Rekonstruktion oder automatische fachliche Interpretation wird nicht behauptet. Die bisherigen Datei-/Seiten-/Mediengrenzen und der bewusste Sicherungsweg bleiben erhalten. Es gibt keine automatische Veröffentlichung, Speicherung oder LMS-Übertragung von Schülerdaten. Keine schulische Freigabe.
