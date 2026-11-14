# MysteryBoard: Anleitung für Lehrkräfte

Diese universelle Vorlage öffnet unterschiedliche Mysterys aus Dateien. Sie enthält einen Lehrkräfteeditor und dieselbe Arbeitsfläche für Lernende. Für die Bedienung brauchen Sie weder ein Terminal noch Node.js oder ein KI-Konto. Die Boden-Unterrichtsversion RC2 ist eine separate, unverändert eingefrorene Ausgabe.

## Start und eigener Entwurf

Öffnen Sie `MysteryBoard-Universal.html` in einem vollständigen Browser oder die universelle SCORM-Anwendung im Kurs. Ein Browser kann lokal geladene HTML-Dateien je nach Betriebssystem und Schulverwaltung einschränken; die iPad-Dateivorschau ersetzt keinen Browser. Prüfen Sie den vorgesehenen Bereitstellungsweg vor dem Unterricht.

1. Wählen Sie **Eigenes Mystery erstellen**, geben Sie ein Lehrkraftkürzel ein und öffnen Sie den Lehrkräftemodus. Das Kürzel ist kein Schüler-Teamname.
2. Tragen Sie Titel und optional Untertitel ein. Ein eigener methodischer Denkimpuls ist optional.
3. Mit **Karte hinzufügen** legen Sie Karten an. Geben Sie Überschrift, Text und Kartengruppe an. **Karte übernehmen** übernimmt die Eingaben in den Entwurf.
4. Karten können nachträglich bearbeitet oder nach einer Sicherheitsabfrage gelöscht werden. IDs und Hilfereferenzen werden gemeinsam angepasst. `V` stammt aus den Gruppenmetadaten; es gibt keine fest programmierte Grenze zwischen Pflicht- und Vertiefungskarten.
5. **Startablage** ist standardmäßig numerisch und passt sich dem Bildschirm an. Sie können eine feste Spaltenzahl wählen. Ein importiertes ausdrückliches Startlayout bleibt verfügbar. Bewegungen in der Autorenvorschau werden nicht als Schülerlösung exportiert.
6. **Entwurf sichern** erzeugt eine `.mysteryboard`-Datei. Nutzen Sie im folgenden Dialog **Datei herunterladen** oder die angebotene Teilen-Funktion. Legen Sie die Datei bewusst außerhalb der Anwendung ab.

Ein leerer oder unfertiger Entwurf kann gesichert werden. Zum Bereitstellen einer Aufgabe sind ein Titel und mindestens eine freigegebene Karte erforderlich. Mit dem Häkchen **Für Schülerinnen und Schüler bereitstellen** können Karten vorerst nur im Entwurf verbleiben. Solche Karten gehören nicht in die Schülerversion. Vertrauliche Lösungen oder Bewertungsnotizen sollten Sie grundsätzlich außerhalb dieses ungeschützten Autorenwerkzeugs aufbewahren.

## Bilder, Diagramme, Quellen und Tabellen

Im Kartenformular wählen Sie eine lokale PNG-, JPEG- oder WebP-Datei. Das Bild wird vollständig eingebettet; die Datei muss anschließend nicht an ihrem ursprünglichen Ort bleiben. Dieselbe Dateiauswahl ersetzt ein bereits vorhandenes Bild. **Bild entfernen** löscht Bild und zugehörigen Alternativtext aus dieser Karte. Quellenangaben und Bildbeschreibungen sind separat bearbeitbar.

Die Grenzen betragen **3.000.000 Bytes je Bild**, höchstens **4096 Pixel je Kante** und **4 Millionen Bildpunkte je Bild**. Alle Bilder eines Mysterys dürfen zusammen höchstens **12.000.000 Bytes** und **24 Millionen Bildpunkte** erreichen. Größere Kamerafotos vorher lokal verkleinern. Animierte Dateien und SVG werden im neuen portablen Format nicht angenommen. Eine abgelehnte Datei ersetzt weder das bisherige Bild noch die übrigen Formulareingaben.

