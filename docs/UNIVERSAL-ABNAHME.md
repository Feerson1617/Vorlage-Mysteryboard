# Universelle Autoren- und Unterrichtsvorlage: Umsetzung und Abnahme

Prüftag: 14.11.2026, UTC. Entwicklungsbranch: `feat/mysteryboard-universal-authoring`. Ausgangsbasis: `e14a09273be38c5501dc36ff3a7b819de298cd3a`. Die genaue Commit-ID der Lieferung steht in `PROJECT-VERSION.json` im Projektpaket und in dessen äußerer Integritätsdatei. Kein Merge, kein Push des neuen Branches, keine Veröffentlichung und kein Release-Tag-Wechsel.

## Ergebnis und Freigabegrenze

Der vollständige technische Kreislauf wurde mit der tatsächlich gebauten Anwendung ausgeführt: grafisch zwölf Karten mit neun Pflicht-/drei Vertiefungskarten und drei eingebetteten Bildformaten erstellen → Entwurf herunterladen → Browserkontext schließen → erneut öffnen und Aufgabe exportieren → in einem neuen Kontext des universellen SCORM mit eigenem Team öffnen → Touch/Pinch/Pan, Verbindungen, Farbe/Kategorie, Hilfe, Undo/Redo und Druck nutzen → Original-PNG herunterladen → in einer weiteren frischen universellen SCORM-Sitzung vollständig wiederherstellen und weiterarbeiten.

Auch die Ergänzung wurde ausgeführt: strukturiertes zwölfteiliges Beispiel öffnen, erste Schülerversion exportieren und schließen; erneut als Lehrkraft öffnen, Pflichtkarte hinzufügen, Text ändern, Diagramm ersetzen, andere Karte löschen; Entwurf und neue Version herunterladen; in neuer SCORM-Sitzung bearbeiten und sichern; neue und alte Schüler-PNG mit ihren jeweiligen vollständigen Inhalten unvermischt wiederherstellen. Der neue spezifische HTML- **und** SCORM-Build bietet denselben Lehrkräftemodus.

**Technische Prüflieferung für den realen Geräte-/LMS-Test. Keine schulische Freigabe.** Safari, verwaltete Schul-iPads, tatsächliches itslearning, native Safari-Druckausgabe und ggf. Canva sind noch offen. WebKit 26.5/27.2 wurden hier nicht erfolgreich ausgeführt. Die positive Chromium-Abnahme ersetzt diese Nachweise nicht.

## Architektur und konkret behobene Ursachen

