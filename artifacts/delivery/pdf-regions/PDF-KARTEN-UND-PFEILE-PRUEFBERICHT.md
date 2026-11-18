# PDF-Kartengrenzen und gerichtete Verbindungen: technischer Prüfbericht

16. November 2026. Basis: `b35aa16f41fe1f2bb7557ef42c9140723ed9d203`, Branch `feat/mysteryboard-classroom-scorm-export`. Korrektur ausschließlich auf **fix/mysteryboard-pdf-multiple-cards**. Quellcommit und Produktionsprüfsummen stehen in den Metadaten der fertigen Lieferung.

## Ursachen und Änderungen

**PDF-Erkennung:** Der alte Worker verknüpfte Textfragmente zunächst zu Seitenzeilen. Dabei konnten Nachbarkarten ineinanderlaufen. Die anschließende Überschriftenerkennung kannte numerische Kartenkennungen, aber keine einzelnen Buchstaben. Vektorrahmen dienten bislang nicht als Kartengrenzen. In der tatsächlichen alten Produktions-HTML entstanden beim zweitseitigen Original A sechs statt 20 Vorschläge und beim einseitigen Original B eine statt 16 Karten.

Der neue Adapter `src/core/document-import/pdf-layout.ts` arbeitet zuerst mit Textpositionen und bemalter Vektorgeometrie. Nur tatsächlich gezeichnete Pfade zählen als Rahmen; reine Beschneidungsrechtecke bleiben unberücksichtigt. Dies ist beim rahmenlosen Original wichtig. Dünne gefüllte Rechtecke, wie sie Word für Tabellenlinien erzeugt, werden ebenso unterstützt wie gestrichene Pfade, gemeinsame Zellkanten und kleine Unterbrechungen. Transformationen und Save/Restore-Stapel werden angewandt. Leere Zellen ergeben keine Karte. Große Arbeitsaufträge und Kopf-/Fragebereiche außerhalb der Karten bleiben separat verfügbar.

Ohne geeignete Rahmen werden zuerst Kartenüberschriften räumlich lokalisiert. Spaltenzwischenräume werden anhand tatsächlicher Textausdehnung gesucht. Erst innerhalb der abgegrenzten Region werden Zeilen und Absätze zusammengesetzt. Unbeschriftete Raster und rahmenlose Überschriftenlayouts verwenden visuelle Reihenfolge zeilenweise von links nach rechts. Bereits unterstützte ausdrücklich beschriftete Rahmenblätter behalten ihren bisherigen Spaltenfluss; Bezeichnungen selbst werden nicht alphabetisch oder inhaltlich sortiert. Der bestehende mehrspaltige PDF-Vergleichstest blieb unverändert und besteht wieder.

Fehlen klare Rahmen und Überschriften, entstehen ausdrücklich unsichere räumliche Vorschläge. Mögliche Seitentextfortsetzungen werden mit Unsicherheitshinweis erhalten, einschließlich Text am Anfang einer Folgeseite vor der nächsten Überschrift und über mehr als zwei Seiten. Wiederholte Kopfzeilen werden nicht als Fortsetzung übernommen. Es gibt keine fachliche Deutung, KI oder erfundene Übergangstexte.

Absatzabstände werden innerhalb einer Karte bewahrt. Zahlen am Anfang einer Layoutzeile mitten im Kartentext werden nach der räumlichen Zuordnung nicht als zusätzliche Kartenüberschrift interpretiert. Auch kleinere hoch-/tiefgestellte Zeichen werden ihrer Textzeile nach horizontaler Position zugeordnet. Das Kartenformat bleibt reiner Text: rein typografische Hochstellung ohne eigenes Unicodezeichen wird dadurch nicht zu einer neuen Rich-Text-Funktion. Quellenpräfixe werden weiterhin separat als Quelle übernommen.

