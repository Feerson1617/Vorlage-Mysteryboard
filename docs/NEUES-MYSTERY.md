# Neues Mystery mit der Vorlage erstellen

Die Vorlage verwendet einen gemeinsamen Anwendungskern. Jede Schüler-HTML enthält genau die beim Build ausgewählte Inhaltsdatei. Für ein weiteres Mystery sind eine JSON-Datei und ein Eintrag in `mysteries.json` nötig; Änderungen an Oberfläche oder Anwendungskern sind nicht erforderlich.

## 1. Eine Inhaltsdatei anlegen

Lege UTF-8-JSON unter `src/content/` ab, beispielsweise `src/content/wald-klasse8.json`. Verwende eine eigene, dauerhaft eindeutige `id` und eine explizite Inhaltsversion. Verschiedene Mysterys dürfen nicht dieselbe ID übernehmen. Bei inhaltlich inkompatiblen Änderungen, insbesondere neuen/umgeordneten Karten-IDs, erhöhe `version`; alte Sicherungen werden dann ausdrücklich abgewiesen. Das Speicherformat der Anwendung wird unabhängig von dieser Inhaltsversion verwaltet.

Eine kleine vollständige Vorlage:

```json
{
  "id": "bio8-wald-beispiel",
  "version": "1.0.0",
  "title": "Ein eigenes Mystery",
  "cardGroups": {
    "required": { "label": "Pflicht", "prefix": "" },
    "extension": { "label": "Vertiefung", "prefix": "V" }
  },
  "cards": [
    {
      "id": 1,
      "title": "Erster Hinweis",
      "text": "Hier steht der geprüfte Kartentext.",
      "group": "required"
    },
    {
      "id": 2,
      "title": "Zusätzlicher Hinweis",
      "text": "Hier steht eine Vertiefung.",
      "group": "extension"
    },
    {
      "id": 3,
      "title": "Weitere Beobachtung",
      "text": "Hier steht eine weitere Pflichtkarte.",
      "group": "required"
    }
  ],
  "initial": {
    "cards": [
      { "id": 3, "x": 0, "y": 0, "color": 0 },
      { "id": 1, "x": 420, "y": 0, "color": 0 },
      { "id": 2, "x": 840, "y": 0, "color": 0 }
    ],
    "edges": [],
    "categories": ["", "", "", "", "", ""]
  }
}
```

- `title` ist der vollständige Mystery-Titel auf der Startseite und links in der PNG-Kopfzeile. Titel und Kartentitel dürfen höchstens 100 Zeichen, Kartentexte höchstens 4.000 Zeichen enthalten.
- `cards` enthält 1–100 Karten. Die internen IDs bleiben numerisch; nutze eindeutige IDs von 1 bis zur Kartenanzahl. `initial.cards` muss jede ID genau einmal enthalten. `x`/`y` bestimmen die Startanordnung, `color: 0` ist Weiß. Abstände müssen zur tatsächlichen Kartenhöhe passen; die Übersicht abschließend prüfen.
- `group` verweist ausdrücklich auf einen Eintrag in `cardGroups`. Im Beispiel sind 1 und 3 Pflichtkarten, nur 2 eine Vertiefung. Es gibt keine festgelegte numerische Grenze. `prefix: "V"` ergibt etwa `V2`; Präfix und Bezeichnung sind je Inhaltsdatei konfigurierbar. Alle Karten bleiben gleichzeitig sichtbar. Diese Metadaten sind keine fachliche Farbkategorie.
- `cardGroups` und `group` sind optional. Bestehende Inhalte ohne diese Felder behalten ihre numerischen Anzeigen. Ein Gruppenpräfix darf leer oder bis zu drei Zeichen lang sein, ohne Leer-/Steuerzeichen. Gruppenbezeichnungen sind auf 80 Zeichen begrenzt.
- Leere `edges` und sechs leere Kategorien liefern eine neutrale Ausgangslage. Keine Musterlösung, Lehrerhinweise oder vorgegebene Beziehungsnetze in das Schüler-JSON kopieren.
- Optionale Bilder müssen bereits als unterstützte `data:image/...;base64,...`-Daten in `image` eingebettet sein; `imageAlt` beschreibt sie. Keine externen Bild-URLs verwenden. Komplexe Karten/Diagramme vorab auf dem tatsächlichen Gerät auf Lesbarkeit prüfen; die Vorlage stellt keine zusätzliche Bildvergrößerung bereit.

Teamname/Vornamen werden beim Start verbindlich eingegeben, über das Menü geändert und mit dem Arbeitsstand gesichert. Eine neutrale Gruppenbezeichnung genügt. Sie gehören nicht zur Inhaltsdatei. Die Teamfunktion gilt identisch für alle Mysterys. Technisch gültige teamlose Altsicherungen bleiben importierbar; vor jedem neuen Schülerexport wird eine fehlende Teamangabe nachgefragt, auch nach Rückgängig.

