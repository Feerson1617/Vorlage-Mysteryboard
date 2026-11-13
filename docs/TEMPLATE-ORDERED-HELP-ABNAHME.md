# Vorlagenprüfung: geordnete Startablage und zweistufige Hilfe

Prüfdatum: 13.11.2026. Ausgangsbasis: `2c39d5427dc7cbd03558657d62821823949ac170` (RC2). Entwicklungsbranch: `feat/mysteryboard-template-ordered-help`. Die konkrete Liefer-Commit-ID und der nach dem Push abgefragte Remote-Stand stehen in `manifest.json` und `evidence/remote-after.json` des Abnahmepakets; so entsteht keine selbstreferenzielle Commit-Angabe.

## Ergebnis und Umfang

**Die technische Funktionsprüfung ist bestanden.** Die universelle Vorlage erhält eine numerische Startablage für neue Inhalte und eine freiwillige, zweistufige Lernhilfe. Ein gemeinsamer Anwendungskern erzeugt alle neuen Prüf-HTMLs. Es gibt keine fachliche Musterlösung, keine automatische Bewertung und keine neue dauerhafte Speicherung. Die neutralen Prüfnotizen dienen ausschließlich dem technischen Nachweis.

Die abgeschlossene Boden-Unterrichtsversion einschließlich Inhaltsversion 2.0.0, 18 Karten, HTML, SCORM und RC2-Tag bleibt unverändert. Die Druckentwicklung bleibt auf ihrem eigenen Branch. Dieser Bericht ist keine schulische, Canva-, Safari- oder itslearning-Freigabe.

## Änderungen und betroffene Dateien

| Bereich | Dateien | Verhalten |
| --- | --- | --- |
| Inhaltsmodell | `src/core/model.ts` | Optionale, validierte Felder `startLayout` und `help`; alte Inhalte bleiben gültig. |
| Startablage | `src/core/start-layout.ts`, `src/core/layout.ts`, `src/App.tsx` | Numerische IDs, tatsächliche Kartenhöhen, freie Abstände einschließlich Nummern; automatische Spaltenwahl anhand des Fensterformats. |
| Hilfe | `src/core/help.ts`, `src/components/LearningHelp.tsx`, `src/components/Board.tsx`, `src/App.tsx`, `src/style.css` | Allgemeiner/individueller Denkimpuls; ausdrückliches Aktivieren von Nummernfarben; Textlegende, Kontrast, Fokus, Schließen und Ausblenden. |
| Build und Schutz | `mysteries.json`, `scripts/content-config.ts`, `scripts/check-build.mjs`, `scripts/prepare-rc2.mjs`, `.gitignore` | Vier neutrale Prüfvarianten; technische Boden-Vorschau getrennt unter `artifacts/previews/`; RC2-Neuverpackung auf dem Entwicklungsstand abgewiesen. |
| Nachweise | `tests/ordered-help.test.ts`, `tests/browser/ordered-help.spec.ts`, `tests/fixtures/ordered-{5,12,18,60}.json` | Neue Daten-, Geometrie-, Bedien- und Integritätsprüfungen. |
| Dokumentation | `docs/FORMAT.md`, `docs/NEUES-MYSTERY.md`, `README.md`, dieser Bericht | Vollständiges Schema, Beispiele, Build-Anleitung, Grenzen und Versionierungsregel. |
| HTMLs | `artifacts/MysteryBoard-{klein,umfangreich}.html`, `artifacts/tests/*.html` | Neu gebaute technische Prüfvarianten; keine neuen Unterrichts-Releases. |

Es wurden keine Abhängigkeiten hinzugefügt. `codec.ts`, `png.ts`, `export.ts`, `history.ts` sowie alle 16 vorhandenen Testdateien sind bytegleich zur Ausgangsbasis. Die Pointer-Ereignisbehandlung wurde nicht verändert.

## Konfigurationsentscheidungen