1. **Bisherige Sicherungen trugen nur Work-Daten.** Sie konnten Kartentexte und Medien nicht in eine Blanko-Anwendung mitnehmen. Neu sind drei klar getrennte, selbsttragende Dokumenttypen (`task`, `draft`, `student`) mit vollständigem Inhalt und SHA-256. Der neue MBX3-Block ist eindeutig vom unveränderten MBS1/MBS2-Codec getrennt. `.mysteryboard` und Original-PNG verwenden dieselbe Importvalidierung.
2. **Inhalte waren an einen Build gebunden.** `App` bekommt Inhalt und optionalen geladenen Work-Zustand jetzt als Parameter; der neue Host verwaltet Import/Editor. Der bestehende Boardkern wird unverändert wiederverwendet. Neue Aufgaben beginnen neutral und numerisch; Schülerstände werden ohne Neusortierung geladen.
3. **Nachträgliche Inhaltsbearbeitung brauchte einen Versionsschutz.** Der Editor erhöht bei übernommenen Inhaltsänderungen die Patch-Version. Hinzufügen/Löschen nummeriert IDs und Hilfereferenzen gemeinsam. Vollständige alte Schülerdokumente enthalten weiterhin ihren eigenen Inhalt; sie werden nicht mit aktuellen Texten kombiniert.
4. **Medien dürfen nicht nur scheinbar aufgenommen werden.** Signatur-/Container-/Dimensionsprüfung vor dem Browserdecoder, tatsächliches Decodieren, Byte-/Pixelbudgets, Abbruchtoken und Workergrenzen schützen den geöffneten Stand. PNG/JPEG/WebP bleiben eingebettet; JPEG-Orientierung, Seitenverhältnis, Bildaustausch und vergrößerte Lesefensteransicht wurden geprüft. Tabellen bleiben strukturierte editierbare Zellen; Quellen und Alternativtexte bleiben eigene Felder.
5. **Im ersten Löschtest zeigte die Autorenvorschau für einen Renderzyklus noch den vorherigen Kartenbestand.** Das führte beim Übergang 13 → 12 Karten zu einem fehlenden Layout-Eintrag. Die Vorschau wird jetzt synchron aus der aktuellen Inhaltsreferenz abgeleitet; eine manuell verschobene Vorschau gilt ausschließlich für genau diese Fassung. `Board.tsx` musste nicht geändert werden.
6. **Kanonisches Sortieren von Gruppenschlüsseln darf die neue Pflichtkarte nicht zur Vertiefung machen.** Die Standardauswahl verwendet die Gruppe ohne Nummernpräfix, unabhängig von der Schlüsselreihenfolge. Alle konkreten Zuordnungen bleiben Datenmetadaten.
7. **Spezifischer HTML-Build mit wörtlichen Markup-Texten.** Ein zusätzlicher Test mit gemischten `</ScRiPt>`-Endtags und einem wörtlichen externen Bildtag wurde zunächst von der statischen Ressourcenprüfung abgewiesen. Der vollständige initiale Inhalt wird nun als Base64-Datenblock eingebettet und beim Start mit dem gemeinsamen Validator gelesen. Kartentext gerät nicht in die HTML-Syntax. Der tatsächliche Browsertest zeigt den gesamten Text, keine Codeausführung und keine externen Requests. Die Ressourcenprüfung bleibt unverändert streng. Ein Build-Hinweis von `vite-plugin-singlefile` zur CSP bezieht sich auf die enthaltene Druckdokument-Vorlage; die tatsächliche Anwendung und der Druckframe wurden ausgeführt. Es wurde keine Sicherheitsrichtlinie entfernt.
8. **PNG-Endgrenzen gelten auch für neue Inhalte.** Die bestehende 30-MB-Endgrößenprüfung bleibt erhalten. Der zusätzliche Schutz gegen übermäßig viele PNG-Chunks prüft auch die Zahl nach Einbettung. Ein gültiges PNG an der Chunk-Grenze wird beim Überschreiten zurückgewiesen, statt eine unimportierbare Sicherung anzubieten.

9. **Datei- oder Downloadvorbereitung kann scheitern.** Projektdatei-Erzeugung und Blob-URL-Aufbau werden abgefangen. Ein verständlicher Dialog lässt den Entwurf erhalten; nach einem fehlgeschlagenen Versuch ist erneutes Sichern möglich. Ein gezielter Browsertest injiziert beide Fehler und lädt anschließend den unbeschädigten Entwurf herunter.

Die Erzeugung oder der Download einer Datei setzt den Änderungsstatus nicht fälschlich auf „dauerhaft gesichert“. Keine automatische Browser-/LMS-Ablage wurde eingeführt.

## Betroffene Dateien

| Bereich | Dateien |
| --- | --- |
| Gemeinsames portables Modell | `schemas/mystery-content.schema.json`, `schemas/mystery-document.schema.json`, `src/core/documents.ts`, `authoring.ts`, `media.ts`, `document-worker.ts`, `document-qr.ts`, `builtin-content.ts` |
| Host und Autorenoberfläche | `src/UniversalApp.tsx`, `src/App.tsx`, `src/main.tsx`, `src/env.d.ts`, `src/components/AuthorEditor.tsx`, `FileDownload.tsx`, `MediaView.tsx`, `TableEditor.tsx`, `TableView.tsx`, `src/style.css` |
| Kleine allgemeine Erweiterungen | `src/core/model.ts` (optionale Quelle/Tabelle), `layout.ts` (Tabellenhinweis), `png.ts` (allgemeiner Payload), `export.ts` (optional vollständiger Payload), `print.ts` (Quellen/Tabellen), `PrintPreview.tsx` (Seitenzahlwarnung) |
| Build und Weitergabe | `mysteries.json`, `src/content/blank.json`, `vite.config.ts`, `package.json`, Lockfile, `scripts/mystery-tools.mjs`, `package-universal.mjs`, `prepare-universal-tests.mjs`, `package-project.py`, ergänzte bestehende SCORM-/Buildprüfer |
| Portabilität der Prüfwerkzeuge | beide Playwright-Konfigurationen; optionale historische `r1-reference.mjs`/`reproduce-team-requirements.mjs` mit installiertem Playwright-Browser als Rückfall und projektbezogenem Ausgabepfad |
| Neue Tests | `tests/documents.test.ts`, `authoring.test.ts`, `portable-safety.test.ts`, `tests/browser/authoring-*.spec.ts`, `authoring-helpers.ts`, eigene gedrehte JPEG-Fixture |
| Dokumentation/Beispiele | `AI-ANLEITUNG.md`, `LEHRKRAEFTE-ANLEITUNG.md`, `README.md`, `docs/UNIVERSAL-*`, aktualisierte `NEUES-MYSTERY.md`, `examples/universal/` |