**Grafische Prüfung:** `PdfRegionEditor.tsx` ergänzt im bestehenden Importassistenten nummerierte, zurückhaltende Umrandungen und Auswahl mit Touch, Maus oder Tastatur. Markieren, Grenzen ändern, waagerecht/senkrecht teilen, zusammenführen, entfernen und ergänzen verwenden dieselben PDF-Seitenkoordinaten wie der bestehende Bildausschnitt. Überschriften, Text und Quellen betroffener Karten werden aus der veränderten Region neu gelesen. Manuell geänderte Texte erfordern eine Ersetzungsbestätigung. Medien und Kartengruppe bleiben erhalten. Überlagernde Textübernahmen und leere Textbereiche werden abgewiesen. Bei Mehrfingereingabe oder Pointer-Abbruch wird die vorläufige Markierung zurückgesetzt; Karten werden erst durch die bewusste Aktion verändert.

`DocumentImport.tsx` hält alle Geometriedaten ausschließlich während des Assistenten vor. Die bisherigen Text-Split/Merge-Funktionen bleiben verfügbar; nicht mehr passende Bereichszuordnungen werden freigegeben und bei einer exakten Rücknahme wiederhergestellt. Dokumentabschnitte bleiben separat lesbar; die Originaldatei kann bewusst abgelegt werden. Erst die bestehende ausdrücklich bestätigte Kartenübernahme ändert den Entwurf. Abbruch lässt ihn erhalten.

**Pfeile:** In `src/App.tsx` ist ausschließlich der Ausgangswert einer neu angelegten Verbindung von 0 auf **1** geändert. Das Öffnen bestehender Verbindungen übernimmt weiterhin deren gespeicherte Richtung. Die drei Dialogoptionen und die unveränderten Werte **0 | 1 | 2** bleiben erhalten.

`layout.ts` stellt gemeinsame, begrenzt mitwachsende Pfeilgeometrie bereit. Nahe Karten dürfen durch feste Endpunktabstände keine geometrisch rückwärts laufende Verbindung erzeugen. `Board.tsx` verwendet eindeutige Markerkennungen je SVG, explizite Markermaße in Weltkoordinaten und eine letzte dekorative Ebene für die Pfeilspitzen. Ein kleiner heller Rand erhöht den Kontrast an Kreuzungen. Diese Ebene hat keine Pointer-Treffflächen. Linien-/Beschriftungspriorität und die vorhandene Touch-Steuerung bleiben erhalten.

`export.ts` zeichnet dieselben Spitzen nach Linien, Beschriftungen und Karten in das echte Canvas-PNG. `print.ts` verwendet die entsprechende Vektorgeometrie und Zeichenreihenfolge in A4 und A3. PNG-Sicherungsblock, Dokumentvalidator, History, Datenformat und SCORM-Sitzungslogik wurden nicht verändert.

## Tatsächliche Originalprüfung

Die beiden hochgeladenen PDFs wurden unverändert als Eingaben benutzt; sie sind nicht Bestandteil der öffentlichen Regression.

- **Original A:** zwei Seiten; **20 Karten**, davon **15 + 5**. Leeres sechstes Feld auf Seite 2 ausgeschlossen. Kopf, Frage und fünfteiliger Arbeitsauftrag außerhalb der Karten. Die beiden ausdrücklich getrennten Absätze der betreffenden Karten bleiben zusammen innerhalb einer Karte.
- **Original B:** eine Seite; **16 Karten**, acht Zeilen mit zwei Spalten. Jede ursprüngliche Buchstabenüberschrift bleibt dem richtigen Text zugeordnet. Keine alphabetische Umsortierung.
- **36 von 36** Überschriften/Kartentexten wurden gegen unabhängig am Original geprüfte Solltexte verglichen, einschließlich Satzzeichen, Umlauten und der sichtbaren Absatzgrenzen. Die vollständige Zuordnung und Original-Screenshots liegen ausschließlich im privaten Abnahmepaket.
- **Acht vollständige Original-Browserfälle**: je Dokument 1024 × 768, 768 × 1024, 600 × 800 und 320 × 700 CSS-Pixel. Die Einstiege wechseln zwischen tatsächlicher Universal-HTML und echter universeller SCORM-Einbettung. Jeder Fall prüft alle Karten, alle Seitenumrandungen, eine manuelle Grenzänderung, bewusste Übernahme, heruntergeladenen Entwurf, neuen Editorstart, Schülerversion, im Browser erzeugtes SCORM-ZIP, neuen LMS-Start ohne Aufgabenimport, Team, Touch/Pinch, Pfeile, echte PNG, neue SCORM-Sitzung und vollständige Wiederherstellung samt Weiterarbeit.