**Startlayout:** Fehlt `initial`, wird einmal beim Beginnen eine neutrale, numerische Ablage erzeugt. V-/Z-Präfixe bleiben sichtbar, beeinflussen aber nicht die Sortierung. Die Karten stehen zeilenweise nach numerischer ID; es gibt weder Farben noch vorgegebene Verbindungen oder Kategorien. Zoom, Übersicht, Fensterwechsel und Import ordnen eine begonnene Arbeit nicht neu. Vorhandene `initial`-Positionen gelten weiterhin unverändert. `startLayout.mode: "explicit"` macht ein bewusst anderes Layout ausdrücklich; `mode: "ordered"` erlaubt optional eine Spaltenzahl von 1 bis 12. Das vollständige Schema steht in [FORMAT.md](FORMAT.md).

**Hilfen:** Ohne individuelle Metadaten erscheint nur der allgemeine Denkimpuls. Stufe 2 setzt explizite Kategorien mit ID, Bezeichnung, Hexfarbe und Karten-IDs voraus. Höchstens sechs Kategorien, unterschiedlich große Gruppen und unmarkierte Karten sind möglich. Unbekannte IDs, doppelte Zuordnungen, doppelte Kategorien/Farben und ungültige Werte werden abgewiesen. Keine Zuordnung wird aus Nummernbereichen oder Pflicht-/Vertiefungsgruppen abgeleitet.

Nur der Nummernhintergrund und dessen Schwarz-/Weiß-Schrift ändern sich. Die Textfarbe wird nach dem relativen Helligkeitskontrast gewählt. Kartenflächen, eigene Farben/Kategorien, Texte, Pfeile und Positionen bleiben erhalten. Die Legende nennt zusätzlich die konkreten sichtbaren Kartennummern. Eine Screenreader-Beschreibung benennt die Orientierung an der jeweiligen Karte.

Die Hilfe ist beim Start aus. Auf breiten Fenstern ab 1100 CSS-Pixeln gibt es einen Hilfe-Button in der Werkzeugleiste; auf schmaleren Fenstern ist er über das bestehende Menü erreichbar. Das nichtmodale Fenster lässt die Werkzeugleiste frei und belegt höchstens eine halbe Bildschirmhöhe. Schließen lässt eine bewusst eingeschaltete Orientierung bestehen; „Orientierung ausblenden“ deaktiviert sie. Neue Arbeit und Import setzen sie zurück. Die Arbeitsfläche wird nicht verkleinert.

**Speicherformat und Version:** Hilfe ist lokaler Ansichtsstatus, kein Teil von `Work`, History, `dirty`, PNG-/QR-Daten oder LMS-Kommunikation. Individuelle Hilfetexte, Kategorien, Zuordnungen und bedeutungstragende Hilfefarben gehören zur Inhaltsversion: Änderungen daran erfordern bei zukünftigen Mysterys eine neue Inhaltsversion. Reine technische Darstellungsänderungen erfordern keine neue Speicherformatversion. Die normale PNG-Erzeugung bleibt unverändert; Druck-CSS unterdrückt die temporären Nummernfarben. Das ist kein Nachweis der nativen Safari-Druckfunktion.

## Ausgeführte Nutzungssimulation und Sichtprüfung

Die vollständige Schülerfolge wurde über echte Chromium-Seiten und die gebauten HTMLs bei 1024×768, 768×1024, 600×800 und 320×700 ausgeführt: Team angeben, fünf Karten lesen, ziehen, eigene Karte violett färben, eigene Farbkategorie benennen, eine beschriftete Verbindung anlegen, Hilfe 1 lesen, Hilfe 2 bewusst aktivieren, Nummern mit Legende vergleichen, Hilfe ausblenden, eine zweite eigene Verbindung ergänzen, PNG herunterladen und in einem neuen Browserkontext wiederherstellen.

Der fachliche Zustand einschließlich Team, Positionen, Farben, eigener Kategorien und Verbindungen wird vollständig verglichen. Bei unverändertem Produkt sind die heruntergeladenen PNG-Dateien mit und ohne aktive Hilfe sogar byteidentisch. Hilfe erzeugt weder Undo-/Redo-Schritte noch eine neue Verlassen-Warnung. In der neuen Sitzung bleibt die Nummernhilfe aus; weitere Bearbeitung ist möglich. Während der Bedienung ist der Browser offline; die Anwendung fordert keine zusätzlichen HTTP-Ressourcen an. LocalStorage und SessionStorage bleiben leer.