Bilder behalten ihr Seitenverhältnis. Im Lesefenster öffnet **Bild vergrößern** eine getrennte, verschiebbare Bildansicht mit einem Regler von 1× bis 4×. Die bewährten Gesten der Arbeitsfläche bleiben davon unabhängig. Eine unscharfe Originalgrafik erhält durch Vergrößern keine zusätzlichen Details; Legenden und Beschriftungen auf dem tatsächlichen Schülergerät prüfen.

**Tabelle hinzufügen** erzeugt eine strukturierte Tabelle: bis zu sechs Spalten und zwanzig Zeilen, mit optionaler Überschrift. Überschriften und Zellen lassen sich nach dem Wiederöffnen weiter bearbeiten. Im Druck erscheinen Tabellen platzsparend als vollständig beschriftete Datenzeilen. Ein Foto einer Tabelle bleibt dagegen ein Bild. Werte in einem solchen Foto lassen sich nicht wie Tabellenzellen bearbeiten.

PDF- und Word-Dateien werden nicht direkt im Editor importiert. Exportieren Sie die gewünschte PDF-Seite lokal als PNG/JPEG/WebP oder lassen Sie eine KI den Text sorgfältig in das strukturierte Format übertragen. Der Editor enthält weder OCR noch eine versteckte Cloud-Konvertierung. Die technische Entscheidung dazu steht im Abnahmebericht.

## Entwurf wieder öffnen und Aufgaben nachträglich ändern

Auf dem Startbildschirm wählen Sie **Mystery bearbeiten → Mystery-Datei auswählen**. Die Anwendung erkennt den Dateityp:

| Dateiinhalt | Verhalten |
| --- | --- |
| Lehrkraft-Entwurf | Öffnet den Editor mit Kürzel, Karten, Medien und unveröffentlichten Karten. |
| Veröffentlichte Aufgabe | Zeigt Titel und fordert einen eigenen Teamnamen an. |
| Schülerarbeitsstand | Stellt die ursprünglichen Inhalte und die gesamte gespeicherte Arbeit wieder her. |

Auch eine veröffentlichte Aufgabe, ein KI-erzeugtes Mystery oder eine mit dem neuen Build-Weg erstellte Einzel-HTML/SCORM-Ausgabe hat den Einstieg **Lehrkräftemodus – Mystery bearbeiten**. Er steht auf der Aufgabenseite und im Arbeitsmenü bereit. Sichern Sie vorher eine eventuell vorhandene Schülerarbeit. Der Editor übernimmt die Inhalte; Pfeile, Farben und Schülerpositionen werden nicht zur neuen Aufgabe.

Bei einer übernommenen Inhaltsänderung erhöht die Anwendung die letzte Versionszahl, beispielsweise `1.0.0 → 1.0.1`. Bei direkt eingegebenen Titeländerungen können mehrere Zwischenrevisionen entstehen. Die Mystery-ID bleibt erhalten. Eine bereits verteilte Datei wird dadurch nicht überschrieben. Ältere Schüler-PNGs bringen weiterhin ihre eigene ursprüngliche Inhaltsfassung mit; sie werden nicht mit den neuen Karten kombiniert.

**Lehrkräftemodus ist eine Bedienfunktion, keine Berechtigungskontrolle.** Es gibt keine Anmeldung und keinen geheimen Lehrer-PIN. Wer eine Datei besitzt, kann eine lokale Kopie bearbeiten. Dadurch werden weder die offizielle Datei im Kurs noch andere Nutzerdateien geändert.

## Aufgabe verteilen: SCORM einmal, Mystery-Dateien nach Bedarf

1. Installieren Sie nach dem Praxistest `MysteryBoard-Universal-SCORM-1.2.zip` einmal als SCORM-1.2-Lernressource in itslearning. Die ZIP enthält das Manifest unmittelbar auf oberster Ebene. Nicht zuerst entpacken und mit einem zusätzlichen Oberordner neu verpacken.
2. Erstellen oder importieren Sie Ihr Mystery im Editor.
3. Wählen Sie **Schülerversion erstellen**.
4. Laden Sie die erzeugte `.mysteryboard`-Datei bewusst herunter und stellen Sie sie **separat** als Kursdatei bereit. Alternativ öffnet **Aufgabe als PNG** die Erzeugung einer vollständigen Original-PNG.
5. Die Lernenden laden die Aufgabe auf ihr Gerät und öffnen in derselben universellen Anwendung **Mystery bearbeiten** beziehungsweise **Menü → Fortsetzen → Mystery-Datei auswählen**.
6. Nach vollständiger Prüfung erscheint die Aufgabe. Jede Gruppe gibt ihren eigenen Teamnamen oder Vornamen ein. Eine neutrale Gruppenbezeichnung genügt.

