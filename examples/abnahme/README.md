# Zusammengehörige neutrale Abnahmebeispiele

Alle Dateien gehören zur Mystery-ID `beispiel-abnahme-2026`. Die erste Version `1.0.0` enthält zwölf Karten, neun Pflicht- und drei Vertiefungskarten, drei eingebettete Bilder, eine strukturierte Tabelle und zwei Hilfestufen. Die Karten und Grafiken sind technische Beispiele, keine fachlich geprüften Unterrichtsmaterialien.

- `MysteryBoard-Beispiel-Schuelerversion.mysteryboard`: neutrale Aufgabe.
- `MysteryBoard-Beispiel-Lehrkraftentwurf.mysteryboard`: gleicher Inhalt als bearbeitbarer Entwurf mit Kürzel AB.
- `MysteryBoard-Beispiel-Schuelerarbeitsstand.png`: eigenständige Original-PNG mit Team, veränderter Position, zwei beschrifteten Verbindungen, Farben und Kategorien.
- `MysteryBoard-Beispiel-Schuelerstand.mysteryboard`: derselbe Arbeitsstand zusätzlich als Projektdatei; als Ausgangspunkt zur erneuten PNG-Erzeugung.
- `MysteryBoard-Beispiel-Ueberarbeitet.mysteryboard`: Version `1.0.2`: Karte 13 hinzugefügt, Text von Karte 3 geändert, Grafik von Karte 1 ersetzt und frühere Karte 6 gelöscht; die übrigen Karten und Hilfereferenzen wurden konsistent neu nummeriert.

Die erste und die überarbeitete Version sind eigenständige Dokumente. Die alte Schüler-PNG trägt ihren ursprünglichen Inhalt vollständig selbst und darf nicht mit der neuen Fassung vermischt werden. Die Dateien wurden mit dem gemeinsamen Validator erzeugt; die PNG wurde anschließend in der tatsächlichen Anwendung exportiert und in frischen HTML- und SCORM-Sitzungen wiederhergestellt.

Reproduzieren aus dem Projektordner nach `npm ci` und Installation eines Chromium-Browsers:

```sh
node scripts/create-acceptance-examples.mjs
npx playwright test tests/browser/acceptance-delivery.spec.ts
```

Der Browsertest erzeugt eine weitere PNG im temporären Testergebnisordner und prüft sie sowie die mitgelieferte Original-PNG gegen die vollständige Projektdatei. Die Beispieldatei wird dabei nicht überschrieben.
