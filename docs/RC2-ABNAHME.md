# RC2 – Abnahme vom 13. November 2026

**A – Bereit zum itslearning-Praxistest.** RC2 einschließlich des neuen SCORM-1.2-Pakets ist gebaut und technisch geprüft. Die reale itslearning-/Safari-/Schul-iPad-Abnahme bleibt offen. Keine schulische Freigabe, keine öffentliche Pages-Veröffentlichung und kein Merge in `main`.

## Umfang und Herkunft

Basis: `240d5fcfcac7e5924efe169493c9f7525ba5ed74`, Tag `unterricht-2026-11-13-rc1`. Neue Referenz: `unterricht-2026-11-13-rc2` auf `feat/mysteryboard-prototype`. Die vollständige RC2-Commit-ID und das tatsächliche Push-Ergebnis stehen im begleitenden `RELEASE-REPORT.md` und `evidence/git-after.json` der Abnahmelieferung. Damit wird keine selbstbezügliche Commit-ID in den eigenen Quellcommit geschrieben.

Die ursprüngliche RC1-Boden-HTML mit SHA-256 `4c451aec074a8cca75dd1879fce21ef5a6e0b32ce40b6af9412b9f70186540e8` bleibt über die unveränderte RC1-Referenz erhalten. Vorhandene RC1-Lieferarchive und Pages-Vorbereitung wurden nicht überschrieben. Eine frühere RC1-SCORM-Datei war in der verfügbaren Umgebung nicht auffindbar; es wurde keine solche Datei verändert oder erneut als RC2 ausgegeben.

Geändert wurden ausschließlich die Anfangskoordinaten und Zeichenreihenfolge der Boden-Inhaltsdatei, ergänzende SCORM-Verpackungs-/Release-Skripte, Tests, erzeugte Artefakte und Dokumentation. Alle 18 Kartentexte einschließlich Titel und Metadaten, Mystery-ID und Inhaltsversion **2.0.0** sind unverändert. Sämtliche übrigen Dateien unter `src/`, also auch Modell, History, Touch-Steuerung, PNG/QR und Export, sind byteidentisch zur Basis. Kleine und große Produktions-HTML bleiben ebenfalls byteidentisch zu RC1. Kein Druckcode wurde übernommen.

Die räumliche Vorsortierung wurde durch ein gleichmäßiges 6×3-Raster mit zwei V-Karten je Reihe und einer je Spalte ersetzt. Keine vorgegebenen Verbindungen, Kategorien, Farben oder Startmarkierung. [Fachprüfung und Begriffshilfe](RC2-FACHPRUEFUNG.md) dokumentieren die eigenständige Grundbearbeitung aus Pflichtkarten plus vorhandener Hilfe. Eine Änderung der Kartentexte war nicht erforderlich.

## Artefakte

| Datei | Bytes | SHA-256 |
| --- | ---: | --- |
| `MysteryBoard-Boden-Klasse11-RC2.html` | 459542 | `21dd6ad5c813ba5bd12ca521f03602a195ccea44ee70769119280e4ca088fd5f` |
| `MysteryBoard-Boden-Klasse11-RC2-SCORM-1.2.zip` | 158755 | `42ac3d51e2e34431efe9b0ca9b0f4e84085d9b651e4fac6747d843bf6091c3a0` |

Die allgemeine Datei `MysteryBoard-Boden-Klasse11.html` entspricht der RC2-HTML bytegenau. Die SCORM-App `app.html` entspricht ebenfalls genau diesen geprüften Bytes. Die zusätzlichen Dateien `launch.html`, `session.js` und `imsmanifest.xml` sind ausschließlich Verpackung. Manifestkennung: `MysteryBoard-Boden-Klasse11-2026-11-13-RC2`. Kein Schüler- oder Lehrkraft-PDF, keine Lösung und kein Prüfdatensatz ist in der SCORM-ZIP enthalten.

## Ausgeführte Prüfungen

Werkzeugstand: Node 24.22.1, npm 11.9.0, Playwright 1.65.0, Chromium 156.0.8078.79, Python 3.12.14. Alle Befehle im Repository-Stamm:

```sh
npm run check
# Exit 0: 57 Datentests, TypeScript, drei Produktions- und zwei Prüfbuilds,
# alle 96 vorhandenen Chromium-Browsertests bestanden.

node scripts/prepare-rc2.mjs
python scripts/validate-scorm.py artifacts/MysteryBoard-Boden-Klasse11-RC2-SCORM-1.2.zip artifacts/MysteryBoard-Boden-Klasse11-RC2.html
# Exit 0: ZIP-CRC, XML-Parsing/Manifestvertrag, lokale Referenzen, Byteidentität.

npm run test:rc2 -- --max-failures=1
# Exit 0: alle vier zusätzlichen vollständigen RC2-/SCORM-Abläufe bestanden.

npx tsc --noEmit
git diff --check
# Exit 0, abschließende Typ-/Änderungsprüfung.

node scripts/work-compatibility.mjs --engine webkit --expected-version 26.5 --html-dir artifacts --output /workspace/mysteryboard-rc2-2026-11-13/evidence/webkit-26.5
node scripts/work-compatibility.mjs --engine webkit --expected-version 27.2 --html-dir artifacts --output /workspace/mysteryboard-rc2-2026-11-13/evidence/webkit-27.2
# Je Exit 1 vor Browserstart: /home/agent/.cache/ms-playwright/webkit-2388/pw_run.sh fehlt.
# Kein WebKit-Kompatibilitätsnachweis, auch nicht für die SCORM-Hülle.
```

