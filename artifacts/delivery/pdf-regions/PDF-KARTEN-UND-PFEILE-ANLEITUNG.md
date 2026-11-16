# PDF-Karten prüfen und gerichtete Pfeile verwenden

## PDF im Lehrkräfteeditor öffnen

1. Die aktuelle **Universal-HTML** oder **universelle SCORM-Vorlage** öffnen. **Lehrkräfteeditor** wählen und das Kürzel eingeben.
2. Eine einzelne PDF auf den Dateibereich ziehen oder **Unterrichtsmaterial auswählen** verwenden. Das gesamte Dokument wird lokal verarbeitet.
3. Unter **Karten ansehen** alle vorgeschlagenen Überschriften und Texte mit dem Original vergleichen. Die Erkennung bevorzugt gezeichnete Zellrahmen; fehlen diese, verwendet sie räumlich zugeordnete Kartenüberschriften. Kartenbezeichnungen werden nicht alphabetisch sortiert.
4. **Original ansehen** zeigt die PDF-Seite mit nummerierten Kartengrenzen. Eine Umrandung antippen, um die zugehörige Karte auszuwählen. Auf schmalen Bildschirmen zwischen Original und Kartenliste umschalten.
5. Unter **Dokumentabschnitte außerhalb der Karten** bleiben beispielsweise Kopfzeilen, Fragen und Arbeitsaufträge separat les- und kopierbar. Sie werden nicht automatisch zu Karten. Bei Bedarf die Originaldatei über **Originaldatei ablegen** aufbewahren oder die Abschnittstexte kopieren. Ein angebotener Titelvorschlag wird erst nach bewusster Auswahl verwendet; der Titel wird vor der Übernahme bestätigt.

## Grenzen korrigieren

- **Kartengrenze markieren** übernimmt die aktuelle Umrandung als bearbeitbare Markierung. Mit Finger/Maus einen neuen Ausschnitt ziehen oder Links/Oben/Breite/Höhe als Prozentwerte einstellen. **Grenze aktualisieren und Text neu lesen** übernimmt diese Änderung.
- **Bereich teilen** trennt waagerecht oder senkrecht an der gewählten Prozentposition.
- **Bereiche zusammenführen** verbindet die ausgewählten Bereiche auf derselben Seite. Enthielte die gemeinsame Fläche auch Text einer dritten Karte, muss deren Grenze zuerst geklärt werden; Doppelübernahmen werden abgewiesen.
- **Bereich entfernen** gibt den Text wieder für die separaten Dokumentabschnitte frei. Mit einer neuen Markierung und **Markierung als Textkarte hinzufügen** lässt er sich erneut zuordnen.
- Änderungen an Überschrift, Text oder Quelle werden bei einer räumlichen Neuauslesung nur nach einer zusätzlichen Bestätigung ersetzt. Bilder, Tabellen und Kartengruppe bleiben erhalten; widersprüchliche Medien werden nicht stillschweigend verworfen.

Nach jeder räumlichen Änderung die betroffenen Texte erneut lesen. Eine leere Auswahl erzeugt keine erfundene Textkarte. Ohne Textebene gibt es keine OCR: Stattdessen den vorhandenen Bildausschnitt verwenden.

Eine unsichere Gruppierung wird ausdrücklich gemeldet. Das gilt auch für mögliche Fortsetzungen über Seitengrenzen. Der automatische Vorschlag ersetzt die Originalprüfung nicht. Grafische Formeln, komplexe Überlagerungen und typografische Hoch-/Tiefstellung ohne eigenes Textzeichen gegebenenfalls als Bildausschnitt übernehmen; die vollständige Originalansicht bleibt die Referenz.

Erst **Geprüfte Karten übernehmen** verändert den Entwurf. Danach den Entwurf bewusst sichern. Die PDF und die vorläufigen Bereichsdaten werden nicht automatisch in die Aufgaben-Datei aufgenommen; die überprüften Kartentexte und gewählten Medien werden übernommen. Zum späteren erneuten Originalvergleich die ursprüngliche PDF aufbewahren.

## Pfeile

Karte A wählen → **Mit einer Karte verbinden** → Karte B wählen. Der Dialog schlägt jetzt **A → B** vor. Unter **Richtung** bleiben beide Pfeilrichtungen und **Ohne Pfeil** verfügbar. Eine bestehende Verbindung antippen, um ihre Richtung später zu ändern.

Bewusst ungerichtete ältere Verbindungen bleiben unverändert. Undo/Redo, Original-PNG und Wiederherstellung behalten die gewählte Richtung. PNG- und A4-/A3-Druckausgabe verwenden dieselbe Pfeilgeometrie. Bei stark verdichteten Übersichten hineinzoomen; die Größe der Pfeilspitzen bleibt begrenzt.

## Aufgabe bereitstellen

**Schülerversion erstellen → Für itslearning als SCORM herunterladen** erzeugt ein vollständiges Aufgabenpaket. Die einzelne ZIP unentpackt manuell in itslearning importieren. Die universelle Blankovorlage bleibt weiterhin verfügbar. Details: [SCORM-Anleitung](UNTERRICHTS-SCORM-ANLEITUNG.md).

Es gibt keine automatische Speicherung und keine Übertragung von Teamnamen oder Arbeiten an das LMS. Original-PNGs bewusst außerhalb der Anwendung ablegen. Der reale Safari-/Schul-iPad-/itslearning-Test einschließlich nativer Druckfunktion bleibt erforderlich.
