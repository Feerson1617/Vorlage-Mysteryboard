# MysteryBoard – Anleitung für eine andere KI

## Auftrag und gemeinsame Architektur

MysteryBoard ist eine deutschsprachige, offlinefähige Arbeitsfläche für Mystery-Karten und Beziehungen, mit Lehrkräfteeditor, PNG-Sicherung, Hilfe und Druck. Dieses Projekt ist **eine universelle Vorlage**. Ein neues Thema benötigt eine Inhaltsdatei, keine neue Benutzeroberfläche, keinen eigenen Anwendungskern und normalerweise kein neues SCORM-Paket.

Die universelle HTML und das universelle SCORM-1.2-Paket öffnen denselben Dokumenttyp. Grafischer Editor, KI-Weg und optionaler spezieller HTML-Build verwenden `src/core/documents.ts`, dieselben Schemata und dieselbe Inhaltsdarstellung. Alle künftig über den hier beschriebenen Build-Weg erzeugten Aufgaben bleiben mit **Lehrkräftemodus – Mystery bearbeiten** editierbar. Das abgeschlossene Boden-RC2 ist davon ausgenommen und bleibt byteidentisch.

## Zuerst das Material klären

Bei „in MysteryBoard übernehmen“ handelt es sich um Materialübertragung. Übernehmen Sie Kartentexte, Überschriften, Aufgaben und Quellen originalgetreu. Ordnen Sie Text, Bild und Quelle jeweils der richtigen Karte zu. Kennzeichnen Sie in einem separaten Übergabeprotokoll:

- übernommene Originalinformationen;
- notwendige technische Anpassungen, etwa fortlaufende IDs, Bildskalierung oder Zeilenumbrüche;
- fachliche Überarbeitungen nur bei ausdrücklicher Beauftragung.

Fotos/Scans sind keine bereits strukturierten Mysterys. Erfassen Sie ihren Text sorgfältig, vergleichen Sie jede Karte mit dem Original und fragen Sie bei unlesbaren Stellen nach. Keine Zahlen, Einheiten, Quellen oder fachlichen Behauptungen ergänzen, die nicht lesbar belegt sind. Platzhalter und offene Fragen gehören in den Entwurf bzw. das Übergabeprotokoll, nicht unbemerkt in eine fertige Schüleraufgabe. Nutzen Sie nur rechtmäßig verwendbare Medien und dokumentieren Sie Quellen/Lizenzen. Dieser Projektordner enthält keinen kostenpflichtigen KI-Dienst und benötigt keinen bestimmten Anbieter oder API-Schlüssel.

## Dateien und benötigte Werkzeuge

Für eine neue Aufgabe genügt zunächst eine UTF-8-JSON-Inhaltsdatei, z. B. `src/content/mein-mystery.json`. Bilder werden als Daten-URIs eingebettet. Vollständiges Beispiel: `examples/universal/content.json` mit zwölf Karten, neun Pflichtkarten, drei Vertiefungen und PNG/JPEG/WebP. Das ist ein neutrales technisches Beispiel, keine fachliche Musterlösung.

Die grafische Nutzung braucht nur einen Browser. Für Validierung/Build im Projektordner werden Node.js 24, npm und ein Chromium-Browser benötigt:

```sh
npm ci
npx playwright install chromium
npm run validate:mystery -- examples/universal/content.json
```

Die Skripte nutzen einen vorhandenen System-Chromium, sonst den von Playwright installierten Browser. `CHROMIUM_PATH` kann einen eigenen Pfad angeben. Es gibt keinen zwingenden Cloud-Pfad. Für alle Browser-/Drucktests zusätzlich Python 3, `lxml` und Poppler (`pdfinfo`, `pdftotext`, optional `pdftoppm`) installieren. Die Browserinstallation braucht unter Linux passende Systembibliotheken. Weitere Angaben stehen in README und Abnahmebericht.

## Inhaltsdaten erstellen

