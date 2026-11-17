# MysteryBoard Studio 0.2.0 – UX-Abnahme

Stand: 17. November 2026. Ausgangspunkt ist der zuletzt geprüfte Studio-Stand
`8662d74628ccbc5015fdeb8c0a553765aaa25e05`. Die Arbeit liegt ausschließlich auf
`feat/mysteryboard-studio-ux-simplification`. Kein Merge, keine Pages-Veröffentlichung,
kein öffentlicher Release. Frühere Abnahmeberichte beschreiben ausdrücklich ihre
damalige Version; dieser Bericht beschreibt die neue UX-Fassung.

Der Anwendungscode ist seit `b5788140e968e60510c85a3c9e4b49480d4ec6f7`
eingefroren. Nachfolgende Änderungen betreffen Testtreiber, Nachweise, Dokumentation
und Bereitstellung. `VERSION.json` unterscheidet Anwendungscode, tatsächlichen
Mac-Build und Paketierungscommit. Die Dateihashes in `MANIFEST.json` und
`Mac-Dateien.json` sind maßgeblich.

## Ergebnis und Abnahmegrenzen

Die vier Hauptaktionen, der zentrale Speicher-/Exportdialog und die einfache
Importkontrolle sind umgesetzt. Die erweiterten Funktionen bearbeiten weiterhin
dasselbe Dokument mit derselben Importimplementierung. Es gibt keine zweite
Importlogik und keine Änderung des Projekt-/Schülerspeicherformats.

Die automatisierten Workflows sind keine beobachtete Usability-Studie mit
Lehrkräften. Aus ihren Ausführungszeiten lässt sich keine menschliche Bearbeitungszeit
ableiten. Der vom Nutzer bestätigte M1-Start der vorherigen Version bleibt ein
Nachweis für diese vorherige Version. Die neue App muss auf dem eigenen Mac und
im tatsächlichen itslearning ebenfalls erprobt werden. Keine schulische Freigabe.