Das Bearbeiten im itslearning-Player verändert das dort installierte SCORM-Paket nicht. Die Verteilung der neuen Inhaltsdatei bleibt ein bewusster separater Vorgang. Die Anwendung führt keine Kursverwaltung und keinen automatischen Upload aus. Der genaue itslearning-Dateidialog und die Schulrechte müssen im realen Kurs erprobt werden.

## Schülerarbeit, Hilfe und Sicherung

Karten lesen und verschieben, mit beschrifteten Pfeilen verbinden, Farben und eigene Kategorien vergeben: alles bleibt im gemeinsamen Board. Zwei Finger zoomen, ein Finger verschiebt Karten oder eine freie Stelle der Arbeitsfläche. Rückgängig/Wiederholen behalten die bisherigen 40 Schritte; nach einer neuen Bearbeitung entfällt die Wiederholen-Folge.

Die Hilfe beginnt mit einem methodischen Impuls. Nur wenn geprüfte Kategorien hinterlegt sind, erscheint die freiwillige zweite Nummernorientierung. Sie färbt ausschließlich die Nummern, nicht die eigenen Kartenfarben. Vorhandene Hilfemetadaten bleiben beim Bearbeiten erhalten; Hilfetext, Gruppen, Farben und Zuordnungen lassen sich jetzt unter **Hilfetext festlegen** bearbeiten.

**Sichern** erzeugt eine Original-PNG mit Inhalt, Bildern und vollständigem Schülerarbeitsstand. Bei Bedarf steht im Menü das kleinere Sicherungsbild zur Verfügung. **Projektdatei sichern** bietet dieselben vollständigen Daten als `.mysteryboard` an. Ein erzeugtes Bild ist noch keine dauerhaft abgelegte Datei. Laden Sie es herunter, kontrollieren Sie den Speicherort und bewahren Sie es unverändert auf. Screenshots, Bildoptimierer und manche Messenger können den unsichtbaren Sicherungsblock entfernen.

Zum Fortsetzen reicht die Original-PNG in einer frischen universellen Anwendung. Die Aufgaben-Datei wird nicht zusätzlich benötigt. Ein QR-Code ist nur bei sehr kleinen vollständigen Daten möglich; bei großen Mysterys wird keiner angeboten. Ein fehlender QR-Code beschränkt weder Texte noch Bilder.

Es gibt **keine automatische Speicherung** im Browser oder LMS. Beim Verlassen kann der Browser vor Änderungen warnen; besonders mobile Browser garantieren diese Warnung nicht. Der Warnzustand wird nach bloßer Dateierzeugung nicht als „dauerhaft gespeichert“ zurückgesetzt.

## Druck und PDF

Im Schüler-Menü steht **Druckfassung / PDF**, im Editor **Karten drucken / PDF** zur Verfügung. Wählen Sie A4 oder A3, kontrollieren Sie die Vorschau und lösen Sie **Drucken / PDF speichern** bewusst aus. Der Browser stellt seinen eigenen Druckdialog bereit. Große Aufträge ab 30 Seiten zeigen vor dem Drucken eine Seitenzahlwarnung.

Die Lehrkraftfassung verwendet das Kürzel ausdrücklich als Lehrkraftangabe; die Schülerfassung den eigenen Teamnamen. Vollständige Texte, Bilder, Quellen und strukturierte Tabellen werden mitgeführt. Eine PDF ist eine Lesefassung und keine wiederherstellbare Mystery-Datei. Der native Safari-Druckweg bleibt bis zum tatsächlichen Gerätetest offen.

