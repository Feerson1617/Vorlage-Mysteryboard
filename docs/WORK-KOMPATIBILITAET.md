# Gezielte Work-Kompatibilitätsprüfung

Dieses kleine Paket prüft die drei fertigen Einzel-HTMLs mit demselben Ablauf in einer ausdrücklich ausgewählten Browserengine. Es baut und verändert die Anwendung nicht. Es ersetzt weder die vollständige Regressionstestsuite noch die Abnahme auf verwalteten Schul-iPads und in Canva.

## Benötigte Dateien

- `scripts/work-compatibility.mjs`
- Die drei HTMLs in einem gemeinsamen Verzeichnis: `MysteryBoard-klein.html`, `MysteryBoard-umfangreich.html`, `MysteryBoard-Boden-Klasse11.html`
- Node.js 24 oder neuer und ein installiertes Playwright-Paket samt passender Browserinstallation.
- Die mitgelieferte Liste mit vollständigem Quellcommit und SHA-256-Prüfsummen.

Im Quellpaket wird das vorhandene Playwright aus `node_modules` verwendet (`npm ci` installiert die gesperrten Paketversionen). Das Skript lädt keine Browser herunter. Ein anderes bereits installiertes Playwright wird ausdrücklich über `--playwright-module` gewählt. Für unterschiedliche WebKit-Versionen können getrennte bestehende Playwright-Installationen nötig sein; ein Browserpfad allein macht inkompatible Playwright-Protokolle nicht kompatibel.

## Aufruf

Aus dem Repository-Verzeichnis, zum Beispiel mit dem vorhandenen Chromium:

```sh
node scripts/work-compatibility.mjs \
  --engine chromium \
  --executable /usr/bin/chromium \
  --html-dir artifacts \
  --output /tmp/mysteryboard-work-chromium
```

WebKit 26.5 und 27.2 getrennt ausführen. Die folgenden Pfade sind ausdrücklich Platzhalter für die tatsächlich passenden, vorhandenen Installationen:

```sh
node scripts/work-compatibility.mjs \
  --engine webkit \
  --playwright-module /PFAD/ZUR/PASSENDEN/26.5/playwright/index.mjs \
  --expected-version 26.5 \
  --html-dir artifacts \
  --output /tmp/mysteryboard-work-webkit-26.5

node scripts/work-compatibility.mjs \
  --engine webkit \
  --playwright-module /PFAD/ZUR/PASSENDEN/27.2/playwright/index.mjs \
  --expected-version 27.2 \
  --html-dir artifacts \
  --output /tmp/mysteryboard-work-webkit-27.2
```

Optional `--executable /ABSOLUTER/BROWSERPFAD` verwenden, wenn zur ausgewählten Playwright-Version ein eigener passender Browserpfad gehört. Ohne dieses Argument verwendet Playwright ausschließlich seinen zur ausgewählten Engine gehörenden installierten Browser. Es gibt keinen Ersatz durch Chromium, keine Änderung einer Browserrichtlinie und keinen automatischen Download.

`--expected-version` vergleicht den tatsächlichen Wert von `browser.version()` exakt oder als Punkt-Präfix. Eine angeforderte Version `26.5` akzeptiert beispielsweise `26.5.1`, aber nicht `27.2`. Ein abweichender Wert, ein fehlender Browser oder ein inkompatibles Protokoll führt zum Fehlerstatus; dies ist kein erfolgreicher Kompatibilitätsnachweis. Die Bezeichnung eines Verzeichnisses oder einer Paketversion allein belegt die WebKit-Version nicht.

Den vollständigen Quellcommit aus dem Liefermanifest zusätzlich mit `--source-commit FULL_SHA` übergeben. Das Skript protokolliert ihn als mitgelieferte Herkunftsangabe und berechnet selbst die SHA-256-Prüfsummen der tatsächlich geöffneten HTML-Dateien. Der Build-Nachweis im Liefermanifest bleibt erforderlich; der Parameter allein beweist keinen Zusammenhang zwischen Commit und HTML.

Der lokale Testserver hört ausschließlich auf `127.0.0.1:5177`. Ein belegter Port ist ein Fehler; bei Bedarf einen freien Port mit `--port 5178` angeben. Der Server liefert nur die drei Prüfdokumente und wird nach Abschluss beendet. Die Ausgabe liegt ausschließlich unter `--output`; bestehende `playwright-report`- oder `test-results`-Verzeichnisse werden nicht verändert. Für jeden Lauf ein eigenes Ausgabeziel verwenden.

## Geprüfter Ablauf je HTML

