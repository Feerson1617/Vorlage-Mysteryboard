# Prüfbericht zur Zweitkorrektur von MysteryBoard

Prüfdatum: 9. November 2026. Ausgangsbasis: `2518a530e3faf75cee999259a583b07f7175cb5a`, Entwicklungsbranch `feat/mysteryboard-prototype`. Die bisherigen Korrekturen aus `docs/NACHBESSERUNG.md` bleiben erhalten. Keine Veröffentlichung, kein Merge und keine Änderung an `main`.

Die beiden Original-Reproduktionen wurden vor der Änderung auf den HTML-Artefakten von `2518a53` erneut beobachtet: M2 erzeugte eine PNG, deren Zustand der Import als ungültig zurückwies; M1 öffnete mit Maus und Touch „Verbindung 1 und 3“ beim sichtbaren Label von 1–2. Das Protokoll `test-evidence/review/baseline.txt` enthält diese drei erwarteten Fehlschläge. Die späteren Abnahmetests verlangen das korrigierte Verhalten.

## Ursachen und Änderungen

| Kriterium | Ursache und konkrete Änderung | Betroffene Dateien |
| --- | --- | --- |
| M2, gültige neue IDs | „Größte ID + 1“ erzeugte nach einem zulässigen Import mit ID 1.000.000 eine ungültige ID. Die Vergabe verwendet jetzt die kleinste freie positive ID; bei höchstens 300 Verbindungen liegt eine freie ID sicher im gültigen Bereich. Bestehende IDs bleiben erhalten. Zusätzlich validiert der Export den vollständigen Zustand vor dem Anlegen des Canvas. | `src/core/model.ts`, `src/App.tsx`, `src/core/export.ts` |
| M1, richtiges Antippziel | Die transparente Trefferlinie einer später gezeichneten Verbindung lag vor einem sichtbaren früheren Label. Alle Labels liegen jetzt über sämtlichen Linien und deren Trefferflächen. Karten bleiben davor. Canvas und SVG verwenden dieselbe Zeichenreihenfolge. Unbeschriftete Linien behalten die mindestens 44 CSS-Pixel breite Trefferfläche. Der 220er-Touchtest fand zusätzlich einen durchgereichten nativen Klick: Ein auf `pointerup` geöffneter Dialog konnte mit demselben Fingertipp bereits seine Löschen-Aktion erhalten. Die Geste merkt nun nur das Antippziel vor; erst der abschließende `click` öffnet den Dialog. Ziehen, Pinch und abgebrochene Gesten hinterlassen kein Antippziel. | `src/components/Board.tsx`, `src/core/export.ts` |
| M4, außenliegende Nummern | Ein fester Mittelpunkt bei −5/−5 konnte den vergrößerten Kreis nicht außerhalb halten. Gemeinsame Badge-Geometrie positioniert den ganzen Kreis einschließlich Rand oberhalb und links der Karte. Die Übersicht berechnet die Einpassung mit den zoomabhängigen Außenmaßen. Die Ziffern zielen in der normalen Übersicht auf 16 CSS-Pixel; die Weltgröße ist begrenzt, damit sie beim starken Herauszoomen nicht immer weiter wächst. | `src/core/layout.ts`, `src/components/Board.tsx`, `src/core/export.ts` |
| Werkzeugleiste | Starre Zeilen und eine feste Board-Höhe passten nicht zu den tatsächlichen Werkzeugbreiten um 601–640 Pixel. Leiste und Navigation dürfen umbrechen; das Board belegt den verbleibenden Platz. Zugängliche Namen und mindestens 48 × 48 Pixel große Schaltflächen bleiben erhalten. | `src/App.tsx`, `src/style.css` |
| Lesefenster | Ungetrennte Kennungen erzwangen eine Überbreite. `overflow-wrap: anywhere` erlaubt notwendige Wortumbrüche, ohne Inhalt zu entfernen. | `src/style.css` |
| Sofortiges Sichern nach Abbruch | Ein boolescher Laufstatus verwarf den zweiten Aufruf still. Ein neuer Aufruf zeigt nun einen Wartestatus und wartet auf die Freigabe des laufenden Canvas. Nur der jüngste noch geöffnete Auftrag rendert seinen aktuellen Zustand; abgebrochene Ergebnisse werden verworfen. | `src/App.tsx` |
| Q1, zeitabhängige Referenz | Die Ansicht wurde direkt nach dem Klick vor dem Fit-Effekt gemessen. Der Test wartet nun auf die bereits bekannte passende Ausgangstransformation und behält danach die vollständige Assertion zur unveränderten Ansicht bei. | `tests/browser/prototype.spec.ts` |
| M5, verständliche Farblegende | Der Export zeigte einen internen Index. Er enthält nun z. B. „Violett – Flächennutzung“ mit passendem Farbfeld; benannte Kategorien werden untereinander vollständig ausgegeben. | `src/core/export.ts` |