37 der zuvor vorhandenen 38 Dateien unter `tests/` sind byteidentisch. In `ordered-help.spec.ts` wurde genau eine zusätzliche Assertion eingefügt: Nach dem Fensterwechsel muss die breite Hilfe-Schaltfläche verschwunden sein, bevor der Test den schmalen Menüweg wählt. Ein Zwischenlauf hatte sonst noch den gerade entfernten alten Button ausgewählt und nach 60 Sekunden abgebrochen (148/149 bestanden). Keine bestehende Assertion wurde entfernt oder abgeschwächt; sämtliche R1/R1b-Tests sind unverändert. Die zusätzlichen Dateien erweitern die Prüfungen. `Board.tsx`, `history.ts` und der Legacy-`codec.ts` sind gegenüber der Basis byteidentisch. Die eingefrorene Boden-HTML, RC2-HTML, RC2-ZIP, RC2-Integritätsdatei und fachliche Boden-JSON sind unverändert.

## Tatsächliche Testausführung

Die Rohprotokolle und ausgewählten tatsächlichen Ausgaben befinden sich unter `docs/test-evidence/universal-authoring/` im Projektpaket; zusätzlich wird ein separates Nachweis-ZIP angeboten. Absolute Pfade in historischen Laufzeitprotokollen beschreiben die verwendete Maschine, sind keine Programmvoraussetzung.

Phasen wurden nacheinander geprüft: zunächst 10 Dokumenttests und der dynamische HTML-PNG-Rundlauf; dann 13 Datenprüfungen mit Autorenmodell sowie der tatsächliche Entwurf-/Veröffentlichungsablauf; anschließend der Unterrichtskreislauf in beiden Bildschirmformaten; dann dieselbe Bedienung im tatsächlichen universellen SCORM und der ergänzte Revisionsablauf. Danach kamen Medien-/Tabellen-/Manipulationsprüfungen und die vollständige Regression. Frühe Testselektoren wurden präzisiert, ohne vorhandene Tests zu ändern; der reale Vorschaufehler und die Gruppenstandardauswahl wurden behoben. Der zusätzliche Build-Sicherheitsfall erforderte die abschließende erneute Gesamtprüfung.

Zusätzlich wurde ein vollständiges Projekt-ZIP in einen neuen Ordner ohne Git-Metadaten oder installierte Abhängigkeiten entpackt. `npm ci`, Inhaltsvalidierung, universeller Build und SCORM-Verpackung liefen dort erfolgreich; HTML und SCORM waren byteidentisch mit den Originalausgaben. Auch nach dem abschließenden Fehlerdialog-Patch wurde dieser Neubau aus einer zweiten frischen Extraktion wiederholt: HTML und SCORM sind erneut byteidentisch.

Die vollständigen Befehle (im Projektordner):