Die öffentliche Regression verwendet eigene neutrale PDFs mit anderen Texten, anderer Buchstabenfolge und anderen Koordinaten. Sie sind mit dem kostenlosen ReportLab erzeugt, nicht aus den Originalen kopiert. Der Anwendungskern kennt weder die beiden Dokumentnamen noch Themen oder geforderte Kartenanzahlen.

## Sichtbarer Pfeilnachweis

`tests/browser/arrows-visible.spec.ts` prüft dieselbe Verbindung in drei echten Betriebsarten: Universal-HTML, universelle SCORM-ZIP und im Browser erzeugte Unterrichts-SCORM-ZIP. Für **1, 2 und 0** entstehen jeweils tatsächliche Bildschirmbilder, heruntergeladene PNGs sowie echte A4- und A3-PDF-Dateien aus der vorbereiteten Druckansicht.

Der separate Python-Prüfer `qa/pdf-regions/check-visible-arrows.py` vergleicht die tatsächlichen Rasterbilder gegen die Ausgabe ohne Pfeil. Die PDFs werden dafür mit einem unabhängigen PDF-Renderer gerastert. Die veränderten Pixel müssen eine sichtbare Spitze am Ziel beziehungsweise am Ursprung bilden. Mindestfläche, Lage und umgekehrte Richtung werden geprüft. Es reicht somit weder ein gesetzter Datenwert noch ein vorhandenes SVG-Attribut.

Zusätzlich geprüft: neuer Standard 1 direkt im Dialog; nachträgliche Bearbeitung; bewusst 0; Undo/Redo; Kartenbewegung; Pinch; beschriftete Kreuzungen; Wiederherstellung eines gemischten Standes mit **[0, 1, 2]** ohne Umwandlung alter ungerichteter Verbindungen. Die Lehrkräfte-Schülervorschau zeigt ebenfalls neue und umgekehrte Pfeile. Die bisherige vollständige Regression einschließlich 220-Verbindungen-Prüfung wird separat ausgeführt.

## Reproduktion

```sh
npx tsc --noEmit
npm test

CLASSROOM_SCORM=1 \
PDF_REGION_DOWNLOADS=/workspace/mysteryboard-pdf-regions-evidence/downloads \
CLASSROOM_EXPORT_DIR=/workspace/mysteryboard-pdf-regions-evidence/downloads \
AUTHORING_EXAMPLES_DIR=/workspace/mysteryboard-pdf-regions-evidence/downloads \
PRINT_EXAMPLES_DIR=/workspace/mysteryboard-pdf-regions-evidence/downloads \
INTEGRATION_EXAMPLES_DIR=/workspace/mysteryboard-pdf-regions-evidence/downloads \
  npm run check
npm run test:rc2
```

Für die privaten Originale wird dieselbe `pdf-regions.spec.ts` mit `PDF_REGION_CASES` auf eine private Falldatei und separaten Ausgabeverzeichnissen ausgeführt. Die Originale oder Solltexte werden dafür nicht in das Repository kopiert. Der unabhängige Standardbibliothek-Prüfer liest die tatsächlich erzeugten Aufgaben, ZIP-Manifeste, Startdaten und PNG-Sicherungsblöcke ohne Anwendungscode:

```sh
python3 qa/pdf-regions/verify-outputs.py PRIVATE-CASES.json PRIVATE-DOWNLOADS
```