Die ersten Screenshots zeigten eine konkrete Schwäche: Die zweite Stufe lag unter dem weiterhin sichtbaren Denkimpuls und war im kleinen Fenster erst durch Scrollen erreichbar. Das wurde korrigiert: Stufe 2 zeigt sofort die Legende, und der Schalter zum Ausblenden steht außerhalb des scrollbaren Inhalts. Die abschließenden Screenshots belegen beide Hilfestufen. Bei 320×700 sind alle drei Beispielkategorien sichtbar; der zusätzliche erklärende Absatz kann gescrollt werden. Die Hilfe überlagert dort einen Teil der Karten; zum direkten Vergleich lässt sie sich schließen, während die bewusst aktivierten Nummernfarben erhalten bleiben.

Die Ablage wurde für 5, 12, 18 und 60 Karten in allen vier Formaten geprüft (16 Kombinationen), einschließlich V-/Z-Präfixen, vollständiger Übersicht, nicht überlappender Karten und Nummern, Verschieben, Undo/Redo, Zoom und Formatwechsel. Die numerische Ablage ist keine fachliche Reihenfolge. Das wird in den neutralen Kartentexten und in der Hilfe ausdrücklich erläutert. Eine fachliche Prüfung zukünftiger Zuordnungen kann durch technische Validierung nicht ersetzt werden.

Die Simulation und Screenshot-Sichtprüfung wurden im Rahmen dieses Auftrags selbst ausgeführt. Es handelt sich nicht um eine externe pädagogische Begutachtung oder einen Test durch reale Schülerinnen und Schüler.

## Testbefehle und Ergebnisse

Die vollständigen Rohprotokolle und Playwright-Berichte liegen unter `evidence/` im Abnahmepaket. Ausführung im neuen Worktree, Node.js 24.22.1, npm 11.9.0, Chromium 156.0.8078.79, Playwright 1.65.0.

| Vollständiger Befehl | Ergebnis / Protokoll |
| --- | --- |
| `npm test` | 71/71 bestanden; `data-first.log`. |
| `npx vitest run --maxWorkers=1` | 71/71 bestanden; `data-serial.log`. |
| `npm run build` und `node scripts/build.mjs --tests` | Alle registrierten Produktions-/Prüfvarianten gebaut; Typprüfung, Inhaltsvalidierung und HTML-Grenzprüfung erfolgreich. Im Gesamtlauf erneut enthalten. |
| `npx playwright test tests/browser/ordered-help.spec.ts` | Vor dem zusätzlichen Altimport-Test jeweils 21/21 bestanden; `browser-first.log` und nach der Legendenkorrektur `browser-second.log`. |
| `npm run check` (erster Gesamtlauf) | 71 Datentests bestanden, Typprüfung/Builds erfolgreich; Browser 117 bestanden, 1 Zeitüberschreitung. `full-check.log`, `full-first-report/`. |
| `npx playwright test tests/browser/ordered-help.spec.ts -g 'Schülerablauf.*768x1024' --repeat-each=3 --trace=retain-on-failure --output=/workspace/mysteryboard-template-ordered-help-evidence/timeout-recheck-results` | 3/3 unveränderte Wiederholungen bestanden, zusammen 37,4 Sekunden; `timeout-recheck.log`, `timeout-recheck-report/`. |
| `npm run check` (abschließender Gesamtlauf) | 71/71 Datentests, Typprüfung und Builds erfolgreich; **118/118 Browsertests bestanden**, 0 fehlgeschlagen, 0 übersprungen, 0 flaky; 7,2 Minuten Browserlauf. `full-check-final.log`, `full-final-report/`. |
| `npm run test:rc2` | 4/4 bestanden: eingefrorene HTML und SCORM in einer lokalen LMS-Testhülle bei 1024×768 und 768×1024, vollständige Offline-Arbeitsabläufe; `rc2-check.log`, `rc2-report/`. |
| `node scripts/prepare-rc2.mjs` | Erwartete Sperre, Exit 1, alle Schutzdateien unverändert; `rc2-guard.json`. Es wurde kein Paket erzeugt. |
| `node /workspace/mysteryboard-template-ordered-help-evidence/measure-overviews.cjs /workspace/Mysteryboard-template` | 16 Messungen der echten HTML-Übersichten; `overview-measurements.json`. |
| `npx prettier --check src/core/model.ts src/core/layout.ts src/core/start-layout.ts src/core/help.ts src/components/LearningHelp.tsx src/components/Board.tsx src/App.tsx src/style.css scripts/content-config.ts scripts/check-build.mjs scripts/prepare-rc2.mjs tests/ordered-help.test.ts tests/browser/ordered-help.spec.ts` | Bestanden; `format-check.log`. |
| `git diff --check` | Keine Whitespace-Fehler. |