```sh
npm ci
npx tsc --noEmit
npx vitest run tests/documents.test.ts tests/authoring.test.ts tests/portable-safety.test.ts
npm run build:universal
npm run package:universal
npx playwright test tests/browser/authoring-phase1.spec.ts tests/browser/authoring-phase2.spec.ts
npx playwright test tests/browser/authoring-classroom.spec.ts
CLASSROOM_SCORM=1 npx playwright test tests/browser/authoring-classroom.spec.ts
npx playwright test tests/browser/authoring-safety.spec.ts
npx playwright test tests/browser/authoring-build-security.spec.ts
CLASSROOM_SCORM=1 npm run check
npm run test:rc2
npm run validate:mystery -- examples/universal/content.json
npm run validate:mystery -- examples/universal/unterricht-entwurf.mysteryboard
npm run validate:mystery -- examples/universal/unterricht-schueler.png
python3 scripts/validate-scorm.py artifacts/MysteryBoard-Universal-SCORM-1.2.zip artifacts/MysteryBoard-Universal.html MysteryBoard-Universal-v3
python3 scripts/validate-scorm.py artifacts/tests/MysteryBoard-Editierbares-Beispiel-SCORM.zip artifacts/tests/MysteryBoard-Editierbares-Beispiel.html MysteryBoard-example-universal-twelve-1.0.0
python3 scripts/validate-scorm.py artifacts/MysteryBoard-Boden-Klasse11-RC2-SCORM-1.2.zip artifacts/MysteryBoard-Boden-Klasse11-RC2.html
```

`npm ci` ist die reproduzierbare Installation aus dem Lockfile; während der Entwicklung wurde Ajv 8.20.0 mit `npm install --save-exact ajv@8.20.0` ergänzt. Die konkrete Cloud-Ausführung verwendete einen beschreibbaren npm-Cache. Für die Nachweisablage wurde der Gesamtbefehl mit `AUTHORING_EXAMPLES_DIR`, `PRINT_EXAMPLES_DIR` und `INTEGRATION_EXAMPLES_DIR` auf lokale Ausgabeordner gesetzt; ohne diese Variablen laufen dieselben Assertions und Ergebnisse in Playwrights Ergebnisordner.

### Prüfergebnisse

Die erste vollständige Regression bestand mit **93/93 Datentests und 148/148 Browsertests**, ohne Überspringen oder instabile Wiederholungen. Anschließend wurde der neue Build-Sicherheitstest ergänzt und bestanden sowie die Medienansicht um eine tatsächliche Scroll-/Seitenverhältnisprüfung verstärkt. **Die abschließende Gesamtprüfung bestand mit 93/93 Datentests und 150/150 Chromium-Browsertests, 0 Fehlern, 0 übersprungenen Tests und 0 instabilen Wiederholungen im Endlauf.** Der vollständige Nachweis steht in `RESULTS.json` und `full-check.txt`. Die separate eingefrorene RC2-Prüfung bestand mit **4/4 Tests**, davon zwei Standalone-HTML- und zwei SCORM-Abläufe in Hoch-/Querformat.