## 2. Den Build konfigurieren

Ergänze `mysteries.json` um genau einen Eintrag:

```json
"wald-klasse8": {
  "content": "src/content/wald-klasse8.json",
  "output": "MysteryBoard-Wald-Klasse8.html"
}
```

Die Schlüssel `development`, `production` und `test` sind für die Werkzeug-Standardmodi reserviert. Der Schlüssel wählt den Build: Er beginnt mit einem kleinen ASCII-Buchstaben und enthält nur kleine Buchstaben, Ziffern und Bindestriche. Der HTML-Dateiname beginnt mit einem ASCII-Buchstaben oder einer Ziffer und enthält danach nur ASCII-Buchstaben, Ziffern, Unterstriche oder Bindestriche sowie die Endung `.html`. Inhaltsdateien liegen innerhalb des Projekts. Für reine Prüfdatensätze kann `"testOnly": true` gesetzt werden; deren HTMLs landen getrennt unter `artifacts/tests/`.

## 3. Eine eigenständige Schüler-HTML bauen

Voraussetzung: Node.js 24 und installierte Projektabhängigkeiten (`npm ci`). Im Repository:

```sh
# Nur das neue Mystery, inklusive Typprüfung und Inhaltsvalidierung:
npm run build -- wald-klasse8

# Alle Produktionsvarianten aus mysteries.json:
npm run build

# Vorschau eines bestimmten Inhalts während der Vorbereitung:
npm run dev -- --mode wald-klasse8

# Vollständige bestehende Regressionen und die zusätzlichen Testvarianten:
npm run check
```

Die neue Datei liegt unter `artifacts/MysteryBoard-Wald-Klasse8.html`. Sie enthält Anwendung, Inhalte und benötigte Ressourcen. Der Build validiert die komplette Registry auf gültige Inhalte und doppelte Kombinationen aus Mystery-ID und Inhaltsversion, auch bei einem Einzelbuild. Er verwendet den gemeinsamen Inhaltsvalidator, lehnt unbekannte Build-Namen ab und prüft jede fertige HTML auf die Grenze **unter 10.000.000 Bytes** und externe Laufzeitressourcen.

Die bisherigen Produktionsdateien bleiben `MysteryBoard-klein.html` und `MysteryBoard-umfangreich.html`; das Boden-Mystery wird als `MysteryBoard-Boden-Klasse11.html` gebaut. `reuse-example` ist ein bewusst anderes Prüf-Mystery mit fünf Karten und Vertiefungen `Z2`/`Z5`. Es verwendet denselben Anwendungskern und wird mit `npm run build:example` gebaut. Der 220-Verbindungen-Prüfstand bleibt unter `review` bzw. `npm run build:review` verfügbar.

## 4. Vor dem Unterricht prüfen

1. **Fachlich:** Titel, vollständige Kartentexte, Quellen, Pflicht-/Vertiefungszuordnung und Startanordnung kontrollieren; keine Lehrer- oder Lösungsmaterialien im Schülerpaket.
2. **Fertige Datei:** Die erzeugte HTML öffnen, vom Netz trennen und alle Karten/Nummern prüfen. Karte lesen, verschieben, verbinden, sichtbares Label ändern, Undo/Redo und Menüsteuerung per Touch testen. Hoch- und Querformat prüfen.
3. **Team und Sicherung:** Teamname setzen und ändern, PNG herunterladen und tatsächlich in „Dateien“ ablegen. Titel links und Team rechts im PNG visuell auf vollständige, überlappungsfreie Darstellung prüfen.
4. **Neue Sitzung:** Anwendung vollständig schließen, dieselbe Mystery-HTML erneut öffnen, die Original-PNG auswählen und den vollständigen Zustand einschließlich Teamname überprüfen. Danach weiterarbeiten und erneut sichern. Eine erzeugte PNG allein bestätigt keine dauerhafte Ablage.
5. **Kompatibilität:** Eine Sicherung eines anderen Mysterys oder einer inkompatiblen Inhaltsversion muss verständlich abgewiesen werden. Alte technisch gültige Sicherungen derselben ID/Inhaltsversion ohne Teamname bleiben importierbar.
6. **Einsatzort:** Veröffentlichung und Schülerlink erst nach Freigabe tatsächlich testen; anschließend auf verwalteten Schul-iPads prüfen. Browseremulation ersetzt keine Geräteabnahme. Ohne tatsächlichen Canva-Test keine Canva-Kompatibilität behaupten.

Die HTML kann unverändert von einem statischen HTTPS-Host ausgeliefert werden. Für einen freigegebenen GitHub-Pages-Weg genügt beispielsweise eine Kopie als `index.html`; weder Datenbank noch externe Skripte sind erforderlich. Der Build veröffentlicht nichts. Die ursprüngliche HTML mit Bytegröße, SHA-256 und zugehörigem Quellstand aufbewahren, bevor eine Freigabe erfolgt.