Das vollständige JSON-Beispiel aus `NEUES-MYSTERY.md` wurde zusätzlich durch `validateMystery` geprüft (`docs-example-validation.json`); es ergibt drei Karten, geordnete Ablage und zwei optionale Hilfekategorien.

**Zeitüberschreitungen transparent eingeordnet:** Ein früher `npm test`-Probelauf vor Ergänzung der neuen Tests überschritt fünf bestehende PNG-Testzeitlimits; dessen Ausgabe wurde nicht als Rohdatei gesichert. Die anschließenden normalen und seriellen Läufe bestanden ohne geänderte Zeitlimits. Im ersten vollständigen Browserlauf überschritt der Schülerablauf bei 768×1024 sein Gesamtlimit von 120 Sekunden. Der detaillierte Playwright-Bericht zeigt allein 57,672 Sekunden für das Erstellen einer neuen Browserseite, außerdem verzögerte Geometrie- und Screenshot-Aufrufe; es gab keine gemeldete Abweichung einer fachlichen Zustandsassertion. Der Erstfehler und alle drei unveränderten Wiederholungen sind im Paket erhalten. Zeitlimits und bestehende Assertions wurden nicht angehoben oder entfernt. Das spricht für eine vorübergehende Verlangsamung der Testumgebung; eine genaue Host-Ursache wurde nicht gemessen.

Die vorhandenen Regressionen prüfen unter anderem R1/R1b inklusive fehlender/verzögerter Klicks, Mehrfinger-/Abbruchgesten, sichtbare Verbindungslabels, den originalen 220-Verbindungen-Belastungsstand, alte PNGs, 12-/60-Karten-Wiederherstellung, Teamnamen, Undo/Redo, Exportproportionen, PNG-Grenzen, Offline-Betrieb und Werkzeugerreichbarkeit. Keine bestehende Assertion wurde entfernt oder abgeschwächt.

Die bisherigen Boden-Browsertests verwenden bewusst die eingefrorene RC2-HTML. Zusätzlich prüft ein neuer Test den aktuellen Kern in der getrennten Boden-Vorschau: explizites Ausgangslayout, allgemeiner Impuls und unveränderte Positionen nach Import einer echten RC1-Sicherung. Dadurch wird Altinhalts-Kompatibilität geprüft, ohne eine neue Boden-Unterrichtsversion auszuliefern.

## Artefakte und eingefrorene Referenzen

| Neutrale Einzel-HTML | Bytes | SHA-256 |
| --- | ---: | --- |
| `MysteryBoard-Vorlage-Geordnet-5.html` | 462039 | `334684d783346db97d202fb8b2c8ae8c155e9f7e8e7adf4b659cc79cbf7b5755` |
| `MysteryBoard-Vorlage-Geordnet-12.html` | 463208 | `ec3c799bed682f685fcbc64f8b6337b2b404fe0e65ede408be038958376ed49f` |
| `MysteryBoard-Vorlage-Geordnet-18.html` | 464498 | `87bfd725b77efc5a730622eb7ca44895ded811ac855815255483e2d8d7a9bb28` |
| `MysteryBoard-Vorlage-Geordnet-60.html` | 473589 | `b19d120bba6ae7da80e8c0240799df6e113b34f8902382633377fecbd9b1bf35` |

Unveränderte Boden-HTML (beide RC2-Dateinamen): **459.542 Bytes**, SHA-256 `21dd6ad5c813ba5bd12ca521f03602a195ccea44ee70769119280e4ca088fd5f`. Unverändertes RC2-SCORM: SHA-256 `42ac3d51e2e34431efe9b0ca9b0f4e84085d9b651e4fac6747d843bf6091c3a0`. Die fünf vor und nach dem Build verglichenen Schutzdateien umfassen zusätzlich Boden-JSON und `RC2-integrity.json`.

