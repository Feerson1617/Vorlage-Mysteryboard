# Neues Mystery mit der Vorlage erstellen

Neue Aufgaben benötigen keine erneute Programmierung. Der bevorzugte Weg ist eine portable Inhaltsdatei für die universelle HTML bzw. das einmal installierte universelle SCORM-Paket.

## Ohne Programmierung

**Eigenes Mystery erstellen** öffnen, Lehrkraftkürzel eingeben, Titel und Karten bearbeiten. Karten wählen ihre Pflicht-/Vertiefungsgruppe ausdrücklich; Nummern werden automatisch vergeben. Bilder, Quellen, Alternativtexte und strukturierte Tabellen bleiben bearbeitbar. **Entwurf sichern** für die eigene Weiterarbeit, **Schülerversion erstellen** für den Kurs. Vollständige Anleitung: [LEHRKRAEFTE-ANLEITUNG](../LEHRKRAEFTE-ANLEITUNG.md).

Eine bereits veröffentlichte Datei erneut öffnen und **Lehrkräftemodus – Mystery bearbeiten** wählen. Änderungen erhalten eine neue Inhaltsrevision; ältere Schüler-PNGs behalten ihren eigenen Inhalt. Das installierte SCORM wird nicht automatisch geändert.

## Mit einer KI oder JSON-Datei

Die andere KI erhält diesen vollständigen Projektordner und [AI-ANLEITUNG.md](../AI-ANLEITUNG.md). Ein vorhandenes Foto/PDF/Word-Dokument muss zunächst sorgfältig in strukturierte Karten übertragen werden. Unlesbare Angaben nicht erfinden. Vollständiges Beispiel: `examples/universal/content.json`.

Pflichtfelder: `id`, `version`, `title`, `cards`, `cardGroups`. Karten: `id`, `title`, `text`, `group`. IDs fortlaufend ab 1; `group` verweist auf Metadaten, z. B. `required` mit leerem Präfix und `extension` mit `V`. Keine fest codierte Pflichtkartenanzahl. PNG/JPEG/WebP als eingebettete Daten-URIs; Quelle und Alternativtext optional. Titel, alle Karten, Tabellen und Hilfen bleiben Daten und damit editierbar. Schema und Grenzen: [UNIVERSAL-FORMAT](UNIVERSAL-FORMAT.md).

Ohne besondere Vorgabe `startLayout: {"mode":"ordered"}` verwenden. Optional legt `columns` die Spaltenzahl fest. Für eine ausdrückliche andere Anordnung `mode: "explicit"` und einen vollständigen neutralen `initial`-Zustand angeben. Keine vorgefertigten Pfeile, Schülernamen oder eigenen Farben in Aufgaben exportieren. Eine wiederhergestellte Arbeit behält immer ihre gespeicherten Positionen.

```sh
npm ci
npx playwright install chromium
npm run validate:mystery -- src/content/mein-mystery.json
npm run create:mystery -- src/content/mein-mystery.json ausgabe/Meine-Aufgabe.mysteryboard
npm run validate:mystery -- ausgabe/Meine-Aufgabe.mysteryboard
```

Die fertige Datei wird separat im Kurs bereitgestellt und in der universellen Anwendung importiert. Die CLI berechnet Normalisierung und Prüfsumme selbst. Bestehende Ausgaben werden nicht überschrieben; bei einer Revision einen neuen Dateinamen wählen.

## Bei Bedarf eine spezielle Schüler-HTML erzeugen

```sh
npm run build:mystery -- ausgabe/Meine-Aufgabe.mysteryboard ausgabe/MysteryBoard-Meine-Aufgabe.html ausgabe/MysteryBoard-Meine-Aufgabe-SCORM.zip
```

Die ZIP ist optional. Beide Varianten verwenden denselben universellen Kern und denselben Lehrkräftemodus. Die fertige HTML muss unter 10.000.000 Bytes bleiben; Zielwert unter 6 MB. Ein großer portabler Bildbestand kann diese HTML-Grenze überschreiten: dann bei der universellen Anwendung plus Inhaltsdatei bleiben. Ein Build veröffentlicht nichts.

Die frühere Registry `mysteries.json` bleibt für bestehende feste Inhalte und Regressionen erhalten. `npm run build -- small`, `large`, `ordered-5` usw. bauen diese Varianten. Die Boden-Variante hat `previewOnly: true` und schreibt ausschließlich in `artifacts/previews/`; niemals RC2-Dateien ersetzen. Für neue **vollständig portable** spezifische Aufgaben den oben genannten `build:mystery`-Weg verwenden.

## Vor dem Unterricht prüfen

1. Karten, Quellen, Medien, Gruppen und Hilfen fachlich mit dem Original vergleichen. Keine Musterlösungen oder vertraulichen Notizen mitliefern.
2. In der tatsächlichen HTML/SCORM importieren, alle Karten lesen und Medienlegenden mit Vergrößerung prüfen. Hoch-/Querformat und kleinere Einbettung kontrollieren.
3. Mit eigenem Team beginnen; Touch-Ziehen, Pinch/Pan, Verbindungen, Beschriftungen, Farben, Hilfe und Undo/Redo prüfen.
4. A4/A3-Druckfassung kontrollieren und tatsächlich als PDF speichern. Die PDF ist kein Sicherungsformat.
5. Original-PNG herunterladen und bewusst außerhalb des Browsers ablegen. Anwendung vollständig schließen; PNG in einer frischen universellen Anwendung öffnen. Inhalt, Team, Positionen, Farben und alle Beziehungen vergleichen und weiterarbeiten.
6. Datei im Lehrkräftemodus erneut bearbeiten und eine neue Version erzeugen. Alte Schüler-PNG zusätzlich öffnen und prüfen, dass ihre ursprünglichen Inhalte erhalten bleiben.
7. itslearning-Dateiauswahl, Download/Teilen, Touch und Safari-Druck auf dem tatsächlich verwalteten Schul-iPad prüfen. Canva bei geplanter Nutzung separat testen. Die lokalen automatisierten Tests sind keine schulische Freigabe.

Vollständige Entwicklerregression: `CLASSROOM_SCORM=1 npm run check`, anschließend `npm run package:universal` und `npm run test:rc2`. Abhängigkeiten und Nachweisgrenzen: [README](../README.md), [Abnahmebericht](UNIVERSAL-ABNAHME.md).


Die grafische Hilfe-Bearbeitung verwendet weiterhin exakt `help.method` und `help.categories`. Es gibt keine zusätzliche Speicherformatversion. Fünf Denkimpulse, zwei Gruppenvorlagen, eigene Gruppen und eine Kontrastpalette dienen nur der Redaktion. Vorlagen ordnen **keine** Karten automatisch zu. Leere, unfertige Gruppen bleiben bis zur Prüfung lokal im Formular; übernommen werden nur gültige Gruppen mit mindestens einer Karte. Beim Export wird genau die gewählte Gruppierung gespeichert, nicht der lokale Verlauf der Vorlagenwechsel. Vorhandene Hilfemetadaten werden vollständig übernommen. Tatsächliche Inhaltsänderungen erhöhen die bestehende Patch-Version; bloßes Öffnen und unverändertes Übernehmen erhöht sie nicht. Die Schüler-Vorschau verwendet dieselbe `App`, `LearningHelp` und `Board` wie die universelle Anwendung. Details und Nachweise: [Abnahme Hilfen](HELP-EDITOR-ABNAHME.md).
