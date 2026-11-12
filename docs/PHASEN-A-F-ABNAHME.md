# Unterrichtskandidat und universelle Druckentwicklung – Abnahme A–F

Stand: 12. November 2026, Europe/Berlin. Repository: `Feerson1617/Vorlage-Mysteryboard`.
**Der Unterrichtskandidat ist eingefroren und technisch geprüft. Die getrennte Druckentwicklung besteht 52 Datentests und die vollständige Wiederholung mit 106 Chromiumtests. Keine Veröffentlichung und keine schulische Gerätefreigabe.**

## A – Eingefrorene Unterrichtsversion

- Quellbranch: `feat/mysteryboard-prototype`; sauberer Ausgangsstand und tatsächlicher Remote-Commit: **`240d5fcfcac7e5924efe169493c9f7525ba5ed74`**.
- Feste Referenz: **`unterricht-2026-11-13-rc1`**, annotiertes Tag erstellt, gepusht und dessen Ziel geprüft. Spätere Druckänderungen ersetzen diesen Stand nicht.
- `main` bleibt auf `1fa1fff81e5e19b7031130c8d034a77d9e1ace61`; kein Merge, Force-Push oder Rückfall auf `545ece1`.
- Vollständiges `npm run check`: **50/50 Datentests und 96/96 Chromiumtests bestanden**, keine ausgelassenen Tests. Die frisch gebauten drei HTMLs stimmen bytegenau mit dem eingefrorenen Commit überein.

| Unterrichtsdatei | Bytes | SHA-256 |
| --- | ---: | --- |
| `MysteryBoard-Boden-Klasse11.html` | 459540 | `4c451aec074a8cca75dd1879fce21ef5a6e0b32ce40b6af9412b9f70186540e8` |
| `MysteryBoard-klein.html` | 457990 | `5eee3c8230d51a6a22bc1198843102345b4fe279000d6b130889ca26dd1b94c2` |
| `MysteryBoard-umfangreich.html` | 490876 | `800eeaf7c086a15850980a77e0f517796d4e582dac7fb914b452a94c71bef36f` |

Zusätzliche Produktionsdateiprüfung in **Chromium 156.0.8078.79**: native Karten-/Verbindungstipps, bewusstes Schließen/Löschen, blockierte verzögerte Klicks, Undo, vollständiger PNG-Import in einem frischen Kontext und Weiterbearbeitung für alle drei Varianten bestanden; keine unerwarteten Requests. Der erste parallel belastete Lauf hatte beim kleinen Mystery einen Beginnen-Timeout nach 15 Sekunden. Der unveränderte serielle Wiederholungslauf bestand; eine konkrete Ursache des ersten Timeouts ist nicht bewiesen. Beide Ergebnisse bleiben im Prüfprotokoll erhalten.

WebKit **26.5 und 27.2** wurden ausdrücklich angefordert, starteten aber mangels `webkit-2388/pw_run.sh` nicht. Es wurde keine dieser Engines ausgeführt. Kein Chromium-Ergebnis wird als WebKit-, Safari- oder iPad-Nachweis ausgegeben.

## B – Veröffentlichung vorbereitet, nicht ausgeführt

Der einfachste vorbereitete Weg ist ein separater statischer Pages-Branch desselben Repositories. Damit muss weder der Anwendungscode noch der bisherige manuelle Actions-Workflow in `main` übernommen werden; dessen fehlende Verfügbarkeit auf dem Default-Branch blockiert diesen Weg nicht.

- Lokaler Branch: **`pages-unterricht-2026-11-13`**; Commit **`0a1536e1121e4cbb6f8501c120a9ae36af821346`**.
- Genau `index.html`, `.nojekyll`, `manifest.json`; die Startdatei ist byteidentisch mit der eingefrorenen Boden-HTML. Referenz zusätzlich als Git-Bundle gesichert.
- **Pages-Branch nicht gepusht, keine Pages-Einstellung geändert, kein Deployment, kein bestätigter öffentlicher Schülerlink.** Der Tag-Push ist keine Pages-Veröffentlichung.
- Abfragen vorhandener PRs und der Pages-Einstellungen scheiterten mit `Forbidden`. Deren tatsächlicher Zustand und die Berechtigungen sind daher offen; daraus folgt weder „Pages deaktiviert“ noch „kein PR vorhanden“.
- `scripts/prepare-classroom-pages.mjs` entnimmt ausschließlich die feste HTML per `git show`, prüft Tag-Ziel, Bytes und SHA-256 und schreibt nur in ein leeres Ziel. Es baut keine spätere Entwicklungsfassung und veröffentlicht nichts.