Die native Abnahme ist bestanden: ein vollständiger Integrationstest mit **23
Prüfpunkten**, ohne ausgelassene Tests, auf **macOS 15.8.2 ARM64**. Die tatsächliche
DMG wurde geprüft, readonly eingehängt, die App in einen Benutzerordner kopiert,
das Volume ausgehängt und diese installierte App ausgeführt. Electron 45.3.3 und
Chromium 156.0.8078.100 wurden aus dem Prozess gelesen. Erfolgreicher Lauf:
[44126057507](https://github.com/Feerson1617/Vorlage-Mysteryboard/actions/runs/44126057507),
Build-/Testcommit `db92059d88e9a38307f925e831ad8728505c2660`.
Die vier nachträglich aus dem tatsächlichen `app.asar` entnommenen Dateien
(Studio, Player-Template, Main-Prozess und Preload) stimmen bytegenau mit dem
lokal geprüften Build des eingefrorenen Anwendungscodes überein.

Die unabhängige Paketprüfung bestätigt 599 App-ZIP-Einträge, fehlerfreie CRC,
14 erhaltene Framework-Symlinks, ein ARM64-Mach-O-Programm und einen vollständigen
UDIF-DMG-Abschluss. Mindestversion laut `Info.plist`: macOS 13.0; tatsächlich
getestet wurde 15.8.2. Die Ressourcenprüfung mit `codesign --verify --deep --strict`
besteht. Die Signatur ist **ad hoc**; Gatekeeper bewertet die App weiterhin als
`rejected`. Das ist keine Apple-Notarisierung.

## Konkrete Ursachen und Änderungen

| Problem | Änderung und Schutz |
| --- | --- |
| Hauptleiste mischte Dateiverwaltung und Autorentätigkeit | Genau vier Aktionen: Karte hinzufügen, Importieren, Mystery gestalten, Exportieren. Kleine Navigation zur Projektübersicht; Dateibefehle zusätzlich im nativen Ablage-Menü. |
| Projekt konnte über Veröffentlichungsschritte von fertigen Inhalten abhängig sein | „Bearbeitbares Mystery sichern“ funktioniert auch leer. Veröffentlichung wird erst für Schülerausgabe und Vorschau validiert. |
| Import zeigte alle Werkzeuge gleichzeitig | Original und aktuelle Karte nebeneinander; ein Button öffnet genau einen von vier Werkzeugbereichen. Diagnoseinformationen sind optional. Auf schmalen Fenstern bleiben Ansichtsreiter. |
| Auswahl und Originalseite waren teilweise getrennt | Originalrahmen, Kartenauswahl und Vor/Zurück verwenden denselben Auswahlzustand. Der Kartenwechsel aktualisiert auch die PDF-Seite. |
| Verstecktes Begrenzungswerkzeug konnte die einfache Originalauswahl abfangen | Im einfachen Modus ist keine verdeckte Zeichen-/Grenzaktion aktiv. Bereits vorgenommene Korrekturen bleiben erhalten. |
| OCR erforderte einen zusätzlichen technischen Startschritt | Einmaliger lokaler Erkennungsstart pro Rasterseite, weiterhin abbrechbar; manuelle Wiederholung im Werkzeugbereich. Keine Endlosschleife nach Abbruch. |
| OCR-Kontrolle wirkte vom Kartenablauf getrennt | Einzelbestätigung direkt bei der Karte, offener Zähler und gesperrter Abschluss bei ungeprüften Karten. Betroffene Grenz-/OCR-Korrekturen verwerfen die betroffene Prüfung. |
| Radiofelder wurden wie breite Textfelder verteilt | Eigene kompakte 18-Pixel-Radiofelder, zusammenhängende anklickbare Beschriftung, bearbeitbarer Titel und kurze Übernahmezusammenfassung. |
| Web-Texte nannten nicht vorhandene Studio-Aktionen | Studio-spezifische Hinweise nennen Exportieren und natives Sichern. Die weiterhin gültigen Webtexte bleiben auf den Webmodus beschränkt. |
| Überdimensionierte Nummern reservierten viel Platz auf der Autorenpinnwand | Nur im Studio begrenzte Nummernskalierung und passende Startabstände; Schülerstandard unverändert. Die Boardhöhe richtet sich nach dem tatsächlich verfügbaren Fensterbereich. |
| Lesen und Bearbeiten waren nicht ausdrücklich getrennt | Klick bearbeitet, Ziehen ordnet an; „Groß ansehen“ öffnet die bestehende Leseansicht und kehrt ohne Eingabeverlust zurück. Kurze eigene Hinweise für Studio und Player. |
| Dateibefehle konnten mit offenen Formularen konkurrieren | Native Menüeinträge berücksichtigen Formular-, Import-, PDF- und Fehlerdialogzustände. Erfolgreiche Speicherbestätigung gilt für die tatsächlich geschriebenen Dokumentbytes. |
| Fehler beim Öffnen konnten hinter einem Dialog verschwinden | Fehler werden in einem sichtbaren Dialog ausgegeben; das bisherige Projekt bleibt erhalten. |
| Ein fehlgeschlagener nativer Schreibvorgang zeigte denselben Fehler auf Pinnwand und globalem Seitenfuß | Auf der normalen Studio-Pinnwand erscheint die Meldung einmal. Speichern bleibt fehlgeschlagen, die bisherige Datei bytegleich und der geänderte Entwurf ungesichert. Browser- und native Regression prüfen die eindeutige Anzeige und erfolgreiche spätere Wiederholung. |

Betroffene Laufzeitdateien: `src/components/AuthorEditor.tsx`, `DocumentImport.tsx`,
`PdfRegionEditor.tsx`, `Board.tsx`, `src/core/layout.ts`, `src/App.tsx`,
`src/style.css`, `studio/ui/{StudioApp.tsx,PdfExport.tsx,studio.css,types.ts}` und
`studio/electron/{main.ts,preload.cjs}`. Versionsangabe in `package.json`/Lockdatei.
Keine neuen Laufzeitabhängigkeiten. Buildworkflow und QA-Helfer wurden angepasst.

## Realistische Arbeitsabläufe

| Workflow | Tatsächlicher Nachweis |
| --- | --- |
| A – neues Mystery | Leeres Projekt gespeichert; vier Karten ohne Gestaltungseinstellungen erstellt, bearbeitbares Projekt gesichert und tatsächliche SCORM-ZIP erzeugt. Abbruch beim Sichern erhält den Änderungszustand. |
| B – Alfred Wegener | Privates Original-PDF: 16 Karten, alle anklickbar, Original links, Basisfelder rechts, Grenzwerkzeuge verborgen. Übernahme und vollständiger Feldvergleich mit dem geprüften früheren Originalvergleich. |
| C – Deepwater Horizon | Privates zweiseitiges Original-PDF: 20 Karten, beide Seiten und synchroner Seitenwechsel geprüft. Alle Karten nach Übernahme innerhalb der tatsächlichen Pinnwandansicht. |
| D – Scan | Foto mit vier Karten lokal erkannt; Karte korrigiert; andere Kartengrenze geändert und deren OCR wiederholt. Nur betroffene Prüfung verfällt; vorher korrigierte Karte und ihre Prüfung bleiben erhalten. Ungeprüfte Karten sperren den Abschluss. |
| E – Gestaltung | Schriftgröße, Kartenfarbe und Pfeildarstellung geändert, einfache Pinnwand wieder geöffnet, gespeichert und erneut geöffnet; Einstellungen bleiben erhalten. |
| F – Schüler-Sicherung | Tatsächlich exportierte SCORM-ZIPs in neuer Sitzung gestartet, Team angegeben, Karte bewegt und Pfeil beschriftet, Undo/Redo, Original-PNG heruntergeladen. Frische Sitzung stellt den gesamten Zustand wieder her. |

Für die Original-PDFs wurden Titel, Text und Kartengruppe sämtlicher 36 Karten
feldweise gegen die zuvor geprüften Parser-Snapshots verglichen. Dies ist ein
Regressionstest gegen eine geprüfte Referenz, kein neu entwickelter unabhängiger
PDF-Parser. Die privaten Originaldateien, Kartentexte und ihre Screenshots werden
nicht im öffentlichen Repository verbreitet. Das öffentliche Paket enthält
neutrale eigene Testmaterialien sowie den Vergleichsnachweis ohne Originaltexte.
Die beiden privaten Original-PDF-Läufe fanden im gebauten Studio-Renderer mit
testweiser nativer Dateibrücke statt. Die native Mac-Abnahme verwendet neutrale
Referenzmaterialien. Der persönliche native Gegencheck der beiden Originaldateien
auf dem M1 bleibt damit ausdrücklich offen. Die Original-Prüfbilder liegen in
einer getrennten privaten ZIP und sind als Chromium-Aufnahmen gekennzeichnet.

Zusätzliche Tests zeigen, dass Tabellenzellen und Kartentexte beim Wechsel
einfach/erweitert erhalten bleiben und Teilen/Zusammenführen nicht andere Karten
verändert. Ein Originaldiagramm bleibt als Bildausschnitt erhalten; es wird keine
vermeintlich richtige Datentabelle aus dem Diagramm erfunden.

Ein zusätzlicher Studio-Word-Test wählt alle zwölf Originalbereiche der
vorhandenen DOCX-Testdatei an und vergleicht sämtliche Überschriften und Absätze.
Die expliziten Vertiefungskarten 3, 8 und 12 bleiben erhalten. Die Word-Ansicht
zeigt die extrahierten Originalabsätze, Bilder und Tabellen, keine pixelidentische
Word-Seitensimulation. Für einen vollständigen Layoutvergleich bleibt die
Originaldatei über die erweiterten Werkzeuge erreichbar.

## Prüfungen und vollständige Befehle

Von der Repositorywurzel, Node 24 und gepinnte Lockdatei:

```sh
npm ci
CLASSROOM_SCORM=1 OCR_EVIDENCE_DIR=/workspace/mysteryboard-studio-ux-release-regression npm run check
npm run test:rc2
npm run studio:build
STUDIO_EVIDENCE=/workspace/mysteryboard-studio-ux-evidence node qa/studio/ux.mjs
STUDIO_EVIDENCE=/workspace/mysteryboard-studio-ux-evidence node qa/studio/browser.mjs
STUDIO_EVIDENCE=/workspace/mysteryboard-studio-ux-evidence node qa/studio/graphics.mjs
STUDIO_EVIDENCE=/workspace/mysteryboard-studio-ux-evidence node qa/studio/pdf-limits.mjs
STUDIO_EVIDENCE=/workspace/mysteryboard-studio-ux-evidence node qa/studio/usability.mjs
STUDIO_EVIDENCE=/workspace/mysteryboard-studio-ux-evidence node qa/studio/scan-ux.mjs
STUDIO_EVIDENCE=/workspace/mysteryboard-studio-ux-evidence node qa/studio/word-ux.mjs
```

Der Original-PDF-Lauf verwendet denselben UX-Test mit zusätzlich gesetzten
`STUDIO_ORIGINAL16` und `STUDIO_ORIGINAL20` auf die beiden Nutzeruploads sowie
`STUDIO_EVIDENCE=/workspace/mysteryboard-studio-ux-private`.

Mac-Build und native Prüfung im vorhandenen GitHub-Actions-Workflow:

```sh
npm ci
npm test
npm run studio:make -- --platform=darwin --arch=arm64
# DMG über hdiutil verify prüfen, readonly einhängen, App mit ditto kopieren,
# Volume aushängen und codesign --verify --deep --strict ausführen.
STUDIO_EXEC='/Installationspfad/MysteryBoard Studio.app/Contents/MacOS/MysteryBoard Studio' npm run studio:test
```

Die genaue hdiutil-/Installationssequenz steht unverändert prüfbar in
`.github/workflows/studio-macos.yml` und im vollständigen Actions-Log.
Dateidialogantworten werden automatisiert vorgegeben; Dateizugriff, atomisches
Schreiben, PDF-Kern und App-Laufzeit sind real. Der QA-Treiber für ⌘O/⌘S/⇧⌘S
synthetisiert Quartz-Tastaturereignisse und dispatcht sie über das wirkliche
`NSApplication`. Der empfangene Dateibefehl wird zusätzlich exakt geprüft.
Er ruft keinen JavaScript-Menühandler direkt auf.
Das ist keine Prüfung einer physischen Tastatur. Die native QA-Erweiterung wird
nicht in die ausgelieferte App eingebaut. Electron-Sandbox, Kontextisolation,
Websicherheit und deaktivierte Node-Integration werden im echten App-Prozess
ausgelesen und geprüft.

Auch Antworten auf Renderer-Bestätigungsfragen werden im nativen Test gezielt
vorgegeben und ihre Aufrufe protokolliert. Die Projektübersicht wird einmal mit
Abbrechen und einmal mit bewusstem Verwerfen geprüft. Dies ist keine visuelle
Abnahme der physischen macOS-Datei- und Bestätigungsdialoge. Diese gehören zum
manuellen M1-Gegencheck. Die unabhängige Browserregression verwendet weiterhin
die tatsächlichen Browserdialogereignisse.

Die früheren fehlgeschlagenen nativen Versuche sind als solche in den Logs
erhalten: fehlender Fensterfokus, nicht an AppKit weitergereichte CDP-Tasten,
`require` außerhalb des Inspector-Kontexts sowie eine falsch konstruierte
Umschalttasten-Simulation. Die zusätzliche Prüfung des tatsächlich empfangenen
Befehls erkannte dabei ausdrücklich „save“ statt „save-as“. Diese Versuche sind
kein bestandener Shortcut-Nachweis. Ein überholter wartender Lauf wurde vor dem
Start abgebrochen, um einen fehlenden QA-Helferimport zu ergänzen. Keiner dieser
Versuche wird mit einem erfolgreichen Endlauf zusammengezählt.
Der anschließende Quartz-Lauf bestätigte die Dateikürzel und Dateiexporte, stoppte
aber an einer zu großen angeforderten Fensterhöhe: Der virtuelle Runner begrenzt
sie auf 656 Pixel. Der native Fenstertest ermittelt deshalb die reale Arbeitsfläche
abzüglich Fensterrahmen und prüft die darin möglichen Größen exakt. Er gibt
begrenzte Fenster nicht als größere native Viewports aus.
Der spätere Fokusfehler wurde durch eine zusätzliche AppKit-Aufnahme eindeutig
auf einen noch geöffneten `NSOpenPanel` zurückgeführt. „Importieren“ öffnet
korrekt den Dateiauswahldialog; das frühere direkte `setInputFiles` des Tests
ließ diesen nativen Dialog parallel offen. Der endgültige Test registriert vor
dem Klick Playwrights Dateiauswahl-Interception, zählt die Auswahlvorgänge und
setzt die tatsächlichen Dateien. Die vermutete Ursache bei Bestätigungsfragen
bestätigte sich nicht; direkte `window.confirm`-Ersetzungen wurden entfernt.
Bestätigungen werden wieder über die tatsächlich verwendeten Dialogfunktionen
beantwortet. Electron leitet `window.confirm` über seine nativen Dialogfunktionen;
die zusätzliche Abbrechen-/Verwerfen-Prüfung wählt dort die Antworten und
protokolliert die Originalfragen. Im normalen Browser erfolgt dies über
Playwrights Browserdialogereignisse. Es gibt im endgültigen Test keine ersetzte
`window.confirm`-Implementierung.

Die Fehleranzeige beim absichtlich erzwungenen Verzeichnis-/Dateikonflikt wurde
auf macOS 15 und 26 reproduziert und im letzten Anwendungspatch dedupliziert.
Die strikte Prüfung auf genau einen sichtbaren Fehlerhinweis bleibt erhalten;
sie wurde nicht auf den ersten von mehreren Treffern abgeschwächt.
Ein anderer Lauf wurde vor Runner-Zuteilung wegen fehlender ARM64-Kapazität
abgebrochen. Das ist kein ausgeführter oder bestandener Anwendungstest. Die kostenlosen GA-ARM64-Plattformen `macos-15` und `macos-26` wurden als
Ausweichmöglichkeiten angefordert; kostenpflichtige große Runner wurden nicht
angefordert.

Bestanden: **177 Datentests in 25 Dateien**, Produktionsbuild, **272
Chromium-Browsertests** (24,2 Minuten) und **vier eingefrorene RC2-Tests**
(39,9 Sekunden). Abschlussmarker und vollständige Logs liegen bei.
Die zusätzlichen Studio-Renderer-Workflows, Original-PDF-Vergleich, Foto-OCR,
Word-Kontrolle, Diagrammerhalt und PDF-Grenzfälle sind ebenfalls bestanden.
Ein 3.640-Zeichen-Langtext wird vollständig gesetzt; eine nicht lesbar passende
Karte mit 3.910 Zeichen und vielen Absätzen wird verständlich und ohne Teil-PDF
abgewiesen.

Studio-HTML: **9.705.588 Bytes**, Player-HTML: **1.250.773 Bytes**; beide unter
10.000.000 Bytes. `player-boundary.json` enthält die exakten Build-Hashes und
den geprüften Modulgraph. Alte generierte Universal-Testartefakte wurden nach
der Regression nicht als zusätzliche Produktänderungen übernommen.

Native SCORMs zusätzlich prüfen:

```sh
STUDIO_EVIDENCE=/workspace/mysteryboard-studio-ux-evidence node qa/studio/mac-exports.mjs
WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1 GSETTINGS_BACKEND=memory XDG_CACHE_HOME=/workspace/mysteryboard-ocr-webkit-deps/cache STUDIO_EVIDENCE=/workspace/mysteryboard-studio-ux-evidence STUDIO_ENGINE=webkit WEBKIT_EXECUTABLE=/workspace/mysteryboard-browsers/webkit-2388/pw_run.sh node qa/studio/mac-exports.mjs
python3 qa/studio/check-pdfs.py /workspace/mysteryboard-studio-ux-evidence
python3 qa/studio/check-pngs.py /workspace/mysteryboard-studio-ux-evidence
python3 qa/studio/check-native-package.py '/Pfad/App.zip' '/Pfad/Installation.dmg' /workspace/mysteryboard-studio-ux-evidence/Mac/native-macos.json
```

Die Sandbox-Umgebungsvariable betrifft ausschließlich die externe Linux-WebKit-
Testinstanz. Sie verändert keine Studio-Einstellung. WebKit 27.2 ist eine
Playwright-Engine, kein echter Safari-/iPad-Gerätenachweis. WebKit 26.5 ist in
dieser Umgebung nicht vorhanden; dessen Kompatibilitätsprüfung bleibt offen.

## Schülerdaten, Sicherung und Rückwärtskompatibilität

Der veröffentlichte Player enthält laut tatsächlichem Build-Modulgraph **null
Editor- und null OCR-Module**. Eine SCORM-ZIP besteht aus `app.html`, `launch.html`,
`session.js` und `imsmanifest.xml`. Der Schülerplayer exportiert ausschließlich
die vollständige PNG (`Teamname_Mysterytitel.png`); weder JSON noch
`.mysteryboard` wird als Schülerausgabe angeboten. Ein alter gültiger
Schülerdokumenttyp wurde zusätzlich in einer neuen Sitzung importiert und mit
dem wiederhergestellten Zustand verglichen. Diese alte Datei wurde nur als
Testeingabe extern aus einer PNG dekodiert, nicht vom Player exportiert.

Die separate Python-Prüfung kontrolliert PNG-CRC, eingebettete Integrität und
vollständigen Aufgabeninhalt einschließlich Medien gegen die tatsächliche
SCORM-ZIP. Die frische Browserinstanz vergleicht Kartenpositionen, Farben,
Gruppen, Team, Pfeile, Richtung und Beschriftung. Keine externen Netzwerkanfragen,
keine lokalen Schüler-Stores und kein `LMSSetValue` im SCORM-Lebenszyklus.

Es gibt keine automatische Projektdateispeicherung und keine neu eingeführte
Absturz-Wiederherstellung. Bei einem Prozessabsturz gehen ungesicherte Eingaben
weiterhin verloren. Bewusstes natives Sichern und Schließ-/Ersetzungswarnungen
bleiben erforderlich.

## Sichtprüfung, Screenshots und Offenheit

Die tatsächlichen gebauten Oberflächen wurden bei 1280×900, 1024×768, 768×1024
und 720×600 geprüft. Originalauswahl, Formularnavigation, Werkzeugwechsel und
Radioauswahl wurden bedient. Die Pinnwandprüfung erfasst jedes Kartenrechteck
und zusätzlich den unteren Rand des SVG relativ zum echten Viewport; ein
unsichtbar abgeschnittener SVG-Bereich gilt nicht als sichtbare Karte.

Native Aufnahmen im Abnahmepaket:

- `evidence/Mac/Mac-UX-Hauptleiste-und-Pinnwand.png`: vier Aktionen und gespeichertes 16-Karten-Referenzprojekt.
- `evidence/Mac/Mac-UX-Speichern-und-Exportieren.png`: zentraler Exportdialog.
- `evidence/Mac/Mac-OCR-Scan-B-16.pdf.png`: vereinfachte Importkontrolle.
- `evidence/Mac/Mac-UX-Radioauswahl.png`: kompakte Abschlussauswahl.
- `evidence/Mac/Mac-UX-Schreibfehler.png`: einmalige Fehlermeldung bei erhaltener ungesicherter Arbeit.
- `evidence/Vergleich/Import-Vorher-Nachher.html`: unveränderte native Vorher-/Nachher-PNGs nebeneinander.

Der alte native Screenshot stammt aus dem erfolgreichen 0.1.0-Lauf 44029762631;
sein Anwendungscode ist bytegleich mit Ausgangsstand 8662d74. Die neuen Bilder
stammen aus der tatsächlich installierten 0.2.0-App. Es sind Aufnahmen des
Webinhalts der nativen Fenster, keine nachgebauten Ansichten. Separate
ursprüngliche Nutzer-Screenshots lagen nicht als Bilddateien vor; der Vergleich
verwendet deshalb den nachweislich gleichen alten Quellstand und dieselbe
neutrale Scan-Datei.

Die virtuelle native Arbeitsfläche beträgt 1024×684 Pixel, maximaler Inhalt nach
Fensterrahmen 1024×656. Tatsächlich geprüft wurden 1024×656, 768×656 und 720×600;
`native-viewports.json` dokumentiert jede angeforderte und tatsächliche Größe.
Ein natives 768×1024-Fenster wird nicht behauptet. Die größeren Formate sind
separat mit dem gebauten Produktions-Renderer im Browser geprüft.

Die beiden vom Mac erzeugten SCORMs mit fünf und 16 Karten bestehen in
**Chromium 156.0.8078.79 und WebKit 27.2**, jeweils einschließlich neuer Sitzung,
Pfeil, Undo/Redo, Original-PNG und erneuter Wiederherstellung. Der CDP-Pinch-Test
läuft in Chromium; WebKit besitzt dafür keine identische CDP-Schnittstelle und
wird im Nachweis ausdrücklich so gekennzeichnet. Die unabhängige Python-Prüfung
bestätigt alle **neun** tatsächlichen PNG-Sicherungen gegen ihre SCORM-Aufgaben.
Alle 16 nativen PDF-Seiten wurden gerendert und auf vollständige Originaltexte,
Seitenformat, Karten auf jeweils einer Seite und fehlenden Seitenüberlauf geprüft.
A4 hoch: fünf Karten/drei Seiten; A3 quer: 16/drei; A4 quer: 20/fünf;
A3 hoch: 60/fünf. Die zwei Langtext-Grenzfälle wurden zusätzlich unabhängig geprüft.

Die Original-/Diagrammvergrößerung nutzt die vorhandene Bild- und Leseansicht.
OCR bleibt fehleranfällig, besonders bei Schräglage, geringer Auflösung, kleinen
Beschriftungen und Zahl-/Einheitenverwechslungen. Automatische Erkennung ist
keine fachliche Freigabe. Quellen, Karten und feine Diagrammlegenden bleiben am
Original zu prüfen. Kameraaufnahme, Handschrift, HEIC und eine echte Mac-Farbauswahl
sind durch diese automatisierten Workflows nicht als Gerätemerkmale abgenommen.

## Unveränderte Unterrichtsfassung und Lieferung

Die eingefrorene Boden-RC2 bleibt bytegleich:

- HTML: `21dd6ad5c813ba5bd12ca521f03602a195ccea44ee70769119280e4ca088fd5f`
- SCORM: `42ac3d51e2e34431efe9b0ca9b0f4e84085d9b651e4fac6747d843bf6091c3a0`

Remote-main bleibt `1fa1fff81e5e19b7031130c8d034a77d9e1ace61`.
Die bisherigen Daten- und Browsertests sind unverändert. Der vorhandene native
Mac-Test behält seine bisherigen Prüfungen und ergänzt die neuen UX-/Speicherfälle;
UI-Selektoren folgen den ausdrücklich beauftragten neuen Beschriftungen.
Keine Tests wurden entfernt, abgeschwächt oder für diese Abnahme übersprungen.

Die tatsächlichen nativen Dateien sind als
[GitHub-Actions-Artefakt](https://github.com/Feerson1617/Vorlage-Mysteryboard/actions/runs/44126057507/artifacts/14347956458)
verfügbar, Aufbewahrung bis **17. Dezember 2026**. GitHub-Anmeldung kann erforderlich
sein. Der REST-Binärdownload wurde vollständig heruntergeladen, als ZIP gelesen
und mit GitHubs SHA-256-Artefaktdigest verglichen. Es wurde keine HTML-Vorschau als
Download ausgegeben. Die ursprünglichen Dateipfade innerhalb des Artefakts stehen
in `Mac-Dateien.json`; die separat angebotenen Dateien haben dieselben Bytes.

| Datei | Bytes | SHA-256 |
| --- | ---: | --- |
| `MysteryBoard-Studio-0.2.0-Apple-Silicon.dmg` | 125933937 | `a2a66daa8cc2a0522bccb31454500e32833fd55a2dc0830de795cadbcfe5d533` |
| `MysteryBoard-Studio-0.2.0-Apple-Silicon-App.zip` | 127815020 | `fec8ff1e1f72547c8afd4df6641ed8affaa57bad8ae7837cba758f266e36bab0` |
| `MysteryBoard-Studio-UX-Beispiel-SCORM-1.2.zip` | 253364 | `593241deee6b8c1775edc548d301f57da51510f29115fe5514baf20b3a81e42d` |

Der native Build stammt aus db92059; seine Anwendungsdateien sind unverändert
gegenüber b578814. Das öffentliche Review-Paket enthält vollständige Quellen,
alle bisherigen Tests und Fixtures, gepinnte Lockdatei, gebauten Studio-Renderer
mit lokaler OCR, getrennten Player, tatsächliche native PDFs/SCORMs, PNGs,
Screenshots, vollständige Logs und Einzeldatei-Manifest. Die großen nativen
Installationsdateien liegen separat; sie werden nicht als Quellcode-ZIP ersetzt.
Die Review-ZIP muss unter 32 MiB bleiben. `verify-package.py` prüft alle enthaltenen
Dateigrößen, SHA-256-Werte und ZIP-CRC. Die eigene ZIP-Prüfsumme steht außerhalb
des Archivs in der zugehörigen `.integrity.json` und `SHA256SUMS.txt`.

Die private Originalprüfung liegt separat in
`MysteryBoard-Studio-Private-Originalpruefung.zip` (1081473 Bytes,
SHA-256 `935d1f214a39d8bcd429b58b2c1e7b7aeb86ef23632cac8cf9159d0ed4187b0a`).
Sie enthält die beiden Nutzer-PDFs, die geprüften früheren Referenzen, neue
Importprojekte und echte Browser-Prüfbilder. Sie wird nicht öffentlich in Git
abgelegt.

Vollständige zusätzliche Download-/Paketbefehle:

```sh
python3 scripts/studio/fetch-native-evidence.py 44126057507 /workspace/mysteryboard-studio-ux-evidence /workspace/mysteryboard-studio-ux-download
python3 scripts/studio/package-review.py artifacts/delivery/studio-ux/MysteryBoard-Studio-UX-Abnahmepaket.zip /workspace/mysteryboard-studio-ux-evidence scripts/studio/ux-release.json
```

Die Paketierung verlangt einen bestandenen nativen ARM64-Nachweis mit passendem
Buildcommit und vorhandene Download-Prüfsummen. Ein alter oder abgebrochener
Mac-Lauf kann diese Freigabe nicht versehentlich ersetzen.

Erforderlich bleiben der manuelle Start dieser neuen Fassung auf dem eigenen M1,
die Freigabe durch lokale Mac-Richtlinien, echter PDF-Ausdruck mit lesbaren
Legenden, Upload/Start in itslearning und vollständige Schüler-PNG-Wiederherstellung
auf verwalteten Schul-iPads. Die App ist ad hoc signiert, **nicht Apple-notarisiert**.
Ein bestandener `codesign`-Ressourcentest ist keine Gatekeeper-Vertrauensfreigabe.
Es wird keine globale Sicherheitsabschaltung empfohlen.
