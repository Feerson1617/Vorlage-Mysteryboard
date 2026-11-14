# Abnahme: universelle Vorlage mit Druckfunktion

Prüfdatum: 14. November 2026. Die technische Integration ist in Chromium bestanden. Die Vorlage ist für eine unabhängige Browser- und Geräteprüfung vorbereitet; dies ist keine schulische Freigabe.

## Herkunft und Umfang

Der neue Branch `feat/mysteryboard-template-print-integration` basiert auf `3454f97c513a6c657256623c08e11d9f93f8b09a` (geordnete Startablage/Hilfesystem). Die Druckfunktion stammt aus `30ecd1d814b4510a689c7b5d44ad1dd6609849f1`. Gemeinsame ältere Basis war `240d5fcfcac7e5924efe169493c9f7525ba5ed74`. Die Integration übernimmt gezielt die Druckfunktion; sie ersetzt den neueren Anwendungskern nicht durch den älteren Druckbranch.

`manifest.json` im Abnahmepaket nennt den vollständigen Liefercommit. `integration.diff` enthält den vollständigen Diff gegen `3454f97`. Quellcode und gebaute Test-HTMLs gehören zu diesem Commit. Die ursprünglichen Branches, `main`, RC1-/RC2-Tags und eingefrorenen Unterrichtsdateien bleiben unverändert. Kein Merge, keine Pages-/Umgebungsveröffentlichung und keine neue SCORM-Version.

## Änderungen und Begründung

| Dateien | Änderung |
| --- | --- |
| `src/App.tsx`, `src/style.css` | Sichtbare Nummernerklärung auf dem Startbildschirm; aktive Orientierung mit Häkchen/Rahmen am Hilfe-Button bzw. Text im Menü. Der zugängliche Beschreibungstext nennt ausdrücklich „eingeschaltet“/„ausgeschaltet“. Vorhandener Hilfe-Name, Tastaturfokus und Bedienung bleiben erhalten. |
| `src/core/print.ts`, `src/components/PrintPreview.tsx` | Unveränderte Druckimplementierung aus `30ecd1d`: A4/A3 quer, Übersicht, vollständige Karten, Bildseiten, vollständige Beziehungen, Team/Titel und Seitenverweise. Einbindung in das bestehende Menü und die bestehende Teamnachfrage. |
| `scripts/check-build.mjs`, `scripts/check-build.d.mts` | Übernahme des notwendigen Lizenzhinweis-Fixes: Das Druckskript enthält selbst `</html>`. Hinweise dürfen erst vor dem letzten äußeren Dokumentende eingefügt werden, sonst würde eingebetteter JavaScript-Text beschädigt. Die neuere `previewOnly`-Trennung bleibt erhalten. Größengrenze auch nach Lizenztexten geprüft. |
| `mysteries.json`, `tests/fixtures/print-media.json` | Zusätzlicher neutraler Testinhalt mit quadratischem, hohem und breitem Diagramm sowie langem Kartentext. Keine fachlichen Inhalte im Kern. |
| `tests/browser/integration.spec.ts` | Neun neue Integrationsprüfungen einschließlich echter PDF-Dateien, Hilfeanzeige, Weiterarbeit und Original-PNG in neuer Sitzung. |
| `tests/browser/print.spec.ts`, `tests/browser/print-lifecycle.spec.ts`, `tests/build-notices.test.ts` | Bestehende Drucktests übernommen. Einzige inhaltliche Pfadanpassung: Boden-Drucktest verwendet den technischen Preview-Build; die eingefrorene RC2-HTML bekommt keine Druckfunktion. Keine Assertion entfernt oder abgeschwächt. |
| `scripts/audit-integration-pdfs.py` | Unabhängige Prüfung der tatsächlichen PDF-Bytes mit Poppler, Rasterbildern und Proportionsmessung. Nur Prüfwerkzeug, keine Laufzeitabhängigkeit. |
| `README.md`, `docs/FORMAT.md`, `docs/NEUES-MYSTERY.md`, `docs/DRUCKFASSUNG.md` | Integrationsstand, Nutzung, neues Mystery und Geräteabschluss dokumentiert. |
| `artifacts/MysteryBoard-klein.html`, `artifacts/MysteryBoard-umfangreich.html`, `artifacts/tests/` | Neun aktuelle ausführbare Testvarianten aus demselben Anwendungskern. |

Die 18 vorhandenen Testdateien der Ausgangsbasis sind bytegleich erhalten. `model.ts`, `png.ts`, `codec.ts`, `history.ts`, `export.ts`, `start-layout.ts`, `layout.ts` und `Board.tsx` sind unverändert. Der Nachweis steht in `evidence/source-scope.json`.