Das Unterrichtspaket enthält die unveränderte Boden-HTML, Manifest, Prüfsummen und kurze Anleitung. Das Referenzpaket enthält zusätzlich klein/umfangreich. [UNTERRICHT-2026-11-13.md](UNTERRICHT-2026-11-13.md) dokumentiert die genauen GitHub-Einstellungen und den Zehn-Schritte-Praxistest.

## C – Universelle Druckfassung auf getrenntem Branch

Entwicklungsbranch **`feat/mysteryboard-print-pdf`**, eigener Worktree desselben Repositories, Basis `240d5fc…`. Der endgültige neue Quellcommit wird nach Abschluss der Prüfung im externen **`MANIFEST.json` des Abnahmepakets** ausgewiesen. Dieser Bericht behauptet keinen noch nicht erzeugten oder selbstreferenziellen Commitwert.

Im vorhandenen Menü ergänzt **„Druckfassung / PDF“** eine A4-/A3-Querformatvorschau. Der native Druck-/PDF-Dialog startet erst durch einen bewussten weiteren Tipp. Eine fehlende Teamangabe durchläuft dieselbe vorhandene Namenspflicht wie PNG; ein abgebrochener Namensdialog startet keinen Druckauftrag. Keine neue dauerhafte Board-Schaltfläche.

Die Ausgabe besteht aus einer SVG-Gesamtübersicht, vollständigen Kartentexten in **11 Punkt**, eigenen proportional eingepassten Bildseiten und einem vollständigen Beziehungsverzeichnis. Lange Texte erhalten Fortsetzungen mit wiederholter Kartenkennung. Originalnummern und konfigurierte Präfixe, Farben als Wörter, eigene Kategorien, Beschriftungen und Pfeilrichtungen bleiben erhalten. Querverweise nennen vorhandene Kartennummern und endgültige Seiten; jede Seite trägt Titel links, Team rechts und „Seite x von y“. Der Bildschirmzoom beeinflusst die Ausgabe nicht.

HTML/CSS/SVG im lokalen Vorschauframe nutzen den Browserdruck ohne neue PDF-Bibliothek, Server, Upload oder große Raster-Canvas-Flächen. Konkrete DOM-Maße bestimmen die Seitenteilung; eine abschließende Grenzprüfung verhindert die Freigabe unpassender Seiten. Vorbereitung und Papierwechsel besitzen Abbruchschutz; maximal **500 Seiten**. Nach Rückkehr aus dem Druckdialog bleibt die Vorschau für Safaris asynchronen Druckweg erhalten.

PNG bleibt der bearbeitbare Sicherungsweg. Druckvorbereitung verändert weder `Work`, History noch `dirty`; ein bewusst eingegebener Teamnachtrag bleibt eine normale Bearbeitung. PDF ist keine importierbare Sicherung. Die fachliche Boden-Version **2.0.0**, sämtliche IDs und Inhalte, `mysteries.json`, Modell, PNG-/QR-Codec, History, bisheriger PNG-Export und R1b-Boardsteuerung blieben bytegleich zur Basis. Bestehende Tests wurden nicht entfernt oder abgeschwächt; keine neue Laufzeitabhängigkeit.

| Betroffene Dateien | Zweck |
| --- | --- |
| `src/core/print.ts`, `src/components/PrintPreview.tsx` | Gemeinsame Dokumentaufteilung, Übersicht, Detailseiten, Querverweise und Vorschaulebenszyklus |
| `src/App.tsx`, `src/style.css` | Menü-/Namenspflicht-Anbindung und Darstellung der Vorschau |
| `scripts/check-build.mjs`, `scripts/check-build.d.mts` | Sichere Lizenzplatzierung und erhaltene Größenprüfung, typisierte Testschnittstelle |
| `tests/build-notices.test.ts` | Zwei neue Buildregressionen |
| `tests/browser/print.spec.ts`, `tests/browser/print-lifecycle.spec.ts` | Neun Druckfälle plus gezielter Abbruch-/Papierwechseltest |
| Drei Produktions-HTMLs, beide Prüf-HTMLs | Aus demselben Anwendungskern neu erzeugte Entwicklungsartefakte |
| `scripts/prepare-classroom-pages.mjs`, `README.md`, neue Dokumentation | Getrennte Bereitstellung, Bedienung, Nachweise und nächste Aufträge |