1. Genau das lokale HTML laden, anschließend den Browserkontext offline schalten. Team angeben und starten; Ausgangs-PNG sichern.
2. Karte mit nativer Fingerbetätigung öffnen, bewusst schließen und erneut öffnen. Je einen verzögerten Pointer-/Mouse-Klick ohne neue Geste auf den erschienenen Schließen-Button injizieren: Der Dialog muss offen bleiben. Ein anschließender bewusster Fingertipp muss schließen.
3. Kartenfarbe und Kategorie ändern. Eine bisher nicht vorhandene Verbindung per Finger erstellen, beschriften, bearbeiten und ihre Richtung ändern.
4. Verzögerte Pointer-/Mouse-Klicks auf „Verbindung löschen“ dürfen nichts löschen. Ein bewusster Fingertipp muss löschen; Rückgängig stellt die bearbeitete Verbindung wieder her.
5. PNG herunterladen. PNG-Chunk-Prüfsummen und den SHA-256 des eingebetteten Arbeitsstands unabhängig prüfen. Den vollständigen Zustand mit der erwarteten Änderung des Ausgangszustands vergleichen.
6. Den ursprünglichen Browserkontext vollständig schließen. In einem neuen Kontext das HTML laden, offline gehen und die Original-PNG importieren. Kartenpositionen, Team und Anzahlen sichtbar prüfen; erneut sichern und den gesamten Zustand vergleichen: Schema, Mystery-ID/-Version, alle Karten mit Position/Farbe, alle Kategorien, alle Verbindungen mit Richtung/Text und vollständiger Teamname.
7. Im wiederhergestellten Stand eine Kartenfarbe und Verbindung ändern und erneut sichern; den vollständigen Folgezustand vergleichen. Zusätzliche HTTP(S)-Anfragen, Laufzeitfehler und Nutzung von localStorage/sessionStorage führen zum Fehler.

Die reguläre Bedienung verwendet ausschließlich `Locator.tap()` beziehungsweise `touchscreen.tap()` der ausgewählten Engine. Eingaben erfolgen über `fill()` und `selectOption()`, der Import über den echten Dateiauswahldialog. Kein CDP, kein erzwungener Klick und kein Tastaturersatz für Fingerbetätigungen. Die zwei Nachklick-Varianten sind bewusst synthetische, nicht vertrauenswürdige DOM-Ereignisse zur Fehlerinjektion; sie werden nicht als native Browserereignisse ausgegeben. Eine Verzögerung von 450 ms dient ausschließlich dieser Fehlerinjektion.

Pinch-Zoom, Pan, sämtliche alten Reproduktionsdateien und der 220-Verbindungen-Belastungstest gehören weiterhin zur vollständigen Regression beziehungsweise zur echten Geräteprüfung; dieser gezielte Ablauf ersetzt sie nicht.

## Nachweise und Bewertung

`result.json` enthält Status, tatsächliche Browserversion, Engineauswahl, Herkunftsangabe, Skript-/HTML-Prüfsummen, Schritte, letzte Fehlerphase, unerwartete Netzwerkanfragen und konkrete Fehlermeldungen. Je Variante entstehen vier Original-PNGs mit ausgelesenem vollständigem Zustand als JSON sowie Screenshots vor und nach der Wiederherstellung.

Exitcode 0 bedeutet, dass alle drei Varianten in genau dieser protokollierten Engine bestanden haben. Exitcode 1 bedeutet Fehler oder fehlenden Nachweis. Ein Chromium-Erfolg belegt keine WebKit-Kompatibilität. Eine erfolgreiche WebKit-Emulation belegt keine schulische Freigabe.

Für die unabhängige Abnahme alle drei Engineberichte mit dem Liefermanifest abgleichen. Fehlende WebKit-Versionen ausdrücklich als **nicht geprüft/offen** dokumentieren. Der entscheidende Praxistest bleibt: Safari auf dem verwalteten Schul-iPad, PNG tatsächlich in „Dateien“ ablegen, Anwendung vollständig verlassen, erneut öffnen, Original-PNG importieren und weiterarbeiten; zusätzlich nach Möglichkeit auf einem zweiten Schul-iPad wiederherstellen.

Vorabprüfung in der Cloud-Umgebung am 11. November 2026: alle drei Varianten bestanden mit Chromium `156.0.8078.79`. WebKit **26.5 und 27.2 bleiben offen**: beide Startversuche endeten mit Exitcode 1, weil `/home/agent/.cache/ms-playwright/webkit-2388/pw_run.sh` nicht installiert ist; eine reale WebKit-Version konnte nicht ermittelt werden. Es wurde kein Browser nachinstalliert. Die nach dem Commit ausgeführten Nachweise und die endgültige Artefaktzuordnung stehen im Lieferbericht.
