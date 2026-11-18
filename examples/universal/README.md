# Vollständige Beispiele

Alle Karten und einfachen Prüfgrafiken in diesem Ordner wurden für technische Tests neu erstellt. Sie sind kein fachlich geprüftes Unterrichts-Mystery und enthalten keine Musterlösung. Die eigenen PNG/JPEG/WebP-Prüfgrafiken stehen zur freien Weiterverwendung unter CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/); dieser Lizenzhinweis ist Dokumentation, keine Laufzeitabhängigkeit. Das gedrehte JPEG unter `tests/fixtures/oriented-diagram.jpg` ist eine Ableitung derselben eigenen Grafik.

## Ein zusammengehöriger Unterrichtskreislauf

- `unterricht-entwurf.mysteryboard`: tatsächlich im grafischen Editor erzeugt; Kürzel AB, zwölf Karten, neun Pflichtkarten, drei Vertiefungen, drei Bilder.
- `unterricht-aufgabe.mysteryboard`: aus diesem nach dem Schließen erneut geöffneten Entwurf exportierte neutrale Aufgabe.
- `unterricht-schueler.png`: daraus erzeugte Schülerarbeit mit Team „Gruppe Neu“, veränderter Position, Farbe/Kategorie und zwei beschrifteten Beziehungen. In einem frischen Browserkontext der universellen SCORM-Anwendung vollständig wiederhergestellt und weiterbearbeitet.

Diese drei Dateien haben dieselbe Mystery-ID und Inhaltsfassung. Zum Testen genügt jeweils die betreffende Originaldatei; die Schüler-PNG braucht die Aufgabe nicht zusätzlich.

## Beispiel für den KI-/JSON-Weg und seine spätere Revision

`content.json` ist ein strukturiertes neutrales Beispiel mit zwölf Karten und drei eingebetteten Formaten; `ki-beispiel.mysteryboard` wurde daraus mit der CLI erzeugt. „KI-Beispiel“ bezeichnet den beispielhaften strukturierten Übergabeweg; es wurde keine externe KI oder bezahlte API benötigt. Die Quelldateien `diagramm-1.png`, `diagramm-2.jpeg`, `diagramm-3.webp` ermöglichen einen nachvollziehbaren Medienvergleich; im transportierten Dokument sind sie bereits eingebettet.

Der zusätzliche tatsächliche UI-/SCORM-Ablauf erzeugte:

- `ki-erste-schuelerversion.mysteryboard` und `ki-alte-schuelerarbeit.png`;
- `ki-ueberarbeiteter-entwurf.mysteryboard` nach Titeländerung, neuer Pflichtkarte, geändertem Text, ersetztem Diagramm und bestätigter Löschung einer anderen Karte;
- `ki-neue-schuelerversion.mysteryboard` und `ki-neue-schuelerarbeit.png`.

Die alten und neuen Schülerdateien wurden nacheinander frisch geöffnet und vollständig mit ihren jeweiligen Inhalten verglichen. Keine Inhalte wurden zwischen Versionen gemischt. Die ausführlichen Zwischenstände, PDFs und Screenshots liegen in den Abnahmeunterlagen.

## Erneut erzeugen

```sh
npm run validate:mystery -- examples/universal/content.json
npm run create:mystery -- examples/universal/content.json ausgabe/Mein-Beispiel.mysteryboard
npm run build:mystery -- ausgabe/Mein-Beispiel.mysteryboard ausgabe/MysteryBoard-Beispiel.html ausgabe/MysteryBoard-Beispiel-SCORM.zip
```

Vorhandene Ausgaben werden nicht überschrieben. Die neue HTML und das neue SCORM bieten weiterhin den Lehrkräftemodus.
