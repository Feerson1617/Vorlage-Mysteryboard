# Unabhängige Prüfung der universellen Anwendung

Das kompakte Abnahmepaket enthält HTML, unveränderte SCORM-ZIP, vier zusammengehörige Beispieldateien, Prüfberichte und Prüfsummen. Der Quellcode und automatisierte Tests liegen im separaten Projektpaket. Die Beispieldateien sind neutral und keine fachliche Musterlösung. Prüfen Sie zuerst `SHA256SUMS.txt` mit `sha256sum -c SHA256SUMS.txt` oder auf macOS `shasum -a 256 -c SHA256SUMS.txt`.

## Start

Entpacken Sie das Prüf-ZIP vollständig. Öffnen Sie die HTML in einem vollständigen Browser. Falls lokale HTML-Dateien durch den Browser oder eine Geräteverwaltung blockiert werden, starten Sie im entpackten Ordner einen lokalen Server, beispielsweise `python3 -m http.server 8765`, und öffnen Sie `http://localhost:8765/MysteryBoard-Universal.html`. Danach kann das Netzwerk im Browser getrennt werden. Der Server ist nur ein lokaler Test; er veröffentlicht nichts im Internet.

## A: Redaktion und Tabelle

Öffnen Sie den Lehrkraftentwurf über **Mystery bearbeiten → Mystery-Datei auswählen**. Prüfen Sie alle zwölf Karten und öffnen Sie Karte 4: Die Tabelle hat die Spalten „Zeit“ und „Messwert“ und die Zeilen „Tag 1 / 12“ und „Tag 2 / 17“. Bearbeiten Sie eine Zelle, ersetzen Sie ein Bild und speichern Sie mit **Entwurf sichern** eine neue Datei. Schließen Sie die Anwendung und öffnen Sie den heruntergeladenen Entwurf erneut. Auf dem Startbildschirm lässt sich außerdem ein eigenes Mystery mit dem Plus-Button erstellen.

## B: Veröffentlichte Aufgabe überarbeiten

Öffnen Sie die Schülerversion und wählen Sie **Lehrkräftemodus – Mystery bearbeiten**. Ergänzen und löschen Sie Karten, ändern Sie Text und ersetzen Sie ein Diagramm. Exportieren Sie über **Mystery für Schülerinnen und Schüler bereitstellen → Neue Schülerversion exportieren**. Diese Datei muss eine höhere Inhaltsversion haben. Die bereits mitgelieferte überarbeitete Datei zeigt beispielhaft die Änderungen von Version 1.0.0 zu 1.0.2. Öffnen Sie anschließend die alte Schüler-PNG: Sie muss die ursprüngliche Fassung samt ihrem eigenen Stand enthalten.

## C und D: Schülerarbeit und Wiederherstellung

Laden Sie die Schülerversion, geben Sie einen eigenen Teamnamen ein, lesen/verschieben Sie Karten, zoomen Sie mit zwei Fingern, beschriften Sie Verbindungen und verwenden Sie Farben, Kategorien und beide Hilfestufen. Erstellen Sie eine Druckvorschau und sichern Sie die Original-PNG bewusst außerhalb des Browsers. Schließen Sie die Anwendung vollständig; importieren Sie die unveränderte Original-PNG in einer neuen Sitzung. Vergleichen Sie Titel, Karten, Tabelle, Medien, Team, Positionen, Farben, Kategorien und Beziehungen; arbeiten Sie weiter.

Die mitgelieferte Schüler-PNG enthält Team „Gruppe Abnahme“, eine verschobene Karte, zwei beschriftete Verbindungen und eigene Kategorien. Sie kann direkt zum Wiederherstellungstest genutzt werden. Ein Screenshot oder eine nachbearbeitete PNG ist keine Originaldatei.

## E: Tatsächliche SCORM-Datei

Entpacken Sie die SCORM-ZIP in einen eigenen Unterordner und öffnen Sie `launch.html` über den lokalen Server. Der enthaltene `app.html` ist bytegleich zur Einzel-HTML. Wiederholen Sie Import, Bearbeitung, PNG-Export und frische Wiederherstellung. Die Anwendung funktioniert ohne LMS-API; für eine API-Simulation kann ein Elternfenster die SCORM-1.2-Methoden `LMSInitialize` und `LMSFinish` bereitstellen und alle API-Aufrufe protokollieren. Der im Projekt enthaltene Test `tests/browser/acceptance-delivery.spec.ts` extrahiert die tatsächliche ZIP, setzt ein solches Mock und prüft, dass keine Schülerdaten übertragen werden.

## F: Sicherheit und Grenzen

Probieren Sie ungültiges JSON, ein beschädigtes Bild, geänderte Prüfsummen und eine Datei mit fremder Inhaltsversion. Ein fehlgeschlagener Import muss den geöffneten Stand erhalten. Alte MBS1/MBS2-Sicherungen benötigen ihre ursprüngliche Mystery-HTML; die Blanko-Vorlage weist darauf hin. MBX3 enthält den vollständigen Inhalt. Beobachten Sie Netzwerkrequests nach dem Laden: Es dürfen keine externen Laufzeitressourcen angefragt werden. HTML-/Script-Zeichen in Kartentexten müssen Text bleiben.

Chromium-Emulation und ein lokales API-Mock sind kein Nachweis auf verwalteten Schul-iPads oder im echten itslearning. Safari, WebKit 26.5/27.2, tatsächliche Downloads im LMS und nativer Safari-Druck erfordern gesonderte Prüfung. Ein Lehrkräftemodus ist kein geschützter Zugang. Die Anwendung speichert nicht automatisch.