Keine neue permanente Bedienleiste, Bewertung, Musterlösung, automatische Speicherung, SCORM-Version oder mehrseitige Druckfunktion. Die beiden Produktions-Inhaltsdateien sowie Sicherungsformat, QR-Grenze und History-Reducer wurden nicht verändert. Erzeugen, Download und Teilen einer PNG bestätigen weiterhin **keine dauerhaft erfolgte Ablage außerhalb der Anwendung**. Bei Änderungen bleibt der Verlassenshinweis aktiv; vollständiges Rückgängig zum geladenen Ausgangsstand entfernt ihn.

Die gezielten Nachweise liegen in `tests/browser/review.spec.ts` und `tests/edge-id.test.ts`. Bestehende Prüfungen wurden in `tests/browser/prototype.spec.ts`, `tests/browser/corrections.spec.ts` und ausschließlich beim Zeitbudget in `tests/limits.test.ts` angepasst. `vite.config.ts` und `package.json` ergänzen nur den getrennten QA-Build; `README.md` verlinkt den aktuellen Bericht. Protokolle und Messdaten liegen unter `docs/test-evidence/review/`.

## Prüfdaten und Verfahren

Die unveränderten PNG-Eingaben `Start-ID-1000000.png` und `60-90-Gruppenstand.png` liegen mit Herkunft und SHA-256 in `tests/fixtures/review/`. Der 220-Verbindungen-Test verwendet die originalen Inhalte und den originalen Startzustand aus der gelieferten `Nur-zur-Prüfung-220-Verbindungen.html`, nicht ein ähnlich erzeugtes Ersatzboard. `scripts/extract-review-fixture.py` extrahiert ausschließlich Literale. Der separate Vite-Modus `review` baut die aktuellen Korrekturen mit diesen Daten; die Schülerpakete enthalten diese QA-Daten nicht.

Umgebung: Node.js 24.22.1, npm 11.9.0, Chromium 156.0.8078.79 unter Linux, Playwright 1.65.0. Einzelne HTMLs werden über einen lokalen statischen HTTP-Server geöffnet. Offline-Tests schalten das Browsernetz nach der ersten HTML-Antwort ab und kontrollieren zusätzlich die Anfragen. Das ist kein Nachweis für `file://`, einen Canva-Host oder ein Schul-iPad.

## Neu erzeugte Produktionsartefakte

| Datei | Bytes | SHA-256 |
| --- | ---: | --- |
| `artifacts/MysteryBoard-klein.html` | 450263 | `087166f21d0f834f95aaa6d129e8897865465d98a8edffd94a6abebc9efe4602` |
| `artifacts/MysteryBoard-umfangreich.html` | 483149 | `beb1af104ad773a8fd7b18d061794f087ada79d5066ce2bc628f5dd5115b4be4` |

Beide liegen deutlich unter 10.000.000 Bytes. Die eindeutige Commit-ID wird nach dem Commit im begleitenden Liefermanifest und im ausgelieferten Prüfbericht eingetragen; im Repository ist sie über den unten angegebenen `git log`-Befehl nachvollziehbar. Dadurch muss ein Commit nicht seinen eigenen Hash enthalten.

## Vollständige Befehle

Arbeitsverzeichnis: `/workspace/Vorlage-Mysteryboard`. Protokolle liegen unter `docs/test-evidence/review/`; die vollständige HTML-Browserauswertung mit Screenshots wird außerdem im Lieferpaket mitgegeben. Die versionierten Textprotokolle entfernen lediglich Leerzeichen am Zeilenende; die Rohprotokolle liegen zusätzlich unverändert im Lieferpaket.