## Vor dem Unterricht

Prüfen Sie Karten und Quellen fachlich, lesen Sie die kleinsten Diagrammlegenden, testen Sie Hoch-/Querformat, Touch, Hilfe, Druck und vor allem eine **vollständige Sicherung und Wiederherstellung nach dem Schließen**. Testen Sie mit dem verwalteten Schul-iPad innerhalb des echten itslearning-Kurses. Eine lokale Chromium-Simulation ist keine schulische Freigabe. Canva-Einbettung, Kamera-/Downloadrechte und Safari müssen gesondert geprüft werden.

Weitere Details: [KI-Anleitung](AI-ANLEITUNG.md), [Dateiformat](docs/UNIVERSAL-FORMAT.md), [Abnahmebericht](docs/UNIVERSAL-ABNAHME.md).

## Hilfen für Lernende grafisch erstellen

Öffnen Sie im Lehrkräfteeditor **Hilfetext festlegen**. Sie sehen jetzt nur die Hilfe-Einstellungen. Andere Änderungen am Mystery sind erst nach **Hilfe übernehmen** oder **Abbrechen** wieder möglich.

1. **Denkimpuls auswählen:** fünf Vorlagen stehen zur Wahl. Der Text kann danach frei verändert werden. „Allgemeiner Denkimpuls“ verwendet die bisherige Standardhilfe; „Eigener Hilfetext“ erlaubt eine eigene Formulierung.
2. **Kartennummern als Hilfe markieren** einschalten, wenn Sie die zweite Hilfestufe anbieten möchten. Sie ist für neue Mysterys standardmäßig ausgeschaltet.
3. **Gruppen auswählen:** „Ursachen und Wirkungen“, „Nutzungskonflikte“ oder „Eigene Kategorien“. Namen und Farben sind bearbeitbar. Eine kleine Palette bietet gut lesbare Nummernfarben; bereits importierte andere Farben bleiben erhalten.
4. **Karten zuordnen:** Wählen Sie je Karte eine Gruppe oder „Keine Zuordnung“. Es gibt keine automatische fachliche Zuordnung. Unterschiedliche Gruppengrößen und unmarkierte Karten sind ausdrücklich möglich.
5. **Hilfe aus Schülersicht ansehen:** Die echte Schüleransicht zeigt zuerst den Denkimpuls. „Weitere Hilfe anzeigen“ aktiviert die farbigen Nummern und ihre Legende. Probieren Sie Karten und Verbindungen aus; diese Bewegungen werden nicht in die Aufgabe übernommen. **Zurück zu den Hilfen** bringt Sie zu Ihren Eingaben.
6. **Hilfe übernehmen**, dann **Entwurf sichern** oder **Schülerversion erstellen**. Die erstellte Datei bewusst herunterladen.

Höchstens sechs Gruppen sind möglich. Jede aktive Gruppe braucht einen eigenen Namen, eine andere Farbe und mindestens eine zugeordnete Karte. Fehler erscheinen direkt am betreffenden Feld; die Eingaben bleiben erhalten. Eine nicht benötigte Gruppe entfernen Sie mit „Gruppe … entfernen“. Sind Karten zugeordnet, fragt die Oberfläche vorher nach.

Ein Vorlagenwechsel verwirft bestehende Zuordnungen nicht unbemerkt. Während der Bearbeitung können Sie zu den vorherigen Gruppen zurückkehren. Erst **Hilfe übernehmen** legt die aktuell ausgewählte Gruppierung für diese Fassung fest. Schalten Sie die farbige Hilfe aus und übernehmen, entfällt sie in dieser neuen Fassung. Vorher exportierte Dateien bleiben erhalten.

Die Kategorien sind eine freiwillige Orientierung und keine Musterlösung. Wählen Sie bei mehrdeutigen Karten einen fachlich begründeten Schwerpunkt oder lassen Sie sie unmarkiert. Bei Schülerbeginn sind die Hilfen ausgeblendet. Die zweite Stufe färbt ausschließlich Nummern, ohne eigene Kartenfarben, Pfeile oder Arbeitsstände zu verändern.
