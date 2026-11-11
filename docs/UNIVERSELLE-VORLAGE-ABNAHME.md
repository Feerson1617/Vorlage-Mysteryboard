# MysteryBoard – universelle Vorlage und Boden 2.0.0

11. November 2026 (Europe/Berlin); Terminalzeiten in den Rohprotokollen sind UTC. Git-Basis: `545ece1fd723b953e4b36456d37bd6210a5ac916`, Branch `feat/mysteryboard-prototype`. Tatsächliche Ausgangsfassung war der **lokale korrigierte R1b-Stand**, bestätigt durch Quell- und Artefaktprüfsummen. Kein Commit, PR, Merge, Push oder Veröffentlichung.

## Ergebnis und Architektur

Die Anwendung bleibt eine universelle Vorlage: **ein Anwendungskern – beliebig viele getrennte Inhaltsdateien – je Inhalt eine eigenständige Schüler-HTML**. Es wurde keine zweite Boden-Anwendung entwickelt. Die bestehenden Inhalte `small.json` und `large.json` sind byteidentisch erhalten. Der neue Build erzeugt daraus weiterhin die kleinen und großen Prüffassungen und zusätzlich `MysteryBoard-Boden-Klasse11.html`.

Ein weiterer neutraler Datensatz mit **fünf Karten und Vertiefungen Z2/Z5** wird über dieselbe Registry gebaut und mit denselben Team-, Touch-, Export- und Importfunktionen geprüft. Er liegt unter den Prüfartefakten und wird nicht als Boden-Unterrichtsdatei ausgegeben. Für weitere Mysterys genügen JSON-Datei und Registry-Eintrag; die genaue Anleitung steht in [„Neues Mystery mit der Vorlage erstellen“](NEUES-MYSTERY.md).

## Unveränderte Fachinhalte und Herkunft

Eingang war `Boden-Mystery-Klasse11-v2.0.0 (1).zip`, SHA-256 `3a21736d757b6c069454b387f71c22fcaa81c1324b4a4f8e9cdea585650a54d1`. Die tatsächliche R1b-Quelllieferung hatte SHA-256 `cee72b4fd01afb0c47219358dd2223bb959dea193f82271e8d6634364550e2af`.

Alle **18 Karten** wurden mit identischen numerischen IDs, Titeln und Texten übernommen. Auch der vollständige Ausgangszustand ist unverändert: alle Farben Weiß, keine Verbindungen, sechs leere Kategorien, dieselbe Startanordnung. Ergänzt wurden ausschließlich `cardGroups` und `cards[].group` gemäß der expliziten Tabelle/JSON-Zuordnung aus den Integrationshinweisen. Karten 1–12 zeigen ihre numerische Kennung, 13–18 V13–V18. Im Anwendungskern gibt es weder eine Grenze „ab 13“ noch Annahmen zu Boden, Plön, Fach oder Pflichtumfang.

Die Inhalts-ID bleibt `geo11-boden-ploen-2026`, die Inhaltsversion **2.0.0**. Lehrkraft-PDF, Quellen-/Lehrkraftinformationen und Lösungen wurden nicht in das Laufzeit-JSON oder die Schüler-HTML eingebettet. Fachlicher Arbeitsauftrag und Begriffshilfe bleiben im gelieferten Schüler-PDF. Fingerprints und unabhängiger Quellvergleich stehen in `test-evidence/universal/provenance.json` und den Inhaltstests.

## Geänderte Bereiche

| Dateien | Änderung |
| --- | --- |
| `src/content/boden-klasse11.json` | Geprüfte Inhalte plus explizite Gruppenmetadaten. |
| `src/core/model.ts`, `src/core/codec.ts` | Generische Kartengruppen/Anzeigenummern, Teamvalidierung, kontrollierte Speicherformate 1/2. |
| `src/App.tsx`, `src/style.css` | Teamfeld beim Start, Änderung im Menü, kompakte Teamanzeige, allgemeine Dateibenennung und korrektes Markieren neuer Teamangaben als ungesicherte Bearbeitung. |
| `src/components/Board.tsx`, `src/core/layout.ts` | Anzeigenummern aus Metadaten; passend breite Kennzeichen und Bounds. R1b-Ereignisbehandlung unverändert. |
| `src/core/export.ts` | Gemeinsame, dynamisch umbrechende Titel-/Team-Kopfzeile; Metadatenkennzeichen im PNG. |
| `mysteries.json`, `scripts/content-config.ts`, `scripts/build.mjs`, `scripts/check-build.mjs`, `vite.config.ts`, `package.json`, `tsconfig.json` | Inhalt auswählen, gemeinsam validieren und eigenständig bündeln; keine neue Abhängigkeit. |
| `tests/content-build.test.ts`, `tests/universal-model.test.ts`, `tests/browser/universal.spec.ts`, neue Inhaltsfixtures | Wiederverwendbarkeit, Kompatibilität, vollständige PNG-Rundläufe und gerenderte Kopfzeilen. |
| `docs/NEUES-MYSTERY.md`, `docs/UNTERRICHTSERPROBUNG.md`, `docs/FORMAT.md`, `README.md`, dieser Bericht und Nachweise | Erstellung, Unterrichtserprobung, Prüfergebnisse und offene Abnahmen. |