### Während der Entwicklung gefundene und behobene Fehler

Der erste Produktionsdrucklauf zeigte eine leere Startseite: Der Build fügte Lizenzhinweise am ersten `</html>` ein, nun innerhalb des JavaScript-Drucktemplates. Enthaltene Backticks zerstörten dessen Syntax. `node --check` belegte dies. Die Korrektur ergänzt Hinweise ausschließlich am äußeren Dokumentabschluss; zwei neue Tests prüfen ausführbares JavaScript trotz innerem Druck-HTML sowie einen ungültigen Abschluss. Der abgebrochene Diagnoselauf bleibt dokumentiert.

Die erste vollständige Prüfung stoppte anschließend bei **51/52** Datentests: Die neue Abschlussprüfung überholte bei einer absichtlich ungültigen 10-MB-Datei die bisherige Größenfehlermeldung. Eine frühe Rohgrößenprüfung plus abschließende Endgrößenprüfung erhält beide Anforderungen. Der bisherige Grenztest blieb unverändert; alle sechs gezielten Build-/Grenztests bestanden danach. Kein Test wurde zugunsten eines grünen Ergebnisses entfernt.

Eine vermutete externe Navigation über Detailverweise wurde durch echte Verweistipps und PDF-Zielprüfung widerlegt; es war kein Base-URL-Umbau nötig. Übersichtsbilder verwenden das vorhandene proportionale `fitImage`, auch für SVG ohne `viewBox`.

## D – Weitere Funktionen ausschließlich spezifiziert

[NAECHSTE-FUNKTIONEN.md](NAECHSTE-FUNKTIONEN.md) enthält die nächste technische Spezifikation und Abnahmetests:

- **Bilddetails:** generische, unverzerrte Ansicht mit eigener Touchfläche, klarer Rückkehr, R1b-/Ghostclick-Schutz und unveränderten IDs/Sicherungen. Keine zusätzliche Laufzeitimplementierung.
- **QR aus Bilddatei:** eigene bewusste Aktion, Original-`mySt` als maßgeblicher Zustand; beschädigte oder inkompatible Blöcke niemals durch QR-Fallback übergehen. Typisierte Unterscheidung „kein Block“/„beschädigt“, Datei-/Pixelgrenzen, Abbruchschutz, Mehrfachcode-Risiko und vorhandenes `jsqr` sind spezifiziert.
- **SCORM 1.2:** kleinste spätere Asset-Verpackung derselben HTML; keine LMS-Zustands-/Team-/Antwortübertragung, kein Save-State-API, keine Bewertung. LMS-eigene Zugriffsprotokolle sind gesondert abzugrenzen; tatsächliche itslearning-Kompatibilität offen. Keine SCORM-Implementierung.

D1/D2 bleiben zurückgestellt, weil vollständige Druck- und reale Geräteabnahme zunächst abgeschlossen werden müssen. Dies schützt den eingefrorenen Unterrichtsstand und vermeidet gleichzeitige Änderungen an mehreren empfindlichen Eingabepfaden.

## E – Prüfungen und aktueller Abschlussstatus

**Abschließendes Ergebnis: 52/52 Datentests, TypeScript und alle fünf Builds bestanden; vollständige unveränderte Browserwiederholung 106/106 bestanden, Exitcode 0, keine übersprungenen Fälle.** Der erste Entwicklungsgesamtlauf bestand mit **52/52 Datentests**, TypeScript und allen fünf Builds, endete aber mit **105/106 Chromiumtests und Exitcode 1**. Ein unveränderter M1-220-Touchtest überschritt beim frischen PNG-Import die bestehende 8-Sekunden-Erwartung zum Schließen des Dialogs. Die spätere Fehlerscreenshotaufnahme zeigt bereits den wiederhergestellten Stand. Das beweist keine konkrete Ursache und ersetzt keinen bestandenen Test. Die vier gezielten Wiederholungen (zweimal Maus, zweimal Touch) bestanden. Anschließend bestand die komplette Browserwiederholung mit 106/106 Fällen in 12,9 Minuten, einschließlich desselben M1-Touchtests. Anwendung, Tests und Timeouts wurden dafür nicht verändert. Der erste Fehllauf und die unbekannte Ursache seiner Verzögerung bleiben dokumentiert; der ursprüngliche `npm run check` wird nicht nachträglich als erfolgreicher Gesamtaufruf ausgegeben.