Ergebnis: **155 Datentests bestanden** (22 Dateien). Im vollständigen Lauf bestanden zunächst **224 von 226 Browsertests**. Die beiden Abweichungen betrafen ausschließlich die bisherige Erwartung `direction: 0` für eine neu erzeugte Verbindung im vollständigen R1b-Touch-Arbeitsablauf. Der tatsächlich gespeicherte Wert war bereits der nun ausdrücklich verlangte Wert 1. Nur diese eine gemeinsame Sollwertzeile in `tests/browser/r1b.spec.ts` wurde auf 1 angepasst; keine Prüfung wurde entfernt, gelockert oder übersprungen. Die beiden vollständigen Abläufe wurden danach erneut ausgeführt: **2 bestanden**. Damit sind sämtliche **226 Browsertests** erfolgreich abgedeckt. Nach dieser Erwartungsanpassung gab es keine Änderung am getesteten Anwendungscode oder an den gebauten HTMLs.

Zusätzlich **8 Original-Browserabläufe bestanden**, **4 eingefrorene RC2-Browsertests bestanden**. Die neuen öffentlichen Browserfälle umfassen acht neutrale vollständige PDF-Abläufe, vier manuelle Regions-/Touch-/Abbruchprüfungen und vier sichtbare Pfeilprüfungen. Die Ausgangssuite mit 134 Datentests und 210 Browsertests bleibt vollständig enthalten. Auch der tatsächliche 220-Verbindungen-Belastungstest, Word-/PDF-Medien, seitenübergreifende Texte, PNG-Grenzen, alte Datenformate, Offlinebetrieb, History und Druck bestehen.

```sh
npx playwright test tests/browser/r1b.spec.ts --grep 'durchgehender Touch-Arbeitsablauf'
```

SHA-256-Werte stehen in `ERGEBNIS.json`, den Dateilisten und vollständigen Protokollen der Lieferung. Die ausgeführte Originalspezifikation besteht aus acht Fällen; ihre Inhaltsnachweise bleiben privat. Es handelt sich um eigene reproduzierbare Browserprüfungen und einen separaten Raster-/Dateiformatprüfer, nicht um eine externe menschliche Abnahme.

## Schutz und Grenzen

Die drei eingefrorenen Boden-Dateien sind bytegleich zur Basis. Die eigentlichen Dokument-/PNG-/History-/Codecdateien, Schemas und `scorm/session.js` bleiben unverändert. Die Word-Erkennung verwendet weiterhin das unveränderte `proposeCards()` und denselben Parser. Es gibt keine neue Laufzeitabhängigkeit und keine Formatmigration.

PDFs bleiben auf 20 MB/40 Seiten begrenzt, Kartenzahl auf 100, Text-/Bildmengen auf die bestehenden Grenzen. Die Analyse läuft in einem abbrechbaren Worker. Geometrie und Textpositionen werden verwendet; für die Kartenerkennung werden keine Seitenbilder analysiert. Nur die gewünschte Vorschauseite wird gerastert. Aufwändige oder unklare Layouts müssen anhand des Originals korrigiert werden. Größere Lücken in Rahmen, ungewöhnliche Schrifttransformationen, grafische Formeln und stark überlagerte Zeichnungen bleiben Grenzen einer allgemeinen heuristischen Erkennung. Diese sind keine fachliche oder OCR-Abnahme.

Die vollständige Anwendung und sämtliche Ressourcen funktionieren ohne externe Laufzeitanfragen. Es gibt keine automatische Speicherung, Cloud-PDF-Konvertierung, KI-Anbindung oder Übertragung von Teamnamen, Antworten oder Bewertungen an das LMS. Die bewusste Original-PNG-Sicherung bleibt erhalten.

Geprüft mit Chromium unter Linux und Touch-Emulation. WebKit 26.5 ist nicht installiert; WebKit 27.2 konnte wegen fehlender Hostbibliotheken nicht gestartet werden. Ein echter Safari-, itslearning- und verwalteter Schul-iPad-Test einschließlich nativer Druckfunktion bleibt offen. Keine schulische Freigabe oder Mac-/iPad-Leistungsmessung behauptet.

Kein Merge in `main`, kein Release und keine Pages-Veröffentlichung. Originalmaterialien, Original-Screenshots und daraus abgeleitete Aufgaben/SCORM-Pakete werden nicht öffentlich hochgeladen. Die Originalbereitstellung erfolgt getrennt und privat.