Die Dokument-Klicksperre und Board-Pointer-Gesten aus R1b sind byteidentisch erhalten. Keine automatische Speicherung, kein Benutzerkonto, keine Übertragung der Teamangaben, kein Lehrkräfteeditor und keine Bewertung. Die bisherigen Testdateien bleiben unverändert.

## Speicherformat und Inhaltsversion

- Ohne Team bleibt **Schema 1 / MBS1 / MB1** erhalten; vorhandene Prüfsicherungen bleiben bytegleich packbar. Ein leeres Teamfeld ist zulässig.
- Mit Team wird **Schema 2 / MBS2 / MB2** verwendet. Teamnamen sind auf 80 Zeichen begrenzt; ungültige Eingaben verändern den Arbeitsstand nicht und werden verständlich gemeldet. Ältere Anwendungen weisen das neue Format ab, statt die Teamangabe stillschweigend zu verlieren.
- Die neue Anwendung liest beide Formate. PNG und QR enthalten denselben vollständigen Zustand; die QR-Grenze bleibt unverändert. Passt ein Arbeitsstand nicht in den QR, enthält die Original-PNG weiterhin alle Daten.
- Mystery-ID und Inhaltsversion werden unabhängig vom Speicherformat exakt verglichen. Boden 1.0.0 wird nicht als 2.0.0 übernommen; fremde Mysterys bleiben ausgeschlossen. Die Registry weist doppelte ID-/Versionskombinationen auch bei Einzelbuilds zurück.
- Ein neu beim Start eingegebener Teamname gilt als ungesicherte Bearbeitung. Menüänderungen sind rückgängig/wiederholbar. Import setzt wie bisher die History zurück. PNG-Erzeugung oder Download bestätigen weiterhin keine dauerhafte externe Ablage.

## Export und Sichtprüfung

Titel links und Team rechts beginnen in derselben horizontalen Zeile. Beide erhalten getrennte Breiten, lange Wörter werden passend umbrochen, die tatsächliche größte Zeilenhöhe bestimmt den freizuhaltenden oberen Rand. Ohne Team steht dem Titel die volle Breite zur Verfügung. Der bisherige QR-/Hinweisbereich unten sowie Bildproportionen und Sicherungsmechanismus bleiben erhalten.

Tatsächlich betrachtet wurden die gerasterte Boden-PNG-Kopfzeile, beide Boden-Ausgangsansichten (1024×768 und 768×1024), die vollständige Boden-Sicherung und die langen Kopfzeilen in beiden Exportgrößen. Der vollständige Boden-Titel steht links und der Teamname rechts auf derselben Zeile, ohne Überlagerung oder Abschneiden. Der Grenzfall mit 100 untrennbaren Titelzeichen und 80 Teamzeichen bricht in getrennten Bereichen korrekt um. Alle 18 Kennzeichen einschließlich V13–V18 sind in den Ausgangsansichten vollständig sichtbar, lesbar und eindeutig zugeordnet. Zum Lesen der Kartentexte dient das Lesefenster; die Übersicht muss nicht alle Fließtexte lesbar darstellen. PNGs und Koordinaten liegen unter `test-evidence/universal/visual/` und `measurements-and-console.json`.

## Testnachweise

`npm run check` bestand vollständig: **50/50 Datentests in sechs Dateien, TypeScript-Prüfung, drei Produktionsbuilds, zwei Prüfbuilds und 80/80 Chromium-Browsertests**. Browserlauf: 4,3 Minuten, keine Fehler, keine Wiederholungs-Erfolge und keine ausgelassenen Fälle. Verwendet wurden Node.js 24.22.1, Playwright 1.65.0 und Chromium 156.0.8078.79.

