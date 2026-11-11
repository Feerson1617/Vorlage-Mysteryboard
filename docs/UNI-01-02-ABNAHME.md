# MysteryBoard – UNI-01 und UNI-02

## Ausgangsstand und Umfang

Geprüfte technische Korrektur vom 11. November 2026. Entwicklungsbranch `feat/mysteryboard-prototype`, Git-Basis `545ece1fd723b953e4b36456d37bd6210a5ac916`. Die tatsächliche Ausgangsfassung ist die vollständige universelle Lieferung `MysteryBoard-Universelle-Vorlage-Boden-2.0.0.zip`, SHA-256 `be8e39950a6483dd755d4d17efce6ba515b1f900ac5e8923f820955345334e75`. Vor der Änderung wurden sämtliche 140 Dateien ihres `source/`-Verzeichnisses byteweise mit dem Checkout verglichen: identisch. Es wurde weder zum alten Git-Stand noch zum reinen R1b-Stand zurückgekehrt.

Auftrag: `Codex_Prompt_MysteryBoard.zip`. Laufzeitänderungen betreffen ausschließlich `src/App.tsx` und `src/style.css`. Universeller Anwendungskern, drei Produktionsvarianten, Fünf-Karten-Beispiel und 220-Verbindungen-Test bleiben erhalten. Fachinhalte, Datenmodell, Codec, History, Bildrenderer, PNG-/QR-Sicherung und R1b-Ereignisbehandlung sind gegenüber der universellen Ausgangsfassung unverändert.

## Reproduzierte Vorher-Befunde

Das reproduzierende Skript wurde vor dem Neubau gegen die unveränderten Produktions-HTMLs ausgeführt. Drei Bedienketten erzeugten jeweils eine gültige PNG ohne Team: leerer Start, gültiger Start mit anschließender leerer Namensänderung sowie Änderung auf reine Leerzeichen. Alle drei PNGs hatten 1.258.686 Bytes, Schema 1 und ließen sich in einer frischen Sitzung mit allen 18 Karten wiederherstellen, weiterhin ohne Team. Die angebotenen Downloads und die Dateien sind als Vorher-Nachweise aufbewahrt.

UNI-02 wurde bei 768×1024 und 1024×768 mit „Emma, Leon und Mia“ geprüft: der Name stand links bei x=20 in einer 124 Pixel breiten Zone mit 12-Pixel-Schrift. **Das berichtete Abschneiden dieses konkreten kurzen Namens war hier nicht reproduzierbar** (gemessene Textbreite etwa 114 Pixel). Die falsche Position war nachweisbar. Bei 480×800 lag eine zusätzliche Namenszeile oberhalb der Werkzeuge; die Leiste war 92 Pixel hoch. Diese Messung wird nicht als Nachweis eines in dieser Umgebung nicht beobachteten Abschneidens ausgegeben. Die Browserfassung war Chromium 156.0.8078.79.

Nachweise: `test-evidence/uni-01-02/before/before.json`, Screenshots und Original-PNGs in der Lieferung. `scripts/reproduce-team-requirements.mjs` ist der erhaltene reproduzierende Test gegen die Vorher-Artefakte; deren Dateigrößen und SHA-256-Werte sind im JSON festgehalten.

## Änderungen

**UNI-01:** Die Oberfläche verlangte zuvor weder beim Start noch beim Ändern einen nichtleeren Namen. Der Modellhelfer `withTeam` bildet einen leeren Namen korrekt auf das technisch gültige Legacy-Format ab; diese Eigenschaft allein ist keine ausreichende Prüfung eines neuen Schülerprodukts. Die neue UI-Prüfung verlangt beim Start und bei Namensänderungen eine gültige, nichtleere Teambezeichnung. Fehler werden direkt am bisherigen Feld angezeigt, diesem zugeordnet und fokussiert. Eine neutrale Gruppenbezeichnung genügt.

Alle Schülerexportwege laufen durch dieselbe Prüfung in `App.save`: normaler Export, kleiner Menüexport, kleiner Export aus dem Sicherungsdialog sowie Export nach Import oder Undo/Redo. Fehlt der Name, erscheint der vorhandene Namensdialog. Gültige Übernahme setzt den angefragten Exportmodus ausdrücklich mit dem neu benannten vollständigen Zustand fort; es wird kein veralteter React-Zustand exportiert. Schließen oder Escape verwirft die Exportabsicht, erhält die Arbeit und entfernt ein vorher angebotenes Bild. Die bestehende Operations-ID verhindert, dass abgebrochene asynchrone Exporte später ein altes Ergebnis anbieten.