Orientierung bleibt ein temporärer Ansichtszustand. Die Druckfunktion bekommt ausschließlich Inhaltsdaten und den gespeicherten Arbeitsstand. Daher erscheinen weder Hilfefenster noch Hilfemarkierung oder temporäre Nummernfarben im PDF. Eigene gespeicherte Kartenfarben/Kategorien werden übernommen. Öffnen, Papierwechsel, Drucken und Schließen ändern weder Positionen noch Beziehungen, History oder `dirty`. Ein bewusst eingegebener fehlender Teamname bleibt wie bisher eine Bearbeitung.

## Ausgeführte Prüfungen

Umgebung: Linux, Node 24.22.1, npm 11.9.0, Chromium 156.0.8078.79, Playwright 1.65.0. Poppler (`pdfinfo`, `pdftotext`, `pdftoppm`) und Python/Pillow dienen ausschließlich der Prüfung. Keine neue bezahlte oder externe Laufzeitabhängigkeit.

Die folgenden Befehle wurden in `/workspace/Mysteryboard-integration` ausgeführt. Die Ausgabeverzeichnisse sind Prüfartefakte außerhalb des Repositories.

```sh
PRINT_EXAMPLES_DIR=/workspace/mysteryboard-integration-evidence/pdfs/regression \
INTEGRATION_EXAMPLES_DIR=/workspace/mysteryboard-integration-evidence/pdfs/integration \
npm run check > /workspace/mysteryboard-integration-evidence/full-check.log 2>&1

npm run test:rc2 > /workspace/mysteryboard-integration-evidence/rc2-check.log 2>&1

python3 scripts/audit-integration-pdfs.py \
  /workspace/mysteryboard-integration-evidence/pdfs \
  /workspace/mysteryboard-integration-evidence/pdf-audit \
  > /workspace/mysteryboard-integration-evidence/pdf-audit.log 2>&1

git diff --check
npx prettier --check src/App.tsx src/style.css scripts/check-build.mjs \
  scripts/check-build.d.mts tests/browser/integration.spec.ts \
  tests/browser/print.spec.ts tests/fixtures/print-media.json mysteries.json
```

`npm run check` führt `npm test`, `npm run build` (einschließlich TypeScript) und `npm run test:e2e` (Prüf-Builds und vollständige Chromium-Suite) aus.

| Prüfung | Ergebnis |
| --- | --- |
| Daten-/Modultests | 73 bestanden; alle bisherigen 71 plus zwei Lizenzhinweis-Tests |
| TypeScript und zehn Build-Ziele | Bestanden; Zielgröße 6.000.000 und harte Grenze 10.000.000 Bytes überall eingehalten |
| Chromium-Gesamtsuite | 137 bestanden, 0 fehlgeschlagen, 0 übersprungen, 0 flaky; bisherige 118 plus zehn Druck- und neun Integrationstests |
| Eingefrorene RC2 | Vier separate HTML-/SCORM-Regressionsprüfungen bestanden, 0 Fehler; `rc2-check.log` und `rc2-results.json` |
| Native Chromium-PDFs | 24 Dateien, 200 Seiten; 16 neue Integrationsbeispiele und acht Beispiele aus den übernommenen Drucktests |
| PDF-Proportionen | Sechs Bildseiten geprüft: drei Bildformate jeweils A4/A3; Kreisbreite/-höhe maximal zwei Rasterpixel verschieden |
| Vorhandene Tests und Kernmodule | Bytevergleich bestanden; keine Schwächung alter Prüfungen |
| RC2-Dateien/Inhalte | SHA-256 unverändert, siehe unten und Integritätsmanifest |
| Diff/Formatierung | `git diff --check` und Prettier bestanden |

### Ablauf, Oberfläche und Wiederherstellung

Der durchgehende Ablauf wurde bei 1024 × 768, 768 × 1024, 600 × 800 und 320 × 700 CSS-Pixeln mit gebauten HTMLs ausgeführt: Teamname, geordnete Karten, tatsächliche Touch-Bewegung, eigene Farbe/Kategorie, Verbindungen, beide Hilfestufen, weiterarbeiten, A4/A3-PDF, wieder weiterarbeiten und Original-PNG in einem neuen Browserkontext importieren. Der vollständig dekodierte Arbeitsstand stimmt anschließend überein; Hilfezustand wird nicht mitgespeichert. Vor/nach Druck bleibt auch die Sicherungs-PNG bytegleich. Keine zusätzlichen externen HTTP-Anfragen; Arbeitsablauf und PDF-Erzeugung laufen nach dem initialen lokalen Dateiaufruf offline. Die vorhandenen Tests prüfen zusätzlich lokale Einzeldateien.