Verbindliche Struktur: `schemas/mystery-content.schema.json`. Pflichtfelder sind `id`, `version`, `title`, `cards`, `cardGroups`. Jede Karte braucht `id`, `title`, `text`, `group`. Ein kleines vollständiges Beispiel:

```json
{
  "id": "meine-schule-mystery-2026-01",
  "version": "1.0.0",
  "title": "Titel der geprüften Aufgabe",
  "subtitle": "Optionaler Untertitel",
  "cardGroups": {
    "required": { "label": "Pflichtkarte", "prefix": "" },
    "extension": { "label": "Vertiefungskarte", "prefix": "V" }
  },
  "cards": [
    { "id": 1, "title": "Beobachtung", "text": "Originalgetreuer Kartentext.", "group": "required" },
    { "id": 2, "title": "Zusatzinformation", "text": "Originalgetreuer Vertiefungstext.", "group": "extension" }
  ],
  "startLayout": { "mode": "ordered" },
  "help": { "method": "Welche Angaben könnten zusammenhängen? Begründet eure Vermutung." }
}
```

`id` ist eine dauerhaft eindeutige Kennung für dieses Mystery (bis 100 ASCII-Buchstaben/Ziffern/Punkt/Unterstrich/Bindestrich, erster Wert alphanumerisch). Verwenden Sie beispielsweise einen eigenen UUID-basierten Schlüssel. Nicht die Beispiel-ID für neue Themen kopieren. `version` besteht aus drei nicht negativen Zahlen ohne führende Nullen, je höchstens sechs Stellen: `1.0.0`.

Es sind 1–100 Karten vorgesehen, IDs **lückenlos von 1 bis n**, jede genau einmal. Bei Roh-JSON erstellt die KI diese IDs; im Editor vergibt die Anwendung sie automatisch. `group` verweist auf einen tatsächlichen Schlüssel aus `cardGroups`. Die Zuordnung erfolgt ausschließlich durch diese Metadaten: Karte 2 darf Vertiefung, Karte 3 wieder Pflicht sein. Ein Präfix `V` zeigt `V2`, ein anderes kurzes Präfix ist ebenfalls zulässig. Keine feste Pflichtkartenanzahl im Programm einbauen.

Titel und Kartentitel sind auf 100 Zeichen begrenzt, Untertitel auf 300, Kartentext auf 4000. Kartentitel/-text dürfen technisch leer sein; eine fachlich vollständige Lieferung sollte das bewusst prüfen. Zeilenumbrüche sind Text, kein HTML. Weitere Grenzen: [UNIVERSAL-FORMAT](docs/UNIVERSAL-FORMAT.md).

Standard ist eine numerische Startablage. Lassen Sie `initial` weg und setzen Sie vorzugsweise `startLayout.mode` auf `ordered`; optional `columns: 6`. Ein ausdrücklich gewünschtes anderes Layout verwendet `mode: "explicit"` und vollständige neutrale `initial.cards` mit `id`, `x`, `y`, `color: 0`. Dazu `edges: []` und `categories: ["", "", "", "", "", ""]`. Keine vorgelösten Pfeile, Farben oder Schülernamen. Ein bereits gespeicherter Schülerstand wird niemals auf dieses Startlayout zurückgesetzt.

## Bilder und strukturierte Tabellen

Unterstützt werden statische PNG/JPEG/WebP. Beispiel: `"image": "data:image/png;base64,..."`, optional `imageAlt` (300 Zeichen) und `source` (1000 Zeichen). Erzeugen Sie Base64 aus den tatsächlichen Dateibytes, nicht aus einem Dateipfad oder einer Internetadresse. `imageAlt` ohne Bild wird zurückgewiesen. Kein SVG, PDF, HTML, JavaScript oder URL in einem Medienfeld.

Grenzen: 3.000.000 Bytes, maximal 4096 Pixel je Kante und 4 Millionen Bildpunkte je Bild; zusammen maximal 12.000.000 Bytes und 24 Millionen Bildpunkte. Größere Fotos vorher lokal verkleinern und fachliche Lesbarkeit prüfen. Das Seitenverhältnis darf sich nicht ändern. PDFs ggf. lokal rendern und die gewünschte Seite als statisches Bild übernehmen; Textkarten nicht unnötig zu Bildern machen. Das Original und seine Quellen getrennt aufbewahren.