Teamlose Altsicherungen bleiben unverändert gültig, importierbar und bearbeitbar. Die Legacy-Datenprüfung wurde nicht verschärft. Erst vor einem neuen Schülerexport ist eine Teamangabe nötig. Ungültige Änderungen erhalten einen vorhandenen Namen und sämtliche Arbeitsdaten. Äußerer Leerraum wird wie bisher entfernt; Umlaute und bis zu 80 UTF-16-Codeeinheiten bleiben unterstützt. Keine erfundenen Ersatznamen, keine automatische Speicherung oder Übertragung.

**UNI-02:** Die 124-Pixel-Gruppe links unter der Marke entfällt. Der Name steht rechts in derselben Werkzeugleiste, mit 16 Pixeln Schriftgröße in den iPad-Referenzansichten. Bis 900 Pixeln schaffen die bestehenden History-Symbole und die ausgeblendete Marke Platz. Bis 480 Pixeln werden Abstände und Textgröße kompakter; bis 420 Pixeln steht der vollständige Name im vorhandenen Menü. Es gibt keine zusätzliche dauerhafte Namenszeile und keinen neuen Button. Sehr lange Namen dürfen in der Leiste mit Auslassungszeichen erscheinen; das Menü zeigt den gesamten Text mit Umbruch. Daten und PNG werden nicht gekürzt. Der bereits korrekte PNG-Kopfbereich bleibt unverändert.

## Testanpassungen und Ergebnisse

Der abschließende `npm run check` bestand vollständig mit Exit 0: **50/50 Datentests in sechs Dateien, TypeScript-Prüfung, drei Produktionsbuilds, zwei Prüfbuilds und 96/96 Chromium-Browsertests**. Darin sind alle 80 bisherigen Browserfälle und 16 neue UNI-Fälle enthalten. Keine ausgelassenen Fälle, keine Fehler und keine Wiederholungs-Erfolge. Node.js 24.22.1, Playwright 1.65.0, Chromium 156.0.8078.79.

Bestanden sind insbesondere Pflichtname in allen vier Inhaltsvarianten, Ablehnung leerer/Whitespace-Änderungen, Umlaute/80 Zeichen, teamloser Legacy-Import, Nachtrag und vollständiger frischer PNG-Rundlauf in beiden Größen, Menü- und Vorschau-Export, Abbruch und vorherige Vorschau, Undo/Redo, alle sieben Layoutbreiten mit drei Namensfällen, Offlinebetrieb ohne zusätzliche HTTP(S)-Anfragen in den instrumentierten Abläufen sowie die bisherigen PNG-/ID-Grenzen, M1/M2 und R1b-Touchketten einschließlich 220 Verbindungen. Datenmodell- und Inhaltsprüfungen blieben unverändert. Terminalhinweise zu npm und NO_COLOR betreffen die Testwerkzeuge; sie sind keine Anwendungsfehler.

Neue Abnahmen stehen in `tests/browser/team-requirements.spec.ts`, die Vorher-Reproduktion in `scripts/reproduce-team-requirements.mjs`. `tests/browser/team-helpers.ts` enthält ausschließlich bewusste Testeingaben und das Beantworten einer sichtbaren Namensabfrage. Angepasst wurden die sechs vorhandenen Browserdateien `corrections.spec.ts`, `prototype.spec.ts`, `r1.spec.ts`, `r1b.spec.ts`, `review.spec.ts` und `universal.spec.ts`. README, Formaterläuterung, Vorlagenanleitung und Unterrichtserprobung beschreiben die neue Pflichtangabe. Der vollständige Dateiabgleich steht in `test-evidence/uni-01-02/scope.json`.