Die 57 Datentests enthalten die bisherigen 50 Prüfungen und sieben zusätzliche Fälle für Mischanordnung, echte RC1-PNG-Kompatibilität, deterministische Verpackung und datensparsame SCORM-Sitzungen. Kein bestehender Browsertest wurde geändert oder entfernt. Der bisherige Inhalts-Fingerprint bleibt unverändert; nur die ausdrücklich beauftragte neue Anordnung wird jetzt gesondert fest erwartet, während die eingefrorene RC1-Anordnung weiterhin gegen ihren bisherigen Fingerprint geprüft wird.

Die vollständige Regression umfasst unter anderem PNG-Grenzfall, 12-/60-Karten-Wiederherstellung, M1/M2, 220 Verbindungen, R1/R1b-Touch-Fehler, Teamnamenpflicht, Undo/Redo, Bildproportionen, Offline-Verhalten und HTML-Größengrenze. Ergebnis: 96/96, keine übersprungenen oder nach Wiederholung geretteten Fälle.

Die vier zusätzlichen Durchläufe testen die **tatsächliche RC2-HTML** und die **aus der erzeugten ZIP ausgelesenen Dateien** jeweils bei 1024×768 und 768×1024 CSS-Pixeln. Nach dem lokalen Laden werden die Browserkontexte offline geschaltet. Je Durchlauf: Teamnamenpflicht, 18 korrekte Positionen und überlagerungsfreie Karten, alle Karten über Nummern öffnen/schließen, vollständiger Textvergleich und mindestens 18-px-Lesetext, native Chromium-Touch-Gesten für Verschieben/Pan/Pinch, Übersicht, V-Karten, Farbe/Kategorie, Verbindungen anlegen/ändern/beschriften/umkehren/löschen, sichtbare Beschriftung antippen, Undo/Redo, Teamname ändern, Original-PNG herunterladen, vollständiger Zustandsvergleich nach Import in einen neuen Browserkontext, Weiterbearbeitung, beschädigte/fremde PNG ablehnen ohne Zustandsverlust, echte RC1-PNG importieren und alte Positionen erhalten. Keine unerwarteten HTTP(S)-Anfragen oder Browserfehler, keine lokale/Sitzungs-Arbeitsstandspeicherung.

Im simulierten LMS sitzt die unveränderte App im Wrapper-Frame unter dem Player-Frame. Auch Downloads und native Dateiauswahl werden innerhalb dieser Einbettung ausgeführt. Die API-Aufzeichnung lautet jeweils genau `[["LMSInitialize", ""], ["LMSFinish", ""]]`. Kein Datenlesen/-schreiben, keine Punkte, Bewertungen oder Fortschrittsfelder. Das Ende wird durch reale Navigation des SCO-Frames geprüft; ein simuliertes bfcache-Signal beendet die Sitzung nicht und verändert keinen Arbeitsstand. Der Unit-Test prüft zusätzlich fehlende, ablehnende und unzugängliche APIs. Das ist keine Prüfung der tatsächlichen itslearning-Sandbox oder des verwalteten Dateidialogs eines iPads.

## Sichtprüfung und Grenzen

Die Screenshots beider Startansichten und der beiden LMS-Ansichten wurden selbst betrachtet. Pflicht- und V-Karten sind auf derselben Fläche gemischt. Es gibt keine sichtbare Anfangsauswahl oder thematische Bereichstrennung. Alle Nummern sind etwa 16 CSS-Pixel groß und vollständig sichtbar; die Werkzeugtasten mindestens 48×48 CSS-Pixel. Karten sind ohne Überlagerung und mit freien Zwischenräumen angeordnet. Die Vorschautexte bleiben besonders im Hochformat klein; das Lesefenster stellt die vollständigen Texte groß dar. Die betrachteten Lesefenster für Pflichtkarte 8 und V13 sind gut lesbar und ihre Bedienelemente erreichbar. Eine kleine eingebettete Kursvorschau sollte für die tatsächliche Arbeit vergrößert werden.

Die ersten Entwicklungsdurchläufe des **neuen** Abnahmeskripts fanden drei Testaufbaufehler: fehlendes JSON-Importattribut unter Node, eine fälschlich unverändert erwartete Zeichenreihenfolge nach einem Drag und eine zu eng formulierte Label-Suche für das Richtungsfeld. Diese wurden im Test korrigiert, ohne die Anwendung zu ändern oder Prüfungen zu lockern. Der dritte Versuch wurde nach der Diagnose abgebrochen. Rohprotokolle und der abschließende erfolgreiche Vierfachdurchlauf sind in der Lieferung erhalten.

Offen bleiben: tatsächlicher itslearning-Import und Player, Safari/WebKit, verwaltete Schul-iPads einschließlich Dateidownload/-auswahl und Wiederherstellung, gegebenenfalls Canva-Veröffentlichung. Der Druckbranch und dessen native Safari-Druckabnahme bleiben getrennt und unverändert. Ein technisches Bestehen ersetzt weder diese Praxistests noch eine didaktische Erprobung der 20-Minuten-Phase. [Kurzanleitung für den Praxistest](RC2-SCORM.md).