Eine echte Tabelle bleibt als Datenstruktur editierbar:

```json
"table": {
  "caption": "Messwerte",
  "headers": ["Zeit", "Temperatur in °C"],
  "rows": [["08:00", "12"], ["12:00", "17"]]
}
```

Maximal sechs Spalten, zwanzig Zeilen; jeder Zeile genau ein Textwert je Spalte, höchstens 120 Zeichen je Zelle. Spaltenüberschriften höchstens 80, Tabellenüberschrift 200 Zeichen. In der Lesefassung wird eine Tabelle, im mehrseitigen Druck werden vollständig beschriftete Datenzeilen dargestellt. Werte eines bloßen Fotos sind nicht direkt editierbar. Grafiken können im Editor ersetzt werden; eine Vektor-/Diagramm-Quelldatenbearbeitung wird nicht vorgetäuscht.

## Hilfestufen konfigurieren

`help` ist optional. `method` enthält einen methodischen Denkimpuls bis 500 Zeichen. Fehlt er, gilt die allgemeine Hilfe. Die zweite Stufe erscheint ausschließlich bei gültigen, fachlich verantworteten Kategorien:

```json
"help": {
  "method": "Welche Beobachtungen stützen eure Erklärung?",
  "categories": [
    { "id": "beobachtung", "label": "Beobachtungen", "color": "#2166ac", "cardIds": [1] }
  ]
}
```

Höchstens sechs Kategorien; IDs, Bezeichnungen und Farben müssen eindeutig sein, alle Kartenreferenzen existieren, jede Karte höchstens einer Kategorie zugeordnet. Nicht jede Karte braucht eine Zuordnung. Keine Kategorien aus Kartennummern automatisch ableiten und keine Musterlösung erfinden. Die sichtbare Nummernorientierung ist flüchtig, verändert weder Kartenfarben noch gespeicherte Schülerarbeit. Der Editor bewahrt vorhandene Kategorien beim Bearbeiten; beim Löschen werden Referenzen gemeinsam neu nummeriert. Die Gruppen sind im Lehrkräfteeditor über **Hilfetext festlegen** grafisch bearbeitbar.

## Validieren und transportierbare Aufgabe erzeugen

```sh
npm run validate:mystery -- src/content/mein-mystery.json
npm run create:mystery -- src/content/mein-mystery.json ausgabe/Meine-Aufgabe.mysteryboard
npm run validate:mystery -- ausgabe/Meine-Aufgabe.mysteryboard
```

Diese Befehle prüfen dieselben gebündelten JSON-Schemata wie der Browser, zusätzliche Beziehungen/Mediengrenzen und tatsächliches Decodieren der Bilder in einem offline geschalteten Chromium. Ein allgemeiner JSON-Schema-Prüfer allein reicht nicht für Querverweise, Bildpixel, Prüfsummen und neutrale Zustandsdaten. Die `https://mysteryboard.invalid/...`-Kennungen sind lokal registrierte Schema-IDs, keine nachzuladenden Internetressourcen.

Die CLI normalisiert Inhalt/Startzustand und berechnet `contentHash`. **Keine Prüfsumme erfinden oder manuell unverändert weiterverwenden.** Bei einem Fehler endet die CLI mit Fehlerstatus; korrigieren und erneut prüfen. Bestehende Ausgabedateien werden nicht überschrieben. Für eine Revision einen neuen Dateinamen wählen.

Das erzeugte Dokument ist `format: "MysteryBoard"`, `formatVersion: 3`, `kind: "task"`. Ein `draft` enthält zusätzlich Kürzel/Bearbeitungsstatus/unveröffentlichte Karten. Ein `student` enthält eigenen Teamnamen und vollständigen Arbeitsstand. Alle drei enthalten die vollständigen Karten/Medien. Die Aufgabe enthält keine internen Autorenfelder und keine Schülerlösung. Verwenden Sie zum Aufgabenerstellen die CLI oder den Editor, nicht eine selbst erfundene zweite Serialisierung.