Die ursprünglichen 31 Daten- und 71 Chromium-Tests des lokalen R1b-Stands sind unverändert und bestanden; ergänzt wurden 19 Daten- und neun Browserfälle. Bestätigt sind insbesondere PNG-Größengrenze mit Rückfallweg, Bildproportionen, Dirty-Status, Undo/Redo, vollständige Wiederherstellung von 12 und 60 Karten, M1/M2, 220-Verbindungen-Kreuzungen, Touch ohne `click`, verzögerte Klicks, bewusste Dialogbuttons und ungültige Gesten. Die vier Varianten 12/60/18/5 Karten bestehen die neuen Team-/Offline-/PNG-Rundläufe.

Nach diesem Gesamtlauf wurde ausschließlich eine neue Registry-Testassertion von einer festen Variantenanzahl auf Pflichtvarianten plus vollständige Trennung aller konfigurierten Varianten umgestellt. Damit bleibt der dokumentierte Erweiterungsweg auch im Testlauf offen. Danach bestanden nochmals **50/50 Datentests** und `npx tsc --noEmit`; Runtime, Browserfälle und HTMLs blieben unverändert. Die bisherigen Testdateien sind bytegleich zum R1b-Ausgangsstand. Browserwarnungen/-fehler und zusätzliche HTTP(S)-Anfragen blieben in den dafür instrumentierten Interaktionsfällen leer; Terminalhinweise von npm/NO_COLOR sind keine Anwendungskonsolenfehler.

Neue Browserfälle prüfen vier fertig gebaute HTMLs, Teamstart/-änderung, vollständige PNG-Erstellung und Wiederherstellung in einem neuen Kontext, weitere Bearbeitung, Legacy-Import sowie Abweisung fremder oder inkompatibler Inhalte. Für Boden werden zusätzlich 1024×768 und 768×1024, Pflicht-/V-Anzeigen, native Touch-Kartenbewegung, Verbindung 1–V13, tatsächliche sichtbare Beschriftung, Richtung/Text, Undo/Redo und PNG geprüft. Die ergänzende Grenzprüfung der Kopfzeile verwendet 100 Zeichen Titel und 80 Zeichen Team in beiden Exportgrößen.

**Offline-Methode:** Die verwaltete Chromium-Umgebung blockiert direkte `file://`-Navigation mit `ERR_BLOCKED_BY_ADMINISTRATOR`. Diese Richtlinie wurde nicht umgangen. Jede Variante lädt deshalb genau ihr fertiges HTML-Hauptdokument einmal vom lokalen Server, wird unmittelbar danach offline gesetzt und bearbeitet/exportiert/importiert ohne weitere HTTP(S)-Anfragen. Auch die frischen Importsitzungen werden so geprüft. Direkte Dateiöffnung auf den tatsächlichen Schulgeräten ist damit weiterhin Teil der Geräteabnahme.

**Präzisierung im neuen Test:** Im Querformat lag die Mitte eines Verbindungslabels nach einer Kartenbewegung unter dem V13-Nummernkreis. Der Test tippt nun auf einen tatsächlich sichtbaren Punkt des Label-Rechtecks, anhand `elementFromPoint` geprüft, ohne `force` oder Tastaturersatz. Karten und Nummern behalten ihre bestehende Überlagerungsreihenfolge; es wurde dafür kein Laufzeitverhalten geändert. Der erste Testbefund ist protokolliert.

Text- und Auswahlfeldeingaben werden im Test technisch befüllt; die sichtbaren Dialogaktionen erfolgen per Touch. Browserwarnungen/-fehler werden in den neuen Interaktionsfällen gesammelt. Tatsächliche Bildschirmtastatur, Dateiauswahl und Aufbewahrung in iPad-„Dateien“ benötigen weiterhin die Geräteprüfung.

Arbeitsverzeichnis `/workspace/Vorlage-Mysteryboard`:

```sh
npm test
npx tsc --noEmit
npx vitest run tests/content-build.test.ts tests/limits.test.ts

npm run build
node scripts/build.mjs --tests
npx playwright test tests/browser/universal.spec.ts
npx playwright test tests/browser/universal.spec.ts --grep 'Boden (1024|768)'

# Abschließender Gesamtlauf mit allen vorhandenen und neuen Tests:
set -o pipefail
npm run check 2>&1 | tee /workspace/mysteryboard-universal-evidence/check.txt

# Nach der ausschließlich testseitigen Registry-Anpassung erneut ausgeführt:
npm test 2>&1 | tee /workspace/mysteryboard-universal-evidence/unit-final.txt
npx tsc --noEmit

# Beispiele für die künftig mögliche Auswahl (keine zusätzlichen Abnahmeläufe):
npm run build -- boden-klasse11
npm run build:example

sha256sum artifacts/*.html artifacts/tests/*.html
git diff --check
```

`test-evidence/universal/` enthält Terminalausgaben, Herkunftsnachweise, Einzelergebnisse, Konsolenbefunde und Exportkoordinaten. Der vollständige Playwright-Bericht samt PNGs und Screenshots liegt zusätzlich in der Prüflieferung. Testlaufzahlen beziehen sich auf den abschließenden Lauf; frühere Einrichtungs-/Testbefunde werden getrennt aufbewahrt.

## Artefakte

| Datei | Bytes | SHA-256 |
| --- | ---: | --- |
| `artifacts/MysteryBoard-klein.html` | 456.776 | `239ef346ca94538281835f5e38c363bda60e00b961a17880a89f78ca694aecff` |
| `artifacts/MysteryBoard-umfangreich.html` | 489.662 | `c15b75b5143c9c39f9396e57432cf9087b8f225115dd6a08f93d1f49f1f8f5f8` |
| `artifacts/MysteryBoard-Boden-Klasse11.html` | 458.326 | `2ed5f9a654089f643075cedb1a62e5a734be1d9cb4cb88b9c53b188cb7309d1c` |
| `artifacts/tests/MysteryBoard-Pruefung-220.html` | 997.375 | `3e70473f46d3f51301dbfcc79e98c0020c8575982bc647cf324a4d5adcdce7f8` |
| `artifacts/tests/MysteryBoard-Test-5.html` | 453.226 | `656a6c5676a72ce0ff48fce9c61702505626873f4457835bbe433cb4eaf1f9ae` |

Alle Ausgaben stammen aus demselben Quellstand und liegen unter **10.000.000 Bytes**. Die eindeutige Zuordnung erfolgt über Quell-/Dateimanifest und SHA-256; es existiert noch keine neue Commit-ID. Die vorbereitete statische HTTPS-Datei ist eine byteidentische Kopie der Boden-HTML als `index.html`, ohne Datenbank oder externe Skripte. Es wurde nichts bereitgestellt oder veröffentlicht.

## Offene Abnahmen

- WebKit/Safari einschließlich der zuvor fehlenden WebKit-Versionen ist weiterhin nicht unabhängig bestätigt. Der R1b-Stand bleibt hinsichtlich der bisherigen WebKit-Lücke vorläufig; Chromium-Replays sind kein Ersatz für echte Safari-Kompatibilität.
- Den vorgesehenen HTTPS-Schülerlink tatsächlich veröffentlichen und prüfen, **erst nach ausdrücklicher Freigabe**. Eine Canva-Kompatibilität ist nicht nachgewiesen.
- Auf zwei verwalteten Schul-iPads: längere Arbeit, Hoch-/Querformat, Touch/Pinch, Dateidownload, tatsächliche Ablage, vollständiges Beenden, Übernahme auf das zweite Gerät, Weiterbearbeitung, erneutes Sichern und gegebenenfalls QR/Kamera.
- **Gesonderter Auftrag vor medienreichen Mysterys:** Bildvergrößerung im Lesefenster. Der erneut ausgeführte Medientest dokumentiert bei 768/1024 Pixeln Breite für ursprünglich 16 Pixel große Karten-/Diagrammbeschriftungen nur etwa 4,6 bzw. 7,1 sichtbare Pixel. Diese Beschriftungen sind ohne Vergrößerung nicht ausreichend zugänglich. Die Erweiterung ist erforderlich, wurde auftragsgemäß noch nicht implementiert. Das neue Boden-JSON enthält ausschließlich Textkarten.
- Fachliche Unterrichtserprobung und reale Lesbarkeit bleiben Aufgabe der vorgesehenen Lerngruppe/Lehrkraft. Keine schulische Freigabe durch diesen technischen Bericht. Medienvergrößerung, mehrseitiger Druckexport und SCORM wurden nicht ergänzt.