Bestehende Tests wurden gezielt an die neue Anforderung angepasst: neue Arbeiten geben einen ausdrücklichen Testnamen ein; vollständige PNG-Vergleiche enthalten diese bewusste Bearbeitung. Undo-/Dirty-Prüfungen berücksichtigen den schon zuvor bestehenden History-Schritt der ersten Teamangabe. Legacy-Importe bleiben teamlos geprüft; erst beim tatsächlichen neuen Schülerexport wird die sichtbare Nachfrage beantwortet. Die bisherige Erwartung „leere Namensänderung entfernt den Namen und kann exportiert werden“ wurde durch Abweisung, Fokus und Zustandserhalt ersetzt. Keine Ereignis-, Integritäts- oder Datenvergleichsassertion wurde pauschal entfernt. Direkte Codec-/Canvas-Tests dürfen weiterhin technisch gültige teamlose Legacy-Daten verarbeiten.

Die gerenderten Screenshots wurden tatsächlich betrachtet: „Emma, Leon und Mia“ steht bei 768×1024 und 1024×768 vollständig und gut lesbar rechts in derselben Werkzeugzeile; auch die 480-Pixel-Ansicht zeigt diesen Namen vollständig. Bei 320 Pixeln bleiben die fünf Werkzeuge erreichbar, der vollständige 80-Zeichen-Name ist im bestehenden Menü mit Umbruch sichtbar. Die 80-Zeichen-PNG-Kopfzeile wurde als Raster betrachtet: vollständiger Titel links, vollständiger Name rechts, getrennte Bereiche mit Umbruch, keine Überlagerung. Der sichtbare Boardname darf beim Grenzfall kürzen; der gesamte Name bleibt im Menü und in der Sicherung erhalten.

Die Messmatrix umfasst 320, 480, 600, 601, 640, 768 und 1024 Pixel mit jeweils „Team Marschboden“, „Emma, Leon und Mia“ und dem 80-Zeichen-Grenzfall. Sie prüft reale Element- und Textgrenzen, Position, Überlauf, mindestens 48×48-Pixel-Ziele, Headerhöhe und die vorhandenen Menüaktionen. Screenshots liegen unter `test-evidence/uni-01-02/after/`, Messwerte in `test-evidence/uni-01-02/measurements.json`.

| Breite | Kopfhöhe | Übliche Namen | 80-Zeichen-Name |
| ---: | ---: | --- | --- |
| 320 | 70 px | im Menü | vollständig im Menü und PNG |
| 480 | 70 px | vollständig | vollständig im Menü und PNG |
| 600 | 70 px | vollständig | vollständig im Menü und PNG |
| 601 | 74 px | vollständig | vollständig im Menü und PNG |
| 640 | 74 px | vollständig | vollständig im Menü und PNG |
| 768 | 74 px | vollständig | vollständig im Menü und PNG |
| 1024 | 74 px | vollständig | vollständig im Menü und PNG |

Sichtbare Nachweise: [iPad-Hochformat](test-evidence/uni-01-02/after/team-768-1.png), [iPad-Querformat](test-evidence/uni-01-02/after/team-1024-1.png), [480-Pixel-Ansicht](test-evidence/uni-01-02/after/team-480-1.png), [vollständiger Name im 320-Pixel-Menü](test-evidence/uni-01-02/after/team-320-full-menu.png) und [PNG-Kopfzeile mit 80 Zeichen](test-evidence/uni-01-02/after/80-zeichen-export-kopfzeile.png).

**Dokumentierter Zwischenbefund:** Der erste Gesamtlauf hatte 93 bestandene Browserfälle und drei fehlgeschlagene neue Legacy-Exportfälle. Deren erwarteter Zustand setzte Rot beim ersten Arrayelement (ID 7), während die reale Bedienung korrekt Karte 1 änderte. Die Testvorbereitung wurde ausschließlich auf die tatsächlich bediente Karten-ID korrigiert; der vollständige Zustandsvergleich blieb erhalten. Die Anwendung wurde dafür nicht verändert. Protokoll: `check-fixture-error.txt`, strukturierte Fehler: `fixture-error-details.json`. Anschließend wurde der vollständige Lauf erneut ausgeführt.

Arbeitsverzeichnis: `/workspace/Vorlage-Mysteryboard`.