## Im universellen SCORM verwenden und weiter bearbeiten

Die Lehrkraft installiert die universelle SCORM-ZIP einmal, verteilt die `.mysteryboard`-Aufgabe separat und lässt sie über **Mystery bearbeiten / Fortsetzen → Mystery-Datei auswählen** öffnen. Schüler geben ihren eigenen Teamnamen an. Ein eigener KI-Weg im Schülerbereich existiert nicht.

Zur Revision dieselbe Datei öffnen, **Lehrkräftemodus – Mystery bearbeiten** wählen, Kürzel eingeben, Inhalte bearbeiten, **Entwurf sichern**, anschließend **Schülerversion erstellen**. Dies funktioniert auch im SCORM-Player. Es verändert keine installierte Ressource und keine bereits verteilte Datei automatisch.

Jede im Editor übernommene Inhaltsänderung erhöht die Patch-Version; direkt bearbeitete Titel können mehrere Zwischenrevisionen erzeugen. Beim externen Überarbeiten einer Roh-JSON muss die KI eine neue Inhaltsversion setzen. Die volle Inhaltsprüfsumme unterscheidet zusätzlich Änderungen; ein alter Schülerstand enthält und lädt seine eigene Fassung vollständig. Kein stilles Kombinieren alter Positionen mit neuen Texten. Eine komplett neue Aufgabe erhält eine neue Mystery-ID.

## Optional: eigenständige Mystery-HTML und SCORM

Der bevorzugte Weg bleibt die Inhaltsdatei. Falls ausdrücklich eine themenspezifische Ausgabe gebraucht wird:

```sh
npm run build:mystery -- ausgabe/Meine-Aufgabe.mysteryboard ausgabe/MysteryBoard-Meine-Aufgabe.html ausgabe/MysteryBoard-Meine-Aufgabe-SCORM.zip
```

Der vierte Dateiparameter ist optional. Beide Ausgaben verwenden denselben universellen Kern und bieten weiterhin den Lehrkräftemodus. HTML-Namen bitte mit ASCII-Buchstaben/Ziffern/Bindestrich/Unterstrich und `.html`; bestehende Ziele werden geschützt. Die HTML muss unter 10.000.000 Bytes bleiben, Zielwert unter 6 MB. Bei sehr bildreichen Aufgaben stattdessen die universelle HTML plus portable Datei verwenden; die eigene HTML-Grenze begrenzt nicht pauschal die portablen Inhalte.

Die ältere Registry `mysteries.json` hält bestehende Regressionen und eingebundene Legacy-Mysterys verfügbar. Für **neue vollständige portable Einzelversionen** den oben genannten `build:mystery`-Weg verwenden. Niemals RC2-Artefakte oder Release-Tags überschreiben.

## Tatsächlich prüfen, nicht nur einen Bericht schreiben

1. Importieren Sie die erzeugte Aufgabe in die gebaute universelle HTML; kontrollieren Sie jede Karte, Medien, Gruppen, Quellen, Tabellen und Hilfen.
2. Öffnen Sie den Lehrkräftemodus, ändern Sie einen Text und eine Grafik, sichern Sie den Entwurf, schließen und öffnen Sie ihn erneut. Exportieren Sie eine neue Aufgabe.
3. In einem neuen Browserkontext mit eigenem Team beginnen, Touch/Pinch/Pan, Verbindungen, Farben, Hilfe, Undo/Redo und Druck prüfen.
4. Eine Original-PNG **herunterladen**, Anwendung schließen, die PNG in derselben Blanko-Anwendung wiederherstellen, alle Inhalte und Arbeitsdaten vergleichen und weiterarbeiten.
5. Dasselbe mit der tatsächlichen SCORM-ZIP im lokalen API-Test; anschließend separat itslearning und das echte Schul-iPad prüfen. Netzwerk nach dem Laden abschalten. Keine externen Requests, lokale Dauerablage oder LMS-Datenübermittlung.
6. Gesamte Regression ausführen:

```sh
CLASSROOM_SCORM=1 npm run check
npm run package:universal
npm run test:rc2
```

Einzelner verbindlicher Unterrichtskreislauf: `npm run test:universal`. Die CLI-Beispielprüfung und der spezifische HTML-/SCORM-Build sind Teil der reproduzierbaren Testvorbereitung. Echte PDF-Prüfungen benötigen Poppler. Plattformgrenzen und zusätzliche reale Tests immer dokumentieren.

## Unveränderliche Regeln und typische Fehler

- Gemeinsamen Board-/Touchkern, bestehende R1/R1b-Tests, History, Hilfe, Druck und Legacy-Sicherungen erhalten. Keine bestehenden Tests abschwächen.
- Boden-RC2, freigegebene Inhalte, Tags und Hauptbranch nicht überschreiben; kein eigenständiger Merge oder öffentliches Deployment.
- Keine zweite App je Thema, keine im Kern festgelegte Fachrichtung oder Pflichtkartennummer.
- Keine Lehrer-/Musterlösungen in Aufgaben verstecken; der Modus ist keine Zugriffssicherung.
- Kein Autosave, keine Noten/Punkte, keine Schülerdaten über SCORM. Die Hülle initialisiert/beendet nur ihre Sitzung.
- Kein HTML-Rendering von importiertem Text, keine externen Medien/Skripte und kein Ausführen importierter Daten.
- Keine QR-Kapazität als allgemeine Inhaltsgrenze verwenden; umfangreiche Dateien brauchen ihre unveränderte Original-PNG oder `.mysteryboard`.
- Dateierzeugung nicht mit tatsächlicher Ablage gleichsetzen; PDF ist kein Sicherungsformat.
- Kein behaupteter Safari-/iPad-/itslearning-/Canva-Nachweis ohne tatsächlichen Test. Emulation ist keine Gerätefreigabe.


Die grafische Hilfe-Bearbeitung verwendet weiterhin exakt `help.method` und `help.categories`. Es gibt keine zusätzliche Speicherformatversion. Fünf Denkimpulse, zwei Gruppenvorlagen, eigene Gruppen und eine Kontrastpalette dienen nur der Redaktion. Vorlagen ordnen **keine** Karten automatisch zu. Leere, unfertige Gruppen bleiben bis zur Prüfung lokal im Formular; übernommen werden nur gültige Gruppen mit mindestens einer Karte. Beim Export wird genau die gewählte Gruppierung gespeichert, nicht der lokale Verlauf der Vorlagenwechsel. Vorhandene Hilfemetadaten werden vollständig übernommen. Tatsächliche Inhaltsänderungen erhöhen die bestehende Patch-Version; bloßes Öffnen und unverändertes Übernehmen erhöht sie nicht. Die Schüler-Vorschau verwendet dieselbe `App`, `LearningHelp` und `Board` wie die universelle Anwendung. Details und Nachweise: [Abnahme Hilfen](docs/HELP-EDITOR-ABNAHME.md).


Vor der redaktionellen Übernahme und neuer Veröffentlichung müssen Hilfegruppennamen auch ohne Unterschiede in Großschreibung, äußeren oder mehrfachen inneren Leerzeichen eindeutig sein. Die originale Schreibweise wird nicht automatisch umgeschrieben. Das technische Dokumentformat bleibt für historische Dateien rückwärtskompatibel. Der grafische Editor sowie Aufgabenexport und CLI-Erstellen/Build verwenden die zusätzliche redaktionelle Prüfung; reines Lesen/Validieren historischer Dokumente ist davon getrennt. Der aktuelle unabhängige Abschlussauftrag und die Browserprüfung stehen unter `docs/HELP-EDITOR-ABSCHLUSS-PRUEFAUFTRAG.md`, `docs/HELP-EDITOR-ABSCHLUSS.md` und `qa/help-review/`.
