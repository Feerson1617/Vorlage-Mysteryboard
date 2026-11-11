# MysteryBoard – versionierter Release-Kandidat

11. November 2026, Europe/Berlin. Termin für die geplante Unterrichtserprobung: Freitag, 13. November 2026. Rohprotokolle verwenden UTC. Diese Bereitstellungsrunde verändert keine Anwendungsfunktionen und keine fachlichen Karten.

## Maßgeblicher Ausgangsstand

Repository `Feerson1617/Vorlage-Mysteryboard`, Entwicklungsbranch `feat/mysteryboard-prototype`. Vor Beginn zeigten lokaler HEAD und der tatsächliche Remote-Branch auf `545ece1fd723b953e4b36456d37bd6210a5ac916`. Remote-`main` stand auf `1fa1fff81e5e19b7031130c8d034a77d9e1ace61`.

Maßgeblich ist die vollständige korrigierte Lieferung `MysteryBoard-UNI-01-02.zip`, SHA-256 `4cf69f84687677cd6620a79d19e5d3d69748a0cb89614f3dfe116204fb3bbd91`. Alle **191 Dateien** ihres `source/`-Verzeichnisses wurden mit dem bestehenden Checkout abgeglichen: vollständig, byteidentisch, sämtliche Manifestprüfsummen gültig. Es gab keine abweichenden neueren Quellen, die überschrieben werden mussten. Die bereits uncommitteten Änderungen einschließlich bisher ungetrackter Inhalte, Tests und Dokumentationen gehören zu dieser geprüften Lieferung und werden gemeinsam versioniert.

Gegenüber dieser ZIP-Basis bleiben `src/`, die bestehenden Tests, Inhaltsdateien, Build-Registry und Abhängigkeiten unverändert. Hinzu kommen ausschließlich die manuelle Pages-Vorbereitung, das gezielte Work-Abnahmeskript, Veröffentlichungs-/Testanleitungen und Nachweise. Der Branch wird ohne Force-Push fortgesetzt. `main` wird weder beschrieben noch gemergt.

## Erhaltene Architektur

Ein gemeinsamer Anwendungskern bündelt jeweils eine JSON-Inhaltsdatei aus der Registry `mysteries.json`. Erhalten sind die 12-/60-Karten-Testvarianten, Boden Klasse 11 mit unveränderten 18 Karten/Inhaltsversion 2.0.0, das neutrale Fünf-Karten-Beispiel Z2/Z5 und der 220-Verbindungen-Prüfstand. Boden startet ohne vorgegebene Verbindungen, Farben oder fachliche Kategorien. V13–V18 stammen aus expliziten Inhaltsmetadaten. Lehrkraftmaterialien und Musterlösungen sind nicht in den Schüler-HTMLs enthalten.

R1b-Touchsteuerung, Pflicht-Teamzuordnung, Teamanzeige rechts, vollständiger PNG-Kopfbereich, Undo/Redo und PNG-/QR-Format sind erhalten. Alte teamlose Sicherungen bleiben importierbar; vor einem neuen Schülerexport wird eine gültige Teamangabe verlangt. Keine automatische Speicherung, Cloud-Datenhaltung oder Bewertung.

Neue Mysterys benötigen weiterhin nur eine gültige JSON-Datei und einen Build-Eintrag, keine erneute Programmierung des Kerns oder der Oberfläche. Anleitung: [Neues Mystery mit der Vorlage erstellen](NEUES-MYSTERY.md).

## Aktuelle Prüfungen

`npm run check` wurde vollständig mit Exitcode 0 abgeschlossen: **50/50 Datentests in sechs Dateien und 96/96 Chromium-Browsertests**, keine übersprungenen, instabilen oder fehlgeschlagenen Tests. Die Browserprüfung dauerte 471,6 Sekunden. Verwendet wurden Node.js 24.22.1, Playwright 1.65.0 und Chromium 156.0.8078.79. TypeScript, alle drei Produktions-Builds und beide zusätzlichen Test-Builds bestanden ebenfalls.

Die ursprünglichen Tests und Assertions sind gegenüber der UNI-01/02-Lieferung byteidentisch. Die Suite bestätigt unter anderem Teamzuordnung und Altimporte, Karten/V-Karten, Touch einschließlich R1b und 220 Verbindungen, Undo/Redo, PNG-Grenze und Wiederherstellung, Bildproportionen, Offline-Betrieb ohne zusätzliche Laufzeitanfragen sowie HTML-Größen unter 10.000.000 Bytes. Vollständiges Protokoll: [check.txt](test-evidence/release-candidate/check.txt); maschinenlesbare Ergebnisse mit allen 96 Testnamen und Artefaktprüfsummen: [results.json](test-evidence/release-candidate/results.json).

Die zusätzliche, schlanke Work-Prüfung besteht in Chromium 156.0.8078.79 für alle drei Produktions-HTMLs. Sie verwendet native Touch-Aktionen zum Öffnen, Schließen, erneuten Öffnen, Erstellen/Bearbeiten/Löschen einer Verbindung, markierte synthetische Nachklick-Fehlerinjektion und vollständige PNG-Zustandsvergleiche in einem frischen Browserkontext. Je Variante entstehen vier PNG-Artefakte. Laufdaten und HTML-/Skript-Prüfsummen werden aufgezeichnet; es gibt keinen stillen Wechsel der Browserengine.