Die vollständigen Bytegrößen und SHA-256-Werte aller Prüf-HTMLs stehen zusätzlich in `evidence/integrity-before-commit.json` und `SHA256SUMS`. Alle HTML-Dateien bleiben unter 10.000.000 Bytes. Die HTMLs enthalten ihren Anwendungscode und ihre Inhalte vollständig. Das Abnahmepaket enthält außerdem Quellcode aus dem dokumentierten Liefer-Commit, Inhaltsdateien, Screenshots, Protokolle und die aktualisierte Anleitung.

Vor der Entwicklung per `git ls-remote` abgefragte, unverändert zu erhaltende Remote-Referenzen:

| Referenz | Commit / Tagobjekt |
| --- | --- |
| `main` | `1fa1fff81e5e19b7031130c8d034a77d9e1ace61` |
| `feat/mysteryboard-prototype` | `2c39d5427dc7cbd03558657d62821823949ac170` |
| `feat/mysteryboard-print-pdf` | `30ecd1d814b4510a689c7b5d44ad1dd6609849f1` |
| RC1-Tag | Objekt `9f02f956c1c6853137920d79f24ba66eb5b94b66`, Ziel `240d5fcfcac7e5924efe169493c9f7525ba5ed74` |
| RC2-Tag | Objekt `e25fa3fc483f1cd181f31960c9fe575fe358ec69`, Ziel `2c39d5427dc7cbd03558657d62821823949ac170` |

Nur der neue Feature-Branch wird normal gepusht. Der Nachvergleich im Lieferpaket dokumentiert die tatsächlichen Remote-Werte nach diesem Push. Keine Freigabe von Pages, kein Merge und keine öffentliche Veröffentlichung wurden vorgenommen.

## Offene echte Geräteprüfungen und Grenzen

- WebKit ist in dieser Umgebung nicht installiert; der dokumentierte Startversuch scheitert am fehlenden Browserprogramm. Es gibt keinen aktuellen Nachweis für WebKit 26.5 oder 27.2. Die R1b-Ereignis-Replays in Chromium ersetzen diese Engines nicht.
- Safari und verwaltete Schul-iPads: Hilfe öffnen/schließen, Legende scrollen, VoiceOver, Fokus, bewusste Buttons nach Touchgesten, Drag/Pinch, Orientierung drehen, PNG tatsächlich in „Dateien“ ablegen und in einer frischen Sitzung importieren.
- Auf sehr schmalen Fenstern beziehungsweise bei vielen Karten benötigt das Lesen der Kartentexte weiterhin das Lesefenster oder Zoom. Die Übersicht ist kein Ersatz für eine Lesedarstellung. Die gemessene Nummernschrift beträgt bei 5/12/18 Karten in allen vier Ansichten 16 CSS-Pixel, bei 60 Karten in 1024×768 und 768×1024 ebenfalls 16, bei 600×800 etwa 14,39 und bei 320×700 etwa 9,68 CSS-Pixel. Die letzten beiden Ansichten benötigen entsprechend Zoom für bequemes Lesen bzw. Antippen; die bestehende Begrenzung gegen übergroße Nummern bleibt erhalten. Die vollständigen Messwerte und das ausführbare Messskript liegen im Paket.
- Fachliche Hilfekategorien müssen pro neuem Mystery geprüft werden: hilfreiche Denkoperationen, keine lineare Musterlösung, keine bloße Drittelung nach Nummern. Das neutrale Beispiel ist kein geprüfter Unterrichtsinhalt.
- Größere Legenden sind im kompakten Hilfefenster scrollbar. Die Sicht- und Funktionstests ersetzen keine vollständige Screenreader- oder Barrierefreiheitszertifizierung.
- Native Safari-Druckfunktion und die separate Druckentwicklung bleiben offen beziehungsweise unverändert. Die hier geprüfte Print-Media-Regel belegt nur, dass Hilfe und Nummernhilfefarben nicht als fachliche Eigenschaften gedruckt werden.
- Keine öffentliche Bereitstellung, kein Merge, kein neuer Release-Tag, keine Änderung vorhandener Unterrichtsdateien. Reale Canva-/LMS-/Gerätefreigaben bleiben eigenständige Schritte.