```sh
# Vorher: drei erwartete Reproduktionsfehler auf den alten HTML-Artefakten.
set -o pipefail
npx playwright test tests/browser/review.spec.ts 2>&1 | tee /tmp/mysteryboard-review-baseline.log

# Separate Prüffassung aus den gelieferten 220er-Daten.
npm run build:review
npx playwright test tests/browser/review.spec.ts 2>&1 | tee /tmp/mysteryboard-review-targeted.log

# Gesamtlauf: Vitest, Typprüfung, beide Produktionsbuilds samt Größenprüfung,
# separater QA-Build und sämtliche Playwright-Browsertests.
npm run check 2>&1 | tee /tmp/mysteryboard-review-check.log

# Q1: fünf unabhängige Wiederholungen nach dem Gesamtlauf.
npx playwright test tests/browser/prototype.spec.ts --grep 'Lesen, Ziehen' --repeat-each=5 2>&1 | tee /tmp/mysteryboard-review-repeat.log

# Zusätzlich versucht; Downloadserver durch die Umgebung gesperrt.
PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright npx playwright install webkit 2>&1 | tee /tmp/mysteryboard-review-webkit.log

# Identität der ausgelieferten Produktionsdateien.
wc -c artifacts/MysteryBoard-klein.html artifacts/MysteryBoard-umfangreich.html
sha256sum artifacts/MysteryBoard-klein.html artifacts/MysteryBoard-umfangreich.html
git log -1 --format=%H -- artifacts/MysteryBoard-klein.html artifacts/MysteryBoard-umfangreich.html
git diff --check
```

Der erste Gesamtlauf endete bei einem CPU-Zeitlimit: Der 60-Karten-Test mit mehreren vollständigen 30-MB-CRC-Durchläufen benötigte 6,149 Sekunden gegenüber dem Standardlimit von 5 Sekunden. Für ausschließlich diese schweren Grenztests wurde das Zeitbudget auf 20 Sekunden erhöht; sämtliche Byte-, Wiederherstellungs- und Integritätsassertionen bleiben unverändert. Das ursprüngliche Fehlerprotokoll bleibt in `check-initial.txt` erhalten. Der bestehende absichtliche Fehler an Byte 15 in `tests/persistence.test.ts` wurde nicht entfernt oder abgeschwächt.

Ein weiterer Zwischenlauf wurde nach zwei bestätigten Testanpassungsfehlern abgebrochen (`check-adaptation.txt`): Der Mittelpunkt der erweiterten SVG-Kartengruppe lag bei Karte 60 im freien Bereich zwischen Außen-Nummer und Karte; der Test klickt jetzt auf den sichtbaren Kartenkörper. Beim direkten Labeltest lag die Schrift über dem ausgewählten Hintergrundrechteck; Ziel ist nun die gesamte sichtbare Labelgruppe. Beide Tests behalten ihre Bearbeitungs- und Wiederherstellungsassertionen. Die SVG-Pixelprobe des kleinen Exports maß nach dem veränderten Rand 31 × 80 Vollfarbpixel; ein einziger Randpixel entspricht bei dieser Breite bereits über 3 %. Die Pixelprüfung rendert deshalb A3 und behält die strenge 2-%-Toleranz bei. Beide Exportgrößen werden weiterhin auf korrekte Wiederherstellung getestet.

Der anschließende Gesamtlauf bestand 32/33 Browserprüfungen und deckte den oben beschriebenen echten Touch-Folgefehler am Original-Label 92 auf (`check-touch.txt`). Pointer-Aufzeichnungen bestätigten das korrekte Antippziel; der nachlaufende native Klick löschte die Verbindung im gerade geöffneten Dialog. Dieser konkrete Ablauf bleibt als Regression im 220er-Touchtest enthalten. Nach der Korrektur bestand der gezielte Touchfall. Der im selben Prüfbefehl vorausgehende Mauslauf überschritt während der initialen Darstellung das globale 60-Sekunden-Budget; die beiden umfangreichen Medienprüfungen erhalten nun wie der vorhandene große Board-Test 120 Sekunden Gesamtbudget, ohne Assertions zu entfernen (`touch-fixed-initial.txt`). Anschließend wurden sämtliche Tests erneut ausgeführt.