Bereits bestätigt: neun gezielte Drucktests und ein zusätzlicher Lebenszyklustest. Abgedeckt sind 12/18/60 Karten, 220 Verbindungen, fünf neutrale Karten mit anderer Gruppenbelegung, A3 und Zoom, extreme gültige Titel/Texte/Labels, Legacy-Namenspflicht, exakte Karten-/Beziehungsinhalte, Seitenränder, 11-Punkt-Schrift, Querverweise, Offline-Anfragen und unveränderte PNG-Zustände. Eine bezeichnete zeitliche Fehlerinjektion prüft Papierwechsel und Schließen während laufender Vorbereitung, erneutes Öffnen und fehlende verwaiste Frames.

**Schülerperspektive:** Zusätzlich wurde die Boden-Produktionsdatei mit 1024 × 768 Pixeln und nativen Touch-Eingaben als „Technische Dreiergruppe“ gestartet, anschließend offline genutzt, das Menü und die fertige Druckvorschau geöffnet und bewusst geschlossen. Arbeitsfläche, Menü und Vorschau wurden als Screenshots visuell geprüft: unveränderte Werkzeugleiste, erkennbare Nummern/V-Kennungen und keine zusätzliche Teamabfrage bei bereits eingetragenem Namen. Die papiergroße Vorschau darf seitlich scrollen; ihre echte Druckausgabe wurde gesondert geprüft. Null zusätzliche Requests oder JavaScriptfehler. Zusammen mit den durchgehenden Bearbeitungs-/Sicherungsfällen ist dies eine technische Nutzungssimulation, kein Versuch mit echten zwei bis drei Lernenden und kein empirischer Nachweis der geplanten 20-minütigen Erarbeitung. Diese Unterrichtserprobung bleibt erforderlich.

Die Beispiel-PDFs wurden tatsächlich durch Chromium erzeugt, mit `pdfinfo`/`pdftotext` inhaltlich geprüft und für die Sichtprüfung aus den PDF-Dateien gerastert. Das ist mehr als eine Vorschauprüfung, aber kein realer Safari-Drucktest.

| Beispiel | Papier | Seiten |
| --- | --- | ---: |
| 12 Karten | A4 quer | 6 |
| Boden, 18 Karten | A4 / A3 quer | 5 / 4 |
| 60 Karten | A4 quer | 34 |
| 220 Verbindungen | A4 quer | 56 |
| Generische fünf Karten | A4 quer | 3 |
| Extreme gültige Texte | A4 / A3 quer | 12 / 8 |

Das PDF-Audit weist für die geprüften Detailtexte mindestens 11 Punkt, keine Texte außerhalb der PDF-Seiten und keine externen PDF-Verweise aus. Der 220er-Aufbau benötigte im dokumentierten Lauf etwa **21 Sekunden**; dies ist kein iPad-Leistungsversprechen. Die dicht verknüpfte Gesamtübersicht bleibt klein; lesbar erhalten bleiben die vollständigen Details und Querverweise. Keine Behauptung einer automatisch entwirrten grafischen Druckfassung. PDFs enthalten gekennzeichnete technische Testbeziehungen, keine fachlichen Musterlösungen.

Vollständige Befehle und Rohprotokolle liegen im Abnahmepaket unter `COMMANDS.md` und den zugehörigen Ergebnisdateien; im Arbeitsbereich unter `/workspace/mysteryboard-nov13-evidence/`. Die zentralen Aufrufe:

```sh
# Eingefrorene Basis im ursprünglichen Worktree:
cd /workspace/Vorlage-Mysteryboard
npm run check
node scripts/work-compatibility.mjs --engine chromium --executable /usr/bin/chromium --html-dir artifacts --source-commit 240d5fcfcac7e5924efe169493c9f7525ba5ed74 --port 5177 --output /workspace/mysteryboard-nov13-evidence/stable-work-chromium-serial

# Getrennte Druckentwicklung:
cd /workspace/Mysteryboard-print
npx tsc --noEmit
npm run build
node scripts/build.mjs --tests
npx vitest run tests/build-notices.test.ts tests/limits.test.ts
PRINT_EXAMPLES_DIR=/workspace/mysteryboard-nov13-evidence/print-examples npx playwright test tests/browser/print.spec.ts
npx playwright test tests/browser/print-lifecycle.spec.ts
set -o pipefail
PRINT_EXAMPLES_DIR=/workspace/mysteryboard-nov13-evidence/print-examples-final npm run check 2>&1 | tee /workspace/mysteryboard-nov13-evidence/phase-e-check.txt
# Unveränderte vollständige Browserwiederholung: 106/106 bestanden, Exitcode 0.
npx playwright test
git diff --check
```

