# MysteryBoard Studio – technischer Abnahmebericht

Stand: 17. November 2026. Ausgangspunkt `a04f7c59f51309676156cdcb959db4fdc39128c3`.
Branch `feat/mysteryboard-studio-macos`; kein Merge in main, keine Pages-
Veröffentlichung und kein öffentlicher GitHub-Release. Die genauen Quell-, Build-
und Bereitstellungscommits sowie Dateigrößen und SHA-256 stehen in `VERSION.json`,
`MANIFEST.json` und `Mac-Dateien.json` des Abnahmepakets.

Der eingefrorene Anwendungscode stammt aus
`0defd50126519ddda43a6a001a06355206844a93`.
Der erfolgreiche native Abschlusslauf ist
[44029762631](https://github.com/Feerson1617/Vorlage-Mysteryboard/actions/runs/44029762631),
auf macOS **15.8.2 ARM64**. Die Mindestangabe macOS 13 ist ein Build-Ziel;
macOS 13 und der konkrete M1 wurden nicht eigens abgenommen.
Spätere Commits enthalten nur Nachweise, Dokumentation und Bereitstellung.

## Ergebnis und praktische Grenzen

Es existiert eine tatsächlich auf macOS ARM64 gebaute `.app`, als ZIP und DMG
verpackt. Der Mac-Test hat die DMG mit `hdiutil verify` geprüft, eingehängt, die
App ohne administrative Installation in einen Benutzerordner kopiert und **diese
installierte App** gestartet. Es handelt sich nicht um eine Linux-Datei mit
Mac-Dateinamen. Electron 45.3.3 / Chromium 156.0.8078.100 wurden im laufenden
Mac-Prozess ermittelt. Die fertige App enthält ihre eigene Laufzeit; Terminal,
Python, Entwicklungsserver und ein zusätzliches Node.js gehören nicht zum Betrieb.

Der native Test bestätigt Projektdateien, Dateischreibvorgänge, Speichern unter,
Schließschutz, direkte Vektor-PDFs mit 5/16/20/60 Karten, zwei unterschiedliche
SCORM-Exporte, die isolierte Schüler-Vorschau und lokale OCR mit 4, 16 und 20 Karten.
Zusätzlich prüft er, dass ein neues Mystery aus einem Import einen neuen
Speicherpfad verlangt und ein abgebrochener Speicherdialog die vorherige Datei
bytegleich erhält.

**Dies ist keine Freigabe für den eigenen M1-Mac oder den Schulbetrieb.** Die
native Prüfung lief auf einem gehosteten macOS-ARM64-Runner, nicht auf dem
konkreten Nutzergerät. Dateidialogantworten wurden im Test vorgegeben; der reale
Dateizugriff und der echte PDF-Druckkern liefen in der gepackten App. Der manuelle
Finder-Erststart, echte Kamera, itslearning und verwaltete Schul-iPads bleiben
offen. Keine unbelegte FPS-, M1-Speicher- oder Echtzeitaussage.

Die App ist **ad hoc signiert**, ohne Apple Developer ID und ohne Apple-
Notarisierung. Die vollständige Ressourcenprüfung besteht; Gatekeeper erteilt
keine Vertrauensfreigabe (`rejected`). Diese beiden Ergebnisse sind ausdrücklich
verschiedene Prüfungen. Die Installation kann auf verwalteten Macs gesperrt sein.
Es wurde keine Apple-Signatur behauptet, kein kostenpflichtiger Signierungsdienst
verwendet und keine globale Sicherheitsabschaltung als Installationsweg eingebaut.

Eine zusätzliche automatische Wiederherstellung nach Prozessabsturz wurde nicht
implementiert. Dies war im Auftrag als Wunsch formuliert. Nicht gesicherte
Projekte bleiben im Arbeitsspeicher; Schließwarnung und bewusstes natives Sichern
sind vorhanden. Die Grenze ist in der Bedienungsanleitung ausdrücklich genannt.

## Ein Kern, Studio und separater Player

Studio verwendet die bisherigen Autoren-, Import-, Hilfe-, Medien- und Board-
Komponenten. Normalansicht und „Mystery gestalten“ bearbeiten dasselbe `Draft`-
Dokument. Die Pinnwand ist eine andere Präsentation des bestehenden Editors,
keine zweite Kartenlogik und kein alternatives Datenmodell.

Der Player besitzt einen eigenen Einstiegspunkt und Build. Sein tatsächlicher
Modulgraph wird bei jedem Build geprüft. `AuthorEditor`, `HelpEditor`,
`DocumentImport`, Autorenlogik und Tesseract dürfen darin nicht vorkommen.
Autoren-/Import-/OCR-Styles werden ebenfalls entfernt. Gemeinsame Dokument-
Validatoren kennen weiterhin die bestehenden Dateitypen; dies ist die notwendige
Formatbibliothek und keine Autorenoberfläche.

Studio exportiert aus genau diesem vertrauenswürdigen Player-Template. Eine
validierte freigegebene Aufgabe wird als inertes JSON mit Base64-Dokumentbytes
sicher eingebettet. Es wird kein aktueller Autoren-DOM kopiert. Die tatsächliche
Schüler-ZIP enthält vier Dateien: `app.html`, `launch.html`, `session.js` und
`imsmanifest.xml`. Titel, Medien, Tabellen, Quellen, Hilfen, Gruppen und neutrale
Startablage sind enthalten. Nur freigegebene Karten werden veröffentlicht.

Die Vorschau startet denselben Player in einer eigenen, nicht persistenten
Electron-Session. Sie besitzt weder die Studio-Bridge noch Node-Zugriff.
Vorschaubeziehungen und Teamangaben gelangen nicht in das Autorenprojekt oder
die veröffentlichte Aufgabe.

Die bisherige Universal-Webfassung bleibt als kompatible Bestandsanwendung
verfügbar. Der neue Studio-Veröffentlichungsweg nutzt den getrennten Player.
Die eingefrorene Boden-RC2 wurde nicht neu gebaut oder überschrieben.

## Oberfläche und Inhaltstreue

Die normale Pinnwand enthält die fünf Hauptaktionen „Karte hinzufügen“, „Material
importieren“, „Mystery gestalten“, „Projekt sichern“ und „Exportieren“. Eine leere
Pinnwand lädt zur ersten Karte ein. Karte anklicken öffnet die vorhandene
Bearbeitung; Ziehen speichert die Autorenpositionen im Lehrkraftentwurf.
Quellen, Tabellen, Bildbeschreibungen, zusätzliche Bilder und weitere Angaben
liegen unter „Weitere Kartenangaben“. Es wurden keine Quellen durch bloßes
Umschalten ausgeblendet und anschließend aus dem Dokument entfernt.

„Mystery gestalten“ bündelt Darstellung, Verbindungen, Karten/Medien und
Startanordnung. Voreinstellungen funktionieren ohne Gestaltungsmodus. Änderungen
werden im selben Inhalt gespeichert; bloßes Öffnen ist kein Dokumentedit.
Globale Linienstile haben eine eindeutige Geltung. Bestehende Richtungen werden
nicht durch globale Gestaltung umgedreht. Die Ausgangsrichtung betrifft nur
neue Verbindungen; eine ungerichtete Verbindung bleibt bewusst wählbar.

Neue Studio-Dokumente verwenden sichtbare Nummern nach Gruppen: 1, 2 … und
V1, V2 … . Die Nummer ist von der internen ID und einer Originalüberschrift wie
„Karte J“ getrennt. Umordnen ändert die Reihenfolge ohne blindes Überschreiben von
Titeln. Strukturänderungen beziehungsweise Veröffentlichung ordnen IDs und
Hilfereferenzen über die bestehende atomare Zuordnung gemeinsam neu zu. Die
zusätzlichen Datentests prüfen die referenzierten Originalkarten explizit.

Auf der Autorenpinnwand erarbeitete Positionen stehen in `author.board`; die
Schülerstartanordnung bleibt getrennt. Die Veröffentlichung entfernt den gesamten
Autorenbereich und startet ohne Schülerfarben, Kategorienamen oder Beziehungen.

Ein Hauptbild und drei weitere Originalbilder pro Karte sind möglich.
Bildunterschriften, Quellen und Alternativtexte bleiben zugeordnet. Word-Bilder
innerhalb einer erkannten Karte können gemeinsam erhalten werden. Beim
Zusammenführen über vier Bilder wird abgewiesen, ohne Eingaben zu verändern.
Ein abgeschnittener Bildbereich kann zusätzlich zugeordnet werden, ohne ein
vorhandenes Originalbild unbemerkt zu ersetzen.

Die lokale OCR ergänzt das bestehende Verfahren. Die sichere Electron-Origin
`mysteryboard://app` ist gezielt freigeschaltet; beliebige Custom-Schemes und
`file://` sind kein OCR-Vertrauensweg. OCR-Engine, Worker und deutsches Modell
liegen im Paket, mit deaktiviertem Inhaltscache. Kein CDN und keine Cloud-API.

Grafische Pixel, die durch OCR-Wortrechtecke nicht erklärt werden, werden
vorsorglich als Originalausschnitt erhalten. Dies klassifiziert keine fachlichen
Diagramminhalte. Falschpositive und verpasste Zuordnungen sind möglich und
manuell korrigierbar. Eine zusätzliche neutrale Fotoprüfung belegt zwei Karten,
einen echten erhaltenen Diagrammausschnitt und **keine erfundene Datentabelle**.
Die Lehrkraft muss Zahlen, Einheiten, Originalgrafiken und Quellen weiterhin
prüfen. Rohe OCR ist nicht fehlerfrei; die vorhandenen Originalvergleiche und
Korrekturprüfungen bleiben erhalten.

## Daten- und Speichervertrag

- Dokumentformat bleibt MysteryBoard v3; Work-Schemas 1/2, PNG-Block und
  Richtungswerte 0/1/2 bleiben erhalten.
- Neue Gestaltung, Gruppennummerierung, Bildmetadaten und Autorenpositionen sind
  optionale validierte Erweiterungen. Die aktuelle Software liest die bisherigen
  gültigen Dateien. Ältere ausgelieferte Leser sind nicht automatisch vorwärts-
  kompatibel zu den neuen optionalen Feldern; neue Dateien mit diesen Angaben
  benötigen einen aktuellen Player.
- Dateipfade stammen aus nativen Dialogen oder der lokalen Liste bereits
  gewählter Dateien. Der Renderer erhält keine allgemeine Dateisystem-API.
- Projektdateien werden geprüft und atomar geschrieben. Ein erzeugtes Bild oder
  ein abgebrochener Dialog gilt nicht als nachgewiesenes externes Sichern.
- Bei einem neuen importierten Mystery wird die alte native Dateibindung gelöst.
  Offene Import-/Karten-/Hilfeschritte können nicht über das Projektmenü
  unbeabsichtigt verlassen oder als fertiges Projekt übersprungen werden.
- Schüleraktivitäten bleiben im Arbeitsspeicher und in der bewusst abgelegten
  vollständigen Original-PNG. Keine dauerhaften Schülerdaten in Browser-
  Speichern und keine Übermittlung an das LMS.

## Sicherheit und Lizenzen

Im tatsächlich laufenden Mac-Prozess wurden `sandbox: true`,
`contextIsolation: true`, `nodeIntegration: false`,
`nodeIntegrationInWorker: false`, `webSecurity: true` und
`allowRunningInsecureContent: false` ermittelt. Die App verwendet keine
`--no-sandbox`-Startoption. Der Linux-Container konnte die Electron-Sandbox nicht
bereitstellen; dieser Start wurde abgebrochen und nicht durch eine abgeschaltete
App-Sandbox umgangen. Die separaten Chromium-Webtests verwenden die vorhandene
Cloud-Browser-Testkonfiguration und sind keine native Sandbox-Abnahme.

Der Standard-/Secure-Custom-Protocol-Handler begrenzt Dateien per realem Pfad auf
die App-Ressourcen. Externe Navigation, Popupfenster, Webviews und unnötige
Netzwerk-/Berechtigungszugriffe sind gesperrt. IPC prüft den aufrufenden
Hauptframe, Datenarten, Grenzen und Dokumentrolle. Die Schüler-Vorschau besitzt
eine eigene Origin/Session ohne Studio-Bridge. Der PDF-Kontext hat deaktiviertes
JavaScript und keine Preload-Bridge.

Die bislang zur Laufzeit kompilierten AJV-Validatoren werden aus denselben
Schemas vorab erzeugt. Die Studio-CSP benötigt kein JavaScript-`unsafe-eval`.
Inline-Programmbündel erhalten konkrete SHA-256-Freigaben; `wasm-unsafe-eval`
erlaubt den lokalen WASM-OCR-Kern. Eigene Inhalte werden als Text und validierte
Bilddaten behandelt. Ein normal ausgeführter Testscript konnte JavaScript-eval
unter der Produktions-CSP nicht ausführen; eine bloße DevTools-evaluate-Probe
wurde ausdrücklich nicht dafür als Nachweis benutzt.

Tesseract.js/Core 7.0.0, deutsches Modellpaket 1.0.0 und sämtliche benötigten
Ressourcen werden lokal geliefert. Lizenz-/Copyrighttexte der tatsächlichen
Player-Abhängigkeiten stehen inert in seiner HTML. Die App enthält zusätzliche
Third-Party-Verzeichnisse einschließlich der freien Liberation-Schriften und
Modelldokumentation. Es werden keine kostenpflichtigen Assets, OCR-Dienste oder
Apple-Signierungszugänge benötigt.

## Nachgewiesene Probleme und Korrekturen

| Ursache | Korrektur und Nachweis |
| --- | --- |
| Desktop-CSP blockierte Laufzeitkompilierung von Schemafunktionen | Vorab erzeugte Validatoren statt neuer `Function`; unveränderte alte Datentests und Produktions-CSP-Prüfung |
| CommonJS-/ESM-Interoperabilität der Validator-Hilfsfunktion | Normalisierter Import der vorhandenen AJV-Laufzeitfunktion; wirklicher Browser-Dateiimport besteht |
| Formatierter JSON-Platzhalter wurde beim Player-Export nicht erkannt | Vertrauenswürdiger Platzhalter erlaubt Formatierungsleerraum; tatsächliche SCORM-ZIPs werden gestartet |
| OCR prüfte ausschließlich HTTP/HTTPS | Eng begrenzte Freigabe der sicher registrierten Studio-Origin; echte native 4-/16-/20-Karten-OCR besteht |
| Schnittmarken vergrößerten den Scrollbereich und erzeugten einen falschen Überlaufalarm | Text-/Bildüberlauf vor dekorativen Schnittmarken prüfen; echte PDF-Erzeugung und unabhängige PDF-Kontrolle |
| Weiterverwendete ursprüngliche Electron-Signatur versiegelte neue App-Ressourcen nicht | Kostenlose Ad-hoc-Neusignierung und vollständige Ressourcenprüfung vor DMG-Erstellung; keine behauptete Apple-Vertrauenssignatur |
| Neues Import-Mystery behielt die native Bindung des alten Projekts | Dateibindung bei neuer Mystery-ID lösen; nativer Test verlangt neuen Dialog und vergleicht alte Datei bytegleich |
| Entferntes Hauptbild konnte eine verwaiste/unpassende Übersichtsunterschrift hinterlassen | Nur die tatsächliche repräsentative Grafik beschriften; Datentest für fehlendes Hauptbild und erste Zusatzgrafik |
| Mehrere Bilder passten nicht in das ursprüngliche Ein-Bild-Modell | Optionale Originalbildliste, sichere Zusammenführung und Originalausschnitte; neue Datentests und echte Grafikprüfung |

Einige frühere native Testfehler lagen im Harness: Sichern wurde zunächst gegen
den Speichern-unter-Pfad geprüft; native Dialogantworten und JavaScript-Dialoge
konnten doppelt angenommen werden. Die Korrekturen ändern keine erwartete
Anwendungsleistung und entfernen keine fachlichen Assertions. Alte Testdateien
wurden nicht abgeschwächt. Frühe Fehlprotokolle bleiben als Entwicklungsnachweise
gekennzeichnet; die Abschlussauswertung verwendet nur vollständige erfolgreiche
Läufe.

In einem vorherigen vollständigen Chromium-Lauf bestanden 271 von 272 Fällen.
Nach gemischter CDP-Pinch-/nativer Tap-Emulation fehlte beim zweiten Sichern auf
320 Pixeln das native `click`, obwohl `pointerdown` und `pointerup` am Button
ankamen. Die Ereignisaufzeichnung ist unter
`evidence/Frueher-Testlauf-Touch-Emulation/` erhalten. Derselbe unveränderte Test
bestand anschließend dreimal hintereinander. Dies ist kein Nachweis eines
reproduzierbaren Studio-Codefehlers; der beobachtete Aussetzer bleibt als
Teststabilitätsrisiko dokumentiert. Kein alter Test und keine Touch-Assertion
wurde dafür entfernt, umgangen oder abgeschwächt.

## Konkrete Ergebnisse

| Prüfung | Ergebnis / Nachweis |
| --- | --- |
| Daten-/Format-/Grenztests | 177 bestanden, davon 165 bisherige und 12 neue Studio-Fälle |
| Vollständiger Chromium-Abschlusslauf | 272 von 272 bestanden, 29,7 Minuten; kompletter Lauf ohne Retry und ohne Teständerung |
| Separater eingefrorener RC2-Lauf | 4 von 4 bestanden, 49,7 Sekunden |
| Unveränderte bisherige Testdateien | 129 Dateien bytegleich zu `a04f7c59`; neue Tests ausschließlich zusätzlich |
| Native installierte App | 17 erfolgreiche Prüfpunkte auf macOS 15.8.2 ARM64 |
| Mac-Schüler-SCORM in Chromium | Beide real exportierten Pakete starten; Bearbeitung, gerichteter Pfeil, Drag, Undo/Redo, CDP-Pinch, echte PNG und neue Sitzung bestehen |
| Mac-Schüler-SCORM in WebKit 27.2 | Beide real exportierten Pakete einschließlich Tap, Drag, Undo/Redo und vollständiger PNG-Wiederherstellung bestehen; CDP-Pinch wurde hier ausdrücklich nicht ausgeführt |
| WebKit 26.5 | Nicht verfügbar, offen |
| Workflow A | Vier eingegebene Karten und SCORM ohne Gestaltungsmodus, 4.086 ms automatisierte Laufzeit |
| Workflow B | Echter 16-Karten-Scan, Solltextkorrektur, Einzelkontrolle, Übernahme, SCORM und neue PNG-Sitzung, 31.780 ms automatisierte Laufzeit |
| Workflow C | Schrift, Kartenfarbe und Pfeile ändern, zurück, sichern, öffnen, SCORM und PNG-Restore, 5.965 ms automatisierte Laufzeit |
| Vollständige Aufgaben in PNG | Acht tatsächlich heruntergeladene PNGs unabhängig dekodiert; alle Inhalte/Medien und Content-Hashes gleich dem jeweils unveränderlich aufbewahrten SCORM-Export |
| Datenschutz/Offline | Keine externen Laufzeit-Anfragen in diesen Workflows; Browser-Speicher nach Wiederherstellung leer; SCORM-Rahmen ohne `LMSSetValue` |
| Reproduzierbarer Build | Aus separat entpacktem Quellpaket 177 Tests und TypeScript erfolgreich; Studio und Player bytegleich neu gebaut |
| HTML-Größe | Studio-Renderer 9.691.930 Bytes; Player-Template 1.250.469 Bytes; alle 15 geprüften HTMLs unter 10.000.000 Bytes |
| Versionsschutz | Beide eingefrorenen Boden-HTMLs und RC2-SCORM bytegleich; main unverändert bei `1fa1fff81e5e19b7031130c8d034a77d9e1ace61` |

Die Zeiten stammen aus automatisierter Bedienung auf dem Cloud-Testrechner.
Workflow B übernimmt ausdrücklich korrigierte Solltexte und behauptet keine
fehlerfreie rohe OCR. Eine echte Lehrkraft benötigt Zeit für die fachliche
Originalkontrolle; diese menschliche Zeit wurde nicht gemessen. Eine formale
Studie mit neuen Lehrkräften fand nicht statt.

Die unabhängige PNG-Prüfung vergleicht vollständige Aufgabenobjekte einschließlich
Medien, Quellen und Gestaltung mit dem konkreten Export; zusätzlich vergleichen
die Browser gespeicherte und wiederhergestellte Positionen, Kartenfarben,
Pfeildarstellung, Beschriftung und Teamangabe. WebKit ersetzt im tatsächlichen
Downloadnamen Leerzeichen durch Unterstriche; Team- und Mysteryzuordnung bleiben
erhalten.

Die native PDF-Matrix umfasst:

| Karten | Format | Seiten einschließlich Titelseite |
| --- | --- | --- |
| 5 | A4 hoch | 3 |
| 16 | A3 quer | 3 |
| 20 | A4 quer | 5 |
| 60 | A3 hoch | 5 |

Alle 16 Seiten sind gerendert. Originalüberschriften, Kartentexte und Quellen
wurden gegen die tatsächlich gespeicherten Projekte geprüft; jede Karte liegt
vollständig auf einer Seite. Schriftobjekte, Vektorrahmen und Originalbilder sind
im PDF vorhanden. Die zusätzliche Browser-A4-Matrix ergibt 3/4/4/9 Seiten und ist
als eigener Nachweis von der nativen Formatmatrix unterschieden.

Ein weiterer PDF-Test mit 3.640 Zeichen exportiert den gesamten Text auf einer
Kartenseite mit eingebetteter Liberation-Serif-Schrift. Eine 3.910-Zeichen-Karte
mit vielen Absätzen passt nicht lesbar und wird mit konkreter Erklärung ohne
Teil-PDF zurückgewiesen. Diese Abweisung ist beabsichtigter Inhaltsschutz.

Beim Neubau aus dem Quellpaket wurden die vorhandenen gepinnten lokalen
Abhängigkeiten per Hardlink verwendet, kein frisches Linux-`npm ci` behauptet.
Der native macOS-Abschlusslauf führte dagegen tatsächlich `npm ci` aus.

## Dateien und Integrität

| Datei | Bytes | SHA-256 |
| --- | ---: | --- |
| MysteryBoard-Studio-Apple-Silicon.dmg | 125.949.583 | `befb973b5caa50bb22e90bd78971b5daab6320269c99ba52314c154952dcf7ec` |
| MysteryBoard-Studio-Apple-Silicon.zip | 127.811.911 | `9c3a5260e169aaa3065776878f12a34b28cc740d2a8a59519c9633fe0f9460d2` |
| Eingefrorene Boden-RC2.html | 459.542 | `21dd6ad5c813ba5bd12ca521f03602a195ccea44ee70769119280e4ca088fd5f` |
| Eingefrorene Boden-RC2-SCORM-1.2.zip | 158.755 | `42ac3d51e2e34431efe9b0ca9b0f4e84085d9b651e4fac6747d843bf6091c3a0` |

Das App-ZIP wurde vollständig auf CRC geprüft und entpackt: 266 reguläre Dateien
bytegleich, 14 Framework-Symlinks und ausführbarer ARM64-Starter erhalten.
Die DMG-Prüfung stammt aus dem nativen `hdiutil`-Abschlusslauf, nicht aus einer
behaupteten Linux-DMG-Montage. Das separate Abnahmepaket enthält vollständigen
Quellcode, alle bisherigen Tests, gepinnte Lockdatei, Build-/QA-Skripte, gebauten
Renderer mit lokaler OCR, Player, Beispielprojekte, PDFs, Schüler-SCORMs,
Original-PNGs und Protokolle. Die großen nativen Binärdateien werden separat
geliefert. `verify-package.py` kontrolliert sämtliche Dateigrößen, SHA-256 und
enthaltene ZIPs. Der äußere ZIP-Hash steht in der daneben gelieferten
`.integrity.json`/`SHA256SUMS.txt`, um keinen Selbstbezug zu erzeugen.

Die Native-Artefaktkopie kann mit GitHub-Anmeldung zusätzlich aus
[Actions-Artefakt 14304921227](https://github.com/Feerson1617/Vorlage-Mysteryboard/actions/runs/44029762631/artifacts/14304921227)
geladen werden (Aufbewahrung bis 17. Dezember 2026, 06:17 UTC). Dieser tatsächliche
Download wurde geprüft; es handelt sich nicht um einen neuen öffentlichen
GitHub-Release. Lokale direkte Dateidownloads werden zusätzlich bereitgestellt.

Die betroffenen Dateien sind unter `evidence/Geaenderte-Dateien.txt` aufgeführt.
Die Änderungen betreffen insbesondere `studio/electron/`, `studio/ui/`,
`studio/player/`, `scripts/studio/`, die optionale Studio-Präsentation in
`src/components/AuthorEditor.tsx`, gemeinsame Gestaltung/Medien/Validierung sowie
zusätzliche Tests und den Mac-Workflow. Die bisherigen Touch-, PNG- und
History-Kernmodule wurden nicht neu implementiert.

## Prüfungen und reproduzierbare Befehle

Die tatsächlichen Befehle, Logs, Versionen, Dateihashes und Ergebnisse befinden
sich zusätzlich maschinenlesbar im Abnahmepaket. Folgende Befehle gelten im
Projektverzeichnis mit Node 24; macOS-spezifische Kommandos auf macOS ARM64:

```sh
npm ci
npm test
npx tsc --noEmit
npm run studio:build
npm run studio:make -- --platform=darwin --arch=arm64
npm run studio:test

# Vollständige bestehende Webregression inklusive tatsächlicher Produktions-
# HTMLs, bestehender SCORMs, Touch, Pfeile, Hilfen, OCR, Druck und PNG.
CLASSROOM_SCORM=1 OCR_EVIDENCE_DIR=/workspace/mysteryboard-studio-release-check npm run check
npm run test:rc2

# Zusätzliche Studio-Interaktionen mit dem realen gebauten Renderer.
# Die Browserharnesses ersetzen hier nur native Dialog-/Dateibrücken;
# sie werden nicht als native Mac-Abnahme ausgegeben.
node qa/studio/browser.mjs
node qa/studio/usability.mjs
node qa/studio/graphics.mjs
node qa/studio/pdf-limits.mjs
node qa/studio/mac-exports.mjs
STUDIO_ENGINE=webkit WEBKIT_EXECUTABLE=/workspace/mysteryboard-browsers/webkit-2388/pw_run.sh WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1 XDG_CACHE_HOME=/workspace/mysteryboard-ocr-webkit-deps/cache GSETTINGS_BACKEND=memory node qa/studio/mac-exports.mjs
python3 qa/studio/check-pdfs.py /workspace/mysteryboard-studio-evidence
python3 qa/studio/check-pngs.py /workspace/mysteryboard-studio-evidence
python3 scripts/studio/package-review.py /workspace/mysteryboard-studio-delivery/MysteryBoard-Studio-Abnahmepaket.zip /workspace/mysteryboard-studio-evidence
```

Die WebKit-Sandbox-Ausnahme gilt ausschließlich für den externen Linux-
Browserharness in dieser Cloud. Die tatsächlich ausgelieferte Electron-App hat
ihre Sandbox aktiv. Die Linux-WebKit-Bibliotheksversionen sind im separaten
Paketbeleg dokumentiert. In einer anderen Prüfumgebung sind Browserpfade und
Evidenzverzeichnis entsprechend zu setzen.

Der native CI-Workflow `.github/workflows/studio-macos.yml` prüft die Runner-
Architektur, installiert gepinnte Abhängigkeiten, baut App/ZIP/DMG, verifiziert die
DMG, kopiert die App in einen Benutzerordner und prüft genau diesen installierten
Pfad. Die Befehle und Konsolenausgaben liegen im CI-Abschlussprotokoll.

PDFs werden unabhängig mit PyMuPDF auf alle Seiten, Seitenformate, Text,
Schriftobjekte, Vektorpfade, Bildplatzierungen und vollständige Kartenanzahlen
geprüft. Jede Seite wird gerendert. Text-PDF wird nicht allein anhand einer
Dateiendung behauptet. Jede Produkt-ZIP wird auf CRC geprüft und vollständig
entpackt; die extrahierten Bytes und SHA-256 werden kontrolliert. Das Mac-ZIP
enthält einen echten ARM64-Mach-O-Starter und die benötigten Framework-Symlinks.

Die Workflow-Simulationen A/B/C verwenden tatsächliche Eingaben, Dokumente,
Exporte und Wiederöffnung. Ihre Zeitwerte sind automatisierte Laufzeiten, keine
Vorbereitungszeit realer Lehrkräfte. Farbwählerwerte wurden zusätzlich über
Formular-input/change-Events gesetzt; der native OS-Farbdialog wurde nicht als
menschlich geprüft ausgegeben. Eine echte Lehrkräfte-Usabilitystudie bleibt offen.

## Noch vor dem realen Einsatz zu prüfen

1. Erststart und Gatekeeper-Zustimmung auf dem konkreten M1-Mac; gegebenenfalls
   organisatorische Freigabe für nicht Apple-notarisierte Software.
2. Reale Kamera-/Scanqualität, komplexe Legenden und Ausdruck mit dem tatsächlichen
   Drucker. OCR und automatische Bildzuordnung sind Vorschläge.
3. Echte itslearning-Installation beider Beispielpakete und eigener Aufgaben.
4. PNG-Dateiablage und Wiederherstellung auf den tatsächlich verwalteten Schul-
   iPads, native Safari-Druckausgabe und dortiger Speicherdruck.
5. WebKit 26.5 ist nicht vorhanden. Eine Linux-WebKit-27.2-Prüfung ist kein
   erfolgreicher Schul-iPad- oder echter Safari-Gerätetest.

Die fachlichen Boden-Karten und die eingefrorenen RC2-Dateien bleiben unverändert.
Kein automatisches Bewertungssystem, keine Musterlösung im Schülerpaket und
keine dauerhafte Speicherung oder LMS-Übertragung von Schüleraktivitäten.