Die neutralen 5-/12-/18-/60-Karten-Varianten bleiben eigenständig baubar. Für alle vier wurden A4- und A3-PDFs erzeugt. Vorhandene Startablage-/Nummerntests prüfen die vier Bildschirmgrößen weiterhin. Alle 220 Verbindungen, Kreuzungsbeschriftungen und Touch-Schutzfälle bleiben in den vorhandenen Tests enthalten. Die neue Medienvariante prüft negative Kartenkoordinaten, unterschiedliche Präfixe, eigene Kategorien/Farben, langen Kartentext, eine 500-Zeichen-Beziehung, Pfeilrichtung und ungerichtete Beziehung.

Sichtprüfung der gerenderten Screenshots: Nummernerklärung ist auf dem Startbildschirm sichtbar. Bei 320 Pixel Breite wird die längere Startansicht vertikal gescrollt; es entsteht kein horizontaler Überlauf. Die aktive Hilfe ist im Menü ausgeschrieben und in der breiten Werkzeugleiste mit Rahmen/Häkchen markiert. Zugängliche Beschreibung und Tastatur-Fokusrückgabe sind automatisiert geprüft. Die Druckvorschau ist bei schmalen Ansichten scrollbar; Formatwahl, Druckauslösung und Schließen bleiben erreichbar.

### Tatsächliches PDF und Grenzen des Nachweises

Die Tests verwenden Chromiums natives Druck-Backend (`page.pdf`) mit genau dem vorbereiteten Druckdokument, fertigen Schriften/Bildern, CSS-Papierformat und Druckhintergründen. Anschließend lesen Poppler-Werkzeuge die PDF-Dateien. Verglichen werden Papiermaße, Seitenzahlen, Team/Titel auf jeder Seite, vollständige Textfragmente, Verbindungsbeschriftungen und Seitenverweise. Die Druck-DOM-Prüfung vergleicht zusätzlich alle Karten- und Beziehungstexte zeichengetreu sowie Positionen, Farben und Originalbilddaten.

Das Produkt ruft `window.print()` erst nach dem bewussten Button-Tipp auf. Automatisiert geprüft sind null Aufrufe bei Öffnen/Papierwechsel und genau ein Aufruf durch den Button. Die PDF-Erzeugung und diese Aufrufprüfung sind getrennte Nachweise: Der Betriebssystem-Druckdialog wurde nicht automatisiert bedient. Dies ist kein Safari-/iPad-Nachweis.

Poppler rastert echte PDF-Seiten; Pillow misst den Kreis in den eingebetteten Prüfdiagrammen. Die sechs Bildseiten behalten die Proportionen. Rasterbilder von Bildseiten, Kartentexten, Übersicht und vollständigen Beziehungen liegen bei. Visuell geprüft wurden insbesondere quadratische, hohe und breite Diagramme mit lesbarer Legende, die Langtext-Fortsetzung/Zuordnung und eine 220er-Beziehungsseite mit vollständigem Text und Querverweisen. `pdf-audit/pdf-audit.json` enthält PDF-/Raster-Prüfsummen und Messwerte.

### Transparenz zu Vorläufen

Die ersten gezielten Läufe der neuen Testdatei fanden Fehler im neuen Prüfskript: falscher exakter Feldname für „Beschriftung (freiwillig)“, eine ungültige Schema-1-Testfixture mit direkt angehängtem Teamnamen sowie einen verdeckten Tippzielpunkt. Diese wurden vor dem vollständigen Abschlusslauf berichtigt. Die Team-Fixture nutzt nun den vorhandenen `withTeam`-Helfer. Beim Verbindungsziel wird die sichtbar erreichbare Kartennummer angetippt. Es wurden keine Produktregeln oder alten Assertions zugunsten dieser Tests geändert.

Bei 600 × 800 kann die vorhandene untere Verbindungsmeldung den Körpermittelpunkt einer nach unten verschobenen Karte überdecken. Die außenliegende Nummer bleibt erreichbar; der Ablauf verwendet diesen regulären Touch-Zugang. Das bleibt eine dokumentierte Bediengrenze. Die Vorlaufprotokolle liegen im Paket unter `evidence/`; maßgeblich ist der danach vollständig bestandene Abschlusslauf.

Build-Hinweise von `vite-plugin-singlefile` zur eingebetteten CSP betreffen das enthaltene Druckdokument. Die gebaute Anwendung und der Druckframe wurden tatsächlich ausgeführt. Es wurde keine CSP entfernt, um einen Test zu erleichtern.