## Abnahme und Regression

Der abschließende `npm run check` endete mit **Exitcode 0**: **31/31 Datentests**, erfolgreiche TypeScript-Prüfung und Builds sowie **33/33 Chromium-Browsertests**, ohne übersprungene oder als instabil eingestufte Tests. Der Übersichtstest bestand zusätzlich **5/5 Wiederholungen** (Exitcode 0). Messwerte und Artefaktprüfsummen stehen in `test-evidence/review/results.json`.

Beim 220er-Board wurden je Eingabemodus **160 geometrisch unverdeckte Labelzentren** korrekt getroffen; **146** davon liegen über fremden Linien-Trefferflächen. Acht dieser Kreuzungslabels wurden jeweils tatsächlich geöffnet, ein weiteres geändert, gelöscht und wiederhergestellt. Alle Ziffern in den vier geprüften normalen 12er-/60er-Übersichten messen **16 CSS-Pixel** (bis auf Rundungsreste). Die Kartenlegende mit 16 Pixel Quellschrift ergibt bei 768/1024 Pixel Fensterbreite **4,6 CSS-Pixel**, bei 320 Pixel Breite **3,936 CSS-Pixel**; beim Diagramm wären 16 Pixel Quellschrift entsprechend **7,08** bzw. **3,28 CSS-Pixel** hoch.

| Prüfung | Nachweis |
| --- | --- |
| M2 | Original-Grenzstand laden; dreimal Anlegen, Löschen, Undo und Redo; vollständiger Stand mit 12 Karten und 10 Verbindungen; Export, frischer Browserkontext, weiter bearbeiten und identischer erneuter Export. Bestehende IDs und Kategorien geprüft. Ungültiger Zustand wird direkt vom Export abgelehnt. |
| M1 | Kleiner Originalfall mit Maus und Touch: sichtbares 1–2-Label ändern und löschen, 1–3 bleibt erhalten. Freie unbeschriftete Linie zusätzlich 12 Pixel neben ihrem sichtbaren Strich antippen. 220er-Board: alle geometrisch unverdeckten Labelzentren auf korrekte Treffer prüfen; acht Kreuzungslabels je Eingabemodus öffnen, eines ändern/löschen und rückgängig machen. |
| 12, 60/90 und 60/220 | Alle Felder einschließlich Kartenreihenfolge, Positionen, Farben, Verbindungen, Richtungen, Labels und Kategorien nach PNG-Rückübernahme vergleichen. Für die gelieferten Stände zusätzlicher neuer Browserkontext und erneuter Export. |
| Kartennummern | 12/60 Karten bei 1024 × 768 und 768 × 1024; alle Nummern vollständig im Board, außerhalb der Karte, ohne Überdeckung anderer Karten und mindestens 15 CSS-Pixel große Ziffern. Nummern 1/12/23/60 öffnen die zugehörige Karte; Ziehen über die Nummer und erneutes Fit geprüft. Beim extremen Herauszoomen schrumpfen sie wieder. Canvas-Außenposition separat geprüft. |
| Leiste und Lesefenster | 14 Breiten von 320 bis 1024 Pixel, darunter 600/601/610/620/640; kein horizontaler oder zusätzlicher vertikaler Seitenüberlauf, fünf erreichbare Werkzeuge. Ungetrennte Kennung und 3999-Zeichen-Text vollständig, kein horizontaler Dialogüberlauf bei 320/768/1024 Pixeln. |
| Sicherung nach Abbruch | Canvas-Rückruf kontrolliert zurückhalten, schließen, Farbe ändern und sofort erneut sichern: sichtbarer Wartestatus, kein veralteter Download, genau zwei aufeinanderfolgende Kodierungen, höchstens eine gleichzeitig, korrekter letzter Stand und weiterhin aktiver Warnstatus. |
| PNG-Grenze | Gültige PNG knapp unter 30.000.000 Bytes; einschließlich Datenblock zu groß → Ablehnung. Exakt 30.000.000 Bytes für 12/60 Karten → identische Wiederherstellung und Ersetzen des Zustandsblocks. A3-Überschreitung → kleinerer gültiger Export; beide Modi zu groß → verständliche Meldung ohne Download. |
| History und Dirty | Mehrere aufeinanderfolgende Positions-, Farb-, Kategorie- und Verbindungsaktionen; Undo/Redo, neue Bearbeitung verwirft Zukunft, Laden setzt beide Historien zurück, 40er-Grenze bleibt erhalten. Erzeugen/Download/Teilen bestätigen keine dauerhafte Ablage; echter Chromium-Verlassensdialog geprüft. |
| Bildproportionen | Bestehende Pixelmessungen für quadratische, hochformatige und breite Rasterbilder sowie SVG ohne viewBox bestehen im Board und Export. |
| Touch und Ressourcen | Bestehende Zwei-Finger-, Abbruch- und Verbindungsfälle ohne unbeabsichtigte Kartenänderung; Offline-Betrieb ohne externe HTTP(S)-Anfragen; HTML-Build lehnt ≥ 10.000.000 Bytes ab. |
| Q1 | Exakte Fit-Transformation vor Referenzmessung abwarten; fünf Wiederholungen und Gesamtlauf, ohne feste zusätzliche Wartezeit. |