```sh
# Vor dem Neubau, gegen die damals noch unveränderten Produktions-HTMLs:
node scripts/reproduce-team-requirements.mjs > /workspace/mysteryboard-uni-fixes-evidence/before/run.txt 2>&1

npx tsc --noEmit
npm run build
node scripts/build.mjs --tests

# Vollständiger abschließender Lauf mit alten und neuen Tests:
set -o pipefail
npm run check 2>&1 | tee /workspace/mysteryboard-uni-fixes-evidence/check.txt

node --check scripts/reproduce-team-requirements.mjs
git diff --check
sha256sum artifacts/*.html artifacts/tests/*.html
```

Die Vorher-Reproduktion kann separat gegen die bewahrte universelle Ausgangslieferung wiederholt werden (Beispiel, kein zusätzlicher Abnahmelauf):

```sh
node scripts/reproduce-team-requirements.mjs /workspace/mysteryboard-uni-fixes-evidence/before-repeat /workspace/mysteryboard-universal-delivery/source
```

Die vollständigen Terminalausgaben, Vorher-/Nachher-Screenshots, Geometriewerte, Datenvergleiche und der Playwright-Bericht gehören zur Lieferung. Frühe Test- oder Werkzeugbefunde sind getrennt vom abschließenden Ergebnis dokumentiert.

## Artefakte

| HTML-Datei | Bytes | SHA-256 |
| --- | ---: | --- |
| `artifacts/MysteryBoard-klein.html` | 457.990 | `5eee3c8230d51a6a22bc1198843102345b4fe279000d6b130889ca26dd1b94c2` |
| `artifacts/MysteryBoard-umfangreich.html` | 490.876 | `800eeaf7c086a15850980a77e0f517796d4e582dac7fb914b452a94c71bef36f` |
| `artifacts/MysteryBoard-Boden-Klasse11.html` | 459.540 | `4c451aec074a8cca75dd1879fce21ef5a6e0b32ce40b6af9412b9f70186540e8` |
| `artifacts/tests/MysteryBoard-Pruefung-220.html` | 998.589 | `b831f294f2612f72f2ca36a286c030a5574ff536639562fed116e1fada43f66c` |
| `artifacts/tests/MysteryBoard-Test-5.html` | 454.440 | `15b92507687f576578e1c6a885065d2edb9909320556e682e990b311daef77b8` |

Alle fünf HTMLs sind eigenständig und kleiner als 10.000.000 Bytes. Die drei Produktionsvarianten stammen aus demselben Quellstand. Inhaltsdateien und alte Reproduktionsfixtures sind byteidentisch erhalten. Es gibt keine neue Commit-ID; Quellmanifest, inkrementeller Diff und SHA-256-Prüfsummen identifizieren die Lieferung. Kein Commit, PR, Merge, Push oder Veröffentlichung.

## Grenzen und offene Abnahmen

- Chromium-Tests ersetzen keine Safari-/WebKit- oder Schul-iPad-Abnahme. Die zuvor nicht verfügbaren WebKit-Versionen sind weiterhin nicht bestätigt.
- Die verwaltete Browserumgebung blockiert `file://`. Die fertigen HTMLs werden für die Tests einmal über localhost geladen und danach offline benutzt; zusätzliche externe Laufzeitanfragen werden geprüft. Tatsächliche lokale Dateiöffnung und Dateiaufbewahrung auf den Zielgeräten bleiben offen.
- Bei 320 Pixeln steht der Name über das vorhandene Menü zur Verfügung; bei langen Namen kann die Leiste kürzen. Die iPad-Referenzgrößen haben für die sofort sichtbare Teamzuordnung Priorität. Das Menü und die Sicherung enthalten immer den vollständigen Namen.
- Wirkliche HTTPS-/Canva-Veröffentlichung, Download, tatsächliche Ablage und Wiederherstellung auf zwei verwalteten Schul-iPads müssen noch geprüft werden. Keine schulische Freigabe.
- Der im Auftrag genannte unmittelbar nach Touch-Pan gelegentlich ignorierte Toolbar-Tipp wurde nicht zum Anlass einer neuen Ereignissteuerung genommen. Dies bleibt ein Punkt des praktischen Zielgerätetests. Dicht überlagerte Verbindungslabels erfordern gegebenenfalls Zoom.
- Die zuvor dokumentierte zusätzliche Bildvergrößerung vor medienreichen Mysterys bleibt ein eigener Auftrag. Keine Änderung an fachlichen Karten, kein Editor, Backend, Bewertungssystem, mehrseitiger Druckexport oder SCORM.