## Eingefrorene Unterrichtsversion

| Datei | Unveränderte SHA-256 |
| --- | --- |
| `src/content/boden-klasse11.json` | `44419be70fa5173529b25ffdb58818b733d95330f5b81cadb3edd5c589d4a4c5` |
| `artifacts/MysteryBoard-Boden-Klasse11.html` und `MysteryBoard-Boden-Klasse11-RC2.html` | `21dd6ad5c813ba5bd12ca521f03602a195ccea44ee70769119280e4ca088fd5f` |
| `artifacts/MysteryBoard-Boden-Klasse11-RC2-SCORM-1.2.zip` | `42ac3d51e2e34431efe9b0ca9b0f4e84085d9b651e4fac6747d843bf6091c3a0` |
| `artifacts/RC2-integrity.json` | `ac6f668a01ef548c302e5bbedc0f15a42d7cc511e4f3db98b5bfc406331901d6` |

Die Boden-Inhaltsversion bleibt 2.0.0 mit 18 Karten. Der technische Boden-Preview-Build landet ausschließlich unter `artifacts/previews/`; er ersetzt keine Unterrichtsdatei. Das Abnahmepaket kennzeichnet eine eventuell beiliegende technische Vorschau gesondert. Release-Befehle und SCORM-Neubau wurden nicht ausgeführt.

## Offene Punkte vor Gerätefreigabe

1. WebKit 26.5 und 27.2 stehen in dieser Umgebung nicht zur Verfügung; auch der konfigurierte Playwright-WebKit-Launcher fehlt. `evidence/webkit-availability.log` enthält den tatsächlichen Startfehler. Diese Prüfungen sind **offen**, nicht bestanden.
2. Native Safari-/iPadOS-Druckdialoge, A4/A3, PDF-Ablage in „Dateien“, Abbruch und anschließende Weiterarbeit müssen am realen verwalteten Schul-iPad geprüft werden. Ebenso VoiceOver, reale Touch-Eigenschaften und Speicherdruck großer Bildinhalte. Chromium ersetzt dies nicht.
3. Die tatsächliche Canva-Einbettung und schulische Geräte-/LMS-Umgebung bleiben gesonderte Abnahmen. Bestehende RC2-SCORM-Tests verwenden eine lokale simulierte LMS-Schnittstelle. Kein neues SCORM-Paket wurde erstellt.
4. Eine Übersicht mit 220 dicht überlagerten Verbindungen ist auf einem Blatt nicht durchgehend lesbar. Vollständige Texte/Beziehungen sind über lesbare Detailseiten und Querverweise zugänglich. Das 220er-Beispiel umfasst 56 Seiten; Umfang vor einem Papierdruck prüfen.
5. Bei 60 Karten auf einem 320-Pixel-Bildschirm sind Übersicht und Detaillektüre unterschiedliche Ansichten. Zum Lesen sind Zoom und Lesefenster nötig. Die bestehenden Grenzen der Bildschirm-Bildvergrößerung bleiben erhalten; große PDF-Bildseiten ersetzen keine bislang ungeprüfte Erweiterung des Lesefensters.
6. Sehr große Originalbilder und maximale Dokumentgrößen können reale Gerätegrenzen erreichen. Die vorhandene Seitenbegrenzung/Fehlerbehandlung bleibt erhalten; keine pauschale Leistungszusage für beliebige Medien.

## Unabhängig nachprüfen

ZIP entpacken, unter `html/` eine neutrale Variante lokal öffnen, Teamnamen eingeben und den obigen Ablauf wiederholen. Für den Medientest kann die mitgelieferte Original-PNG unter `screenshots/` in die entsprechende Medien-HTML importiert werden. `pdfs/` enthält echte Ausgaben, `pdf-audit/` die aus ihnen erzeugten Rasterbilder. `source.zip` enthält den vollständigen versionierten Quellcode; nach `npm ci` sind die Prüfungen mit den dokumentierten Befehlen ausführbar. Poppler/Pillow sind nur für die PDF-Prüfwerkzeuge erforderlich.

`manifest.json` und `SHA256SUMS` ordnen Dateien, Größen, Prüfsummen und Commit zu. `evidence/remote-before.json` und `remote-after.json` dokumentieren den tatsächlichen GitHub-Stand. [Druckbedienung](DRUCKFASSUNG.md) und [Neues Mystery mit der Vorlage erstellen](NEUES-MYSTERY.md) erklären die weitere Nutzung ohne Änderungen am Anwendungskern.