| Nachweis | Ausgeführte Prüfung |
| --- | --- |
| Dokumente | 5/12/18/60 Karten mit vielen eingebetteten Bildern, vollständige Aufgabe und Schülerarbeit durch JSON, Kompression und PNG; Hash-/Versions-/Referenzprüfungen |
| Umfang | mehr als 3 MB eingebettete Bilddaten verlustfrei im PNG; bestehender gültiger PNG-Grenztest nahe 30 MB; zusätzlicher Chunk-Endgrenztest |
| Unterricht | echte UI-Erstellung von zwölf Karten, Entwurf schließen/öffnen, neutrale Aufgabe, eigener Teamname, sichtbare 1–9/V10–V12 |
| Touch und Zustand | tatsächliche Chromium-CDP-Touchfolgen für Pinch/Pan/Kartenziehen; keine unbeabsichtigten Dialoge; mehrere beschriftete Pfeile; Farbe/Kategorie; Undo/Redo mehrerer Aktionen |
| Wiederherstellung | Download und neuer Browserkontext; kompletter Inhalts-/Work-Vergleich; danach weitere Verbindung und neue PNG |
| Ergänzung | bestehende Aufgabe erneut editieren, hinzufügen/löschen/renummerieren, Text/Diagramm ändern, Hilfereferenzen erhalten, neue Inhaltsversion; alte und neue PNG unvermischt |
| Medien | Quadrat/Hochformat/Breitformat, gedrehtes JPEG, Seitenverhältnis, 3×-Medienansicht mit tatsächlichem horizontalem Scrollen; zu große/kaputte/PDF-Dateien zurückgewiesen ohne Formularverlust |
| Tabellen/Quellen | Zellen bearbeiten, Entwurf/Aufgabe wieder öffnen, tatsächliche Tabellenzelle lesen; native Chromium-PDF enthält alle beschrifteten Datenzeilen und Quelle |
| Import/Sicherheit | fehlerhaftes JSON, unbekanntes Format, große Dateien, falsche Version/Prüfsumme, falsche Hilfe/Medien, Importabbruch, HTML als Text; zusätzlicher tatsächlicher spezifischer Build mit Script-Endtags |
| SCORM | ZIP-CRC, XML und expliziter 1.2-Manifestvertrag, lokale Ressourcen, vier Einträge ohne Oberordner; `app.html` bytegleich zur Standalone-HTML |
| LMS-Daten | simulierte API protokolliert ausschließlich `LMSInitialize("")`/`LMSFinish("")`; keine Set/Get/Commit-Aufrufe mit Schülerdaten; kein Local-/SessionStorage |
| Offline | fertige HTML bzw. vier Paketdateien lokal geladen, danach Browserkontexte offline; keine externen HTTP(S)-Requests beim tatsächlichen Unterrichtsablauf |
| Bestehende Regression | R1/R1b einschließlich ohne/spätem Klick, gestaffeltem Loslassen, Pinch/Pan/Abbruch, Labelvorrang, 1–2/1–3 und 220 Verbindungen; Maus/Tastatur, 12/60-Karten-Originaldateien, Team, Export, Hilfe und Druck |
| Größen/Ansichten | alle Build-HTMLs unter 10.000.000 Bytes; 1024×768, 768×1024 sowie 600×800/320×700; neue Autorenformulare und bisherige Werkzeugleiste ohne horizontalen Seitenüberlauf |

Die vollständigen bestehenden Druckregressionen erzeugten unter anderem eine tatsächliche **56-seitige A4-PDF mit 60 Karten und 220 Beziehungen**, vollständiger Textextraktion und ohne gemeldete Layoutprobleme. Das ist keine Aussage über die Zeit/Leistung eines Schul-iPads.

## Versionsstand, Prüfsummen und GitHub

Verwendet: Node **24.22.1**, npm **11.9.0**, TypeScript **7.0.2**, Vite **8.3.6**, React **19.3.1**, Playwright **1.65.0**, Vitest **5.1.0**, Ajv **8.20.0**, Chromium **156.0.8078.79**, Python **3.12.14**, Poppler **25.03.0**, Debian 13. Paketversionen sind vollständig im Lockfile fixiert. Die neuen Runtime-Lizenzhinweise werden in die HTML eingebunden.

Der Remote-Stand wurde nur gelesen:

| Referenz | Remote-Commit |
| --- | --- |
| `main` | `1fa1fff81e5e19b7031130c8d034a77d9e1ace61` |
| `feat/mysteryboard-template-print-integration` | `e14a09273be38c5501dc36ff3a7b819de298cd3a` |
| Tag `unterricht-2026-11-13-rc2` | Tagobjekt `e25fa3fc483f1cd181f31960c9fe575fe358ec69`, Ziel `2c39d5427dc7cbd03558657d62821823949ac170` |
| Neuer Autorenbranch | lokal, nicht auf origin veröffentlicht |

Geschützte RC2-HTML: **459.542 Bytes**, SHA-256 `21dd6ad5c813ba5bd12ca521f03602a195ccea44ee70769119280e4ca088fd5f`. RC2-SCORM-SHA-256 `42ac3d51e2e34431efe9b0ca9b0f4e84085d9b651e4fac6747d843bf6091c3a0`. Die maschinenlesbare Endkontrolle umfasst weitere geschützte Dateien und den unveränderten Bestand und die dokumentierte zusätzliche Synchronisationsassertion; maßgeblich ist `protected-and-remote.json`.