## Offene Risiken und notwendige Praxisabnahme

**Keine schulische Freigabe.** Die tatsächliche Canva-Veröffentlichung und Wiederherstellung auf verwalteten Schul-iPads wurden nicht ausgeführt. WebKit konnte in dieser Umgebung wegen HTTP 403 „Domain forbidden“ auf den offiziellen Downloadservern nicht installiert werden. Die WebKit-Ergebnisse der mitgelieferten Zweitprüfung gehören zum älteren Stand; sie gelten nicht als Test dieser Korrektur. Auch ein erfolgreicher späterer WebKit-Lauf ersetzt keine reale iPad-Abnahme.

**Vor medienreichen Mysterys erforderlicher gesonderter Auftrag:** Das 1000 × 800 Pixel große Kartenbild wird im Lesefenster weiter proportional auf maximal 230 Pixel Höhe eingepasst. 16 Pixel Quellschrift entsprechen damit nur 4,6 CSS-Pixeln, auf schmalen Geräten teilweise weniger. Legende und kleine Messstellennamen sind so nicht ausreichend zugänglich. Auch das komplexe Diagramm muss in vergrößerter Einzelansicht lesbar sein. Eine gezielte Bildvergrößerung mit Verschieben und gutem Rückweg ist deshalb vor einem solchen Facheinsatz zu beauftragen und am echten Gerät zu prüfen. Sie wurde hier ausdrücklich **nicht implementiert**. Prüfziel: Legende sowie mindestens zwei Messstellennamen und kleine Diagrammbeschriftungen ohne Raten lesen; vergrößern/schließen darf keine Board-Aktion auslösen. Browser-Seitenzoom im Canva-Host ist bislang kein verifizierter Ersatz.

Weitere Grenzen: Absichtlich übereinandergelegte Karten dürfen einander verdecken; beim extremen Herauszoomen werden auch Nummern kleiner. Die Daten bleiben vollständig, aber ein einzelnes Gesamtbild garantiert keine Lesbarkeit jedes Details oder verdeckter Karten. A3 benötigt rund 66,4 MiB allein für die RGBA-Fläche, ohne weitere Browserkopien; echte iPad-Spitzen und Betriebssystemabbrüche bleiben zu messen. Mobilbrowser können den Verlassenshinweis auslassen. CRC und SHA prüfen Integrität, keine Urheberschaft; der Zustandsimport bestätigt nicht die vollständige Dekodierbarkeit aller PNG-Pixel. Screenshot-QR-Import, mehrseitiger Druck und SCORM bleiben getrennte spätere Aufträge.

Vor Einsatz: die exakt identifizierten HTMLs in der tatsächlichen Canva-Veröffentlichung prüfen, Schülerlink in der vorgesehenen itslearning-Einbettung öffnen und mit verwalteten Schul-iPads Dateiauswahl, Ablage in „Dateien“, Schließen/neue Sitzung, Wiederherstellung aller 12/60/220 Zustände, Kamera/QR, Gesten, Hoch-/Querformat, Offline-Verhalten und Speicherbedarf durchspielen. Siehe zusätzlich `PRAXISTEST.md` und die mitgelieferte unabhängige `Schul-iPad-Abnahme.md`.