Aktuell gebaute Entwicklungsdateien, jeweils deutlich unter **10.000.000 Bytes**; Zuordnung zum späteren Commit und endgültigen Prüfergebnis im externen `MANIFEST.json`:

| Entwicklungsdatei | Bytes | SHA-256 |
| --- | ---: | --- |
| `MysteryBoard-Boden-Klasse11.html` | 475683 | `124f9d593a92d9596de36789d774ba89d767c14bd5cbe89cbf2f905f37162969` |
| `MysteryBoard-klein.html` | 474133 | `41ddfbdc787376a7cd2e4884c1329e42b7838b7b96e4f020e172d6b451e1a4f1` |
| `MysteryBoard-umfangreich.html` | 507019 | `7c71ffc6507a96c62ac0684fafcdf15f1fd2573b9816d730ffbeb74154ef187c` |
| `MysteryBoard-Pruefung-220.html` | 1014732 | `875ee726001597f8944ad59159b527f21f53d7aae9f5532949c1562a48a60c53` |
| `MysteryBoard-Test-5.html` | 470583 | `1579af9353ae03113c9e5ea3b9d6cd11f2a067da4c4f1142ab1a3802b708af8a` |

## F – Lieferumfang, Grenzen und nächste Schritte

Das Abnahmepaket trennt Unterrichtskandidat, Druckentwicklung und Belege. `MANIFEST.json` verbindet die tatsächlich gelieferten Dateien mit Bytegrößen, SHA-256, Quellcommits, Testresultaten und Veröffentlichungstatus; PDF-/Screenshot-Beispiele und vollständige Rohprotokolle bleiben beigefügt. PR-Beschreibung ist vorbereitet; ohne erfolgreichen API-Zugriff keinen erzeugten PR oder dessen Status behaupten. Neue Git-Referenzen nach dem Abschluss ausschließlich anhand des Manifests benennen.

**Offen bleiben** WebKit 26.5/27.2, tatsächlicher Pages-Link und Schulnetzzugriff, tatsächliche Canva-Veröffentlichung, verwaltete Schul-iPads und itslearning. Insbesondere nativer Safari-Druck/PDF, große Dokumente/Bilddecoder, Papierformat und Ablage in „Dateien“ brauchen reale Prüfung. Weder Browseremulation noch ein erzeugter PNG-/PDF-Download beweisen eine dauerhaft abgelegte Datei. Es gibt weiterhin keine automatische Speicherung, Benutzerkonten, Schülerdatenübermittlung, Bewertung oder Musterlösung.

1. **Veröffentlichen:** erst nach ausdrücklicher Freigabe die tatsächlichen Pages-Einstellungen prüfen, den vorbereiteten Pages-Commit normal pushen und `Settings → Pages → Deploy from a branch → pages-unterricht-2026-11-13 → /(root)` wählen. Bestätigte HTTPS-Adresse übernehmen und ausgelieferte SHA-256 mit der festen Boden-Prüfsumme vergleichen. Vollständige Befehle stehen in [UNTERRICHT-2026-11-13.md](UNTERRICHT-2026-11-13.md).
2. **Schul-iPad prüfen:** tatsächlichen Link öffnen, Team starten, Pflicht-/V-Karte lesen, verschieben und verbinden, Label/Richtung ändern, Original-PNG in „Dateien“ ablegen, Browser beenden, erneut öffnen, vollständig importieren und weiterarbeiten. Version, Gerät und Ergebnis notieren; möglichst Transfer auf zweites verwaltetes iPad. Canva separat über dessen tatsächlichen Link prüfen.
3. **Druckentwicklung unabhängig prüfen:** getrennte HTML öffnen, A4/A3-Vorschau und echte PDF anhand [DRUCKFASSUNG.md](DRUCKFASSUNG.md) testen, große Boards einschließen, danach PNG im frischen Kontext wiederherstellen. Bis zur Abnahme nicht die eingefrorene Unterrichtsdatei ersetzen.
4. **Übernehmen:** erst nach vollständiger Regression, dokumentierter Praxisabnahme und ausdrücklicher Merge-/Veröffentlichungsfreigabe die Entwicklung per geprüftem PR übernehmen. Keine automatische Änderung von `main`, Unterrichtstag oder Pages-Branch. Weitere Bild-/QR-/SCORM-Aufträge nach ihrer eigenen Spezifikation abnehmen.