Die endgültigen neuen Dateigrößen und SHA-256 stehen in `artifacts/Universal-integrity.json`, `ARTIFACTS.json`, `PROJECT-VERSION.json` und der äußeren `SHA256SUMS.txt`. Die ZIP-SHA kann nicht in ihrer eigenen inneren Prüfsummenliste stehen; dafür gibt es die äußere Integritätsdatei. Alle Archive werden nach der Erstellung wieder geöffnet, CRCs und Einträge geprüft.

## Grenzen und noch erforderliche Prüfungen

- **WebKit:** Playwrights WebKit 27.2 (Revision 2388) wurde heruntergeladen, startet aber wegen fehlender Bibliotheken nicht: `libgtk-4.so.1`, `libgraphene-1.0.so.0`, `libharfbuzz-icu.so.0`, `libmanette-0.2.so.0`, `libhyphen.so.0`, `libGLESv2.so.2`. WebKit 26.5 ist hier nicht verfügbar. Installations-/Startprotokolle sind beigelegt. Keine Ersetzung dieser Ergebnisse durch Chromium.
- **Lokale HTML-Dateien:** Der verwaltete Chromium der Cloud blockiert `file://` durch Administratorrichtlinie. Die unveränderten Einzeldateien wurden über einen lokalen HTTP-Prüfserver geladen und danach offline betrieben. Kein Umgehen dieser Richtlinie. Direktes Öffnen auf Mac/iPad muss real geprüft werden.
- **Druck:** Die Cloud-Richtlinie deaktiviert den sichtbaren Systemdruckdialog. Geprüft wurden das bewusste Aufrufen von `window.print()` (kein automatischer Aufruf), die tatsächlich vorbereitete Druckfassung und echte PDF-Bytes über Chromiums nativen PDF-Backend samt Poppler. Dies ist **kein** Nachweis des sichtbaren OS-Dialogs oder des nativen Safari-Druckwegs.
- **LMS:** Der echte itslearning-Player wurde nicht aufgerufen. Einbettung, Dateidialog, Download/Teilen, CSP/Berechtigungen für Inline-Programm und eingebettete Worker sowie Kamerazugriff müssen vor Ort geprüft werden. Der Testserver ist keine Veröffentlichung. Das lokale API-Mock ist keine ADL-Zertifizierung.
- **Medien:** Kein direkter PDF-/Word-/OCR-Import. Lokale PDF-Seitenkonvertierung würde zusätzlich einen PDF-Parser/Renderer, Seitenwahl und eigene Speicher-/Sicherheitsprüfungen benötigen. Für diese Runde wurde der geprüfte PNG/JPEG/WebP-Weg gewählt; PDF-Seiten vorher lokal exportieren. Die 4×-Ansicht ersetzt keine ausreichend aufgelöste Originalgrafik. Tatsächlicher Safari-Speicherhöchstwert wurde nicht gemessen.
- **Hilfen:** Methodentext ist editierbar, vorhandene Kategorie-Metadaten bleiben erhalten; ein vollständiger grafischer Kategorieneditor ist bewusst noch nicht umgesetzt. Ohne Metadaten wird keine fachliche Zuordnung erfunden.
- **Berechtigung/Sicherung:** Lokaler Lehrkräftemodus ohne Anmeldung; keine sichere Zugangsbarriere. Keine vertraulichen Musterlösungen in Schülerdateien. Browser-Verlassenswarnungen sind mobil nicht garantiert. Erfolgreiche Dateierzeugung bestätigt keine externe Ablage.
- **Inhaltsqualität:** Die neuen Beispiele sind neutrale technische Prüfmaterialien. Jedes zukünftige Fach-Mystery muss fachlich geprüft werden. Es wurde kein fremder KI-Anbieter und kein bezahlter Dienst verwendet.

Nächster Freigabeschritt ist der dokumentierte Test der **genau gelieferten** universellen HTML/SCORM und der Beispielaufgabe auf dem vorgesehenen Mac/Safari und verwalteten Schul-iPad im echten itslearning-Kurs: erstellen/importieren, Medien lesen, Touch, speichern, Anwendung schließen, neue Sitzung vollständig wiederherstellen, PDF tatsächlich speichern. Canva separat, falls vorgesehen. Erst danach kann eine schulische Einsatzfreigabe erfolgen; es wurde keine automatisch behauptet oder veröffentlicht.