Zwei ausdrücklich angeforderte WebKit-Läufe für 26.5 und 27.2 konnten den Browser nicht starten: `webkit-2388/pw_run.sh` fehlt. Es wurde keine Browserversion festgestellt und kein WebKit-Erfolg behauptet. Diese reale Kompatibilitätsabnahme bleibt offen. Ein erster Work-Skriptlauf hatte bei den technischen Testvarianten einen vollständig überlagerten Verbindungslabel-Treffpunkt gewählt; die Testgeometrie wurde auf eine sichtbare, bisher unverbundene Nachbarkarte korrigiert. Der Anwendungskern wurde dafür nicht geändert. Die Fehlernachweise bleiben getrennt erhalten.

Arbeitsverzeichnis ist das Repository. Tatsächlich verwendete Prüf-/Buildbefehle:

```sh
git ls-remote --heads origin
git fetch origin refs/heads/feat/mysteryboard-prototype:refs/remotes/origin/feat/mysteryboard-prototype refs/heads/main:refs/remotes/origin/main
set -o pipefail
npm run check 2>&1 | tee /workspace/mysteryboard-release-evidence/check.txt
node --check scripts/prepare-pages.mjs
node --check scripts/work-compatibility.mjs
node scripts/work-compatibility.mjs --engine chromium --executable /usr/bin/chromium --html-dir artifacts --output /workspace/mysteryboard-work-acceptance/chromium-final
node scripts/work-compatibility.mjs --engine webkit --expected-version 26.5 --html-dir artifacts --output /workspace/mysteryboard-work-acceptance/webkit-26.5
node scripts/work-compatibility.mjs --engine webkit --expected-version 27.2 --html-dir artifacts --output /workspace/mysteryboard-work-acceptance/webkit-27.2
git diff --check
```

Die vollständige Regression läuft vor der Versionssicherung. Anschließend werden die drei Produktionsdateien aus dem tatsächlich gesicherten Commit nochmals frisch gebaut und gegen die geprüften Artefaktprüfsummen verglichen. Pages-Paket und Work-Nachweise werden diesem vollständigen Commit-SHA zugeordnet. Die konkrete SHA, Git-Übertragungsbelege, Nach-Commit-Befehle und Hashes stehen im Release-Manifest und im Abschlussbericht der Lieferung; ein Dokument kann seinen eigenen Commit-Hash nicht ohne Selbstbezug enthalten.

## GitHub- und Veröffentlichungsgrenzen

Der Git-Transport zum bestehenden Repository ist erreichbar. Die Abfragen über `gh api` für Repository und Pages antworteten während der Vorbereitung mit `Forbidden`. Die öffentliche Repository-Seite war erreichbar, enthielt jedoch keinen verifizierbaren Pages-Link. Das beweist nicht, dass Pages deaktiviert ist; der tatsächliche Einstellungsstatus konnte über die API nicht festgestellt werden. Es wird keine Veröffentlichungsadresse konstruiert oder erfunden. Das spätere tatsächliche Push-/PR-Ergebnis wird gesondert protokolliert.

[PAGES.md](PAGES.md) beschreibt den vorbereiteten manuellen Workflow. Es gibt keinen Push-/PR-Deployment-Trigger. Standardmäßig ist `publish=false`; zur Veröffentlichung sind eine gesonderte Freigabe und zusätzliche Bestätigung nötig. Der Workflow steht in GitHub erst nach seiner freigegebenen Aufnahme auf den Default-Branch für den manuellen Start bereit. Das erzeugte `dist/pages/index.html` ist byteidentisch zur Boden-HTML. Es wurde keine Pages-Konfiguration aktiviert und keine öffentliche Website veröffentlicht.

Für Canva die unveränderte Einzel-HTML im tatsächlich vorgesehenen Veröffentlichungsweg prüfen. Akzeptiert Canva das Dokument oder seine JavaScript-/Dateifunktionen nicht zuverlässig, bleibt der vorbereitete statische HTTPS-Weg die Alternative. Keine ungeprüfte Canva-Kompatibilität behaupten.

## Work- und Unterrichtsabnahme

Das gesonderte kleine Work-Paket enthält drei aktuelle HTMLs, das gezielte Skript, Anleitung und Zuordnung zum aktuellen Commit einschließlich SHA-256. [WORK-KOMPATIBILITAET.md](WORK-KOMPATIBILITAET.md) erläutert die Auswahl passender installierter WebKit-Versionen. Ein Chromium-Erfolg ersetzt keinen Nachweis für 26.5 oder 27.2.

[UNTERRICHTSERPROBUNG.md](UNTERRICHTSERPROBUNG.md) enthält den konkreten Zehn-Schritte-Test auf einem verwalteten Schul-iPad einschließlich tatsächlicher PNG-Ablage in „Dateien“, vollständigem Verlassen, Wiederherstellung und Weiterarbeit; der Transfer auf ein zweites Schul-iPad ist zusätzlich vorgesehen. Ebenso sind der reale HTTPS-Schülerlink und gegebenenfalls Canva zu prüfen. Bis diese Abnahmen erfolgreich sind, besteht keine vollständige schulische Freigabe.

Die verwaltete Testumgebung blockiert `file://`; die fertigen HTMLs werden einmal über einen lokalen Testserver geladen und anschließend offline geprüft. Ein neues Öffnen einer HTTPS-Seite kann erneut eine Netzverbindung benötigen; kein Service Worker wird eingeführt. Die zuvor dokumentierte Bildvergrößerung vor medienreichen Mysterys bleibt ein gesonderter Auftrag. Mehrseitiger Druck, SCORM, Lehrkräfteeditor und weitere Funktionen sind nicht Bestandteil dieses Release-Kandidaten.
