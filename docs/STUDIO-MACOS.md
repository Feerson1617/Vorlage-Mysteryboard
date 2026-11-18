# MysteryBoard Studio – Installation und Bedienung

Studio 0.2.0, UX-Fassung vom 17. November 2026. Für Apple Silicon (M1 und neuer),
Build-Mindestziel macOS 13; tatsächlich geprüft auf macOS 15.8.2.
Die Einzelheiten der aktuellen nativen Prüfung stehen in
`STUDIO-UX-ABNAHMEBERICHT.md`. Der erfolgreiche Nutzerstart der vorherigen
Version auf dem M1 ersetzt nicht die Prüfung dieser neuen Fassung. Verwaltete
Schul-iPads und die echte itslearning-Installation bleiben zu prüfen.

## Installieren

1. `MysteryBoard-Studio-0.2.0-Apple-Silicon.dmg` herunterladen und öffnen.
2. `MysteryBoard Studio.app` in den gewünschten Programme-Ordner kopieren. Ein
   eigener Programme-Ordner im Benutzerordner ist ohne administrative
   Installation nutzbar. Alternativ die App aus der mitgelieferten ZIP entpacken.
3. Die kopierte App öffnen. Während des Betriebs werden kein Terminal, kein
   Python, kein Entwicklungsserver und kein separat installiertes Node.js benötigt.

Beim Download des vollständigen Actions-Artefakts die äußere ZIP zuerst
entpacken. Die Installationsdateien liegen darin unter `out/make/`; die DMG heißt
dort `MysteryBoard Studio.dmg`. Die App-ZIP ist eine alternative Installation.
Das separate Abnahmepaket enthält Quellen und Prüfnachweise; es ist kein
Installationsersatz und kein Schüler-SCORM.

**Wichtig für den Erststart:** Die App ist kostenlos ad hoc signiert; ihre
Ressourcenprüfung besteht. Sie besitzt kein Apple-Developer-ID-Zertifikat und ist
nicht Apple-notarisiert. Gatekeeper erteilt im automatisierten Test keine
Vertrauensfreigabe. Auf dem eigenen Mac muss der erlaubte Erststart gegebenenfalls
unter „Systemeinstellungen → Datenschutz & Sicherheit“ bestätigt werden. Eine
Schul-/Firmenrichtlinie kann dies verhindern. Es wird weder eine globale
Abschaltung von Gatekeeper noch ein Entfernen der Quarantäne empfohlen. Wenn keine
Freigabe angeboten wird, ist die lokale IT-Freigabe offen; eine Apple-Freigabe wird
nicht behauptet.

## Ein einfaches Mystery erstellen

„Neues Mystery erstellen“ wählen, ein Lehrkraftkürzel eingeben und den Titel
festlegen. Auf der Pinnwand „Karte hinzufügen“ wählen. Im normalen Kartenformular
stehen Überschrift, Text, Kartengruppe und bei Bedarf ein Bild zur Verfügung.
„Karte übernehmen“ legt die Karte auf der Pinnwand ab. Dort kann sie angeklickt
und durch Ziehen angeordnet werden.

Die vier Hauptaktionen bleiben erreichbar:

- Karte hinzufügen
- Importieren
- Mystery gestalten
- Exportieren

Für ein einfaches Mystery sind keine Gestaltungsentscheidungen nötig.

Neue Studio-Projekte nummerieren Pflichtkarten mit 1, 2, 3 … und Vertiefungskarten
mit V1, V2, V3 … . Die sichtbaren Nummern sind von Originalüberschriften wie
„Karte J“ getrennt. Eine Originalüberschrift wird nicht automatisch überschrieben.
Bestandsdateien behalten ihre bisherigen Kennzeichnungen. Unter „Mystery gestalten
→ Startanordnung“ kann die getrennte Gruppennummerierung bewusst gewählt werden.

## Weitere Kartenangaben und Gestaltung

„Weitere Kartenangaben“ enthält Quellen, Bildbeschreibungen, Tabellen, die Position
in der Kartenreihenfolge und die Freigabe für Lernende. Ein Hauptbild und bis zu
drei zusätzliche Bilder oder Diagramme pro Karte sind möglich. Quellen,
Bildunterschriften und Alternativtexte bleiben erhalten. Eine zusätzliche Grafik
wird als Originalbild gespeichert; Diagramme werden nicht durch vermeintlich
richtige OCR-Datentabellen ersetzt.

„Mystery gestalten“ bietet vier Bereiche: Darstellung, Verbindungen, Karten und
Medien sowie Startanordnung. Vorlagen und Details sind optional. Öffnen und
Schließen dieses Bereichs verändern allein noch keine Projektdaten. Farben und
Schriftgrößen, Rahmen, Abstände, Pfeile und Beschriftungen werden im selben
Dokument gespeichert. Globale Verbindungsstile gelten für alle Verbindungen;
eine vorhandene Pfeilrichtung bleibt erhalten. Die gewählte Ausgangsrichtung gilt
nur für neu angelegte Verbindungen.

Die Autorenanordnung wird separat im Lehrkraftentwurf gespeichert. Sie wird nicht
als Schülerlösung exportiert. Die Schüleraufgabe startet ohne Teamnamen,
Schülerfarben oder bereits gelöste Verbindungen. Die geordnete Startablage lässt
sich unabhängig davon konfigurieren.

Hilfen erreicht ihr unter „Mystery gestalten → Karten und Medien → Hilfen
konfigurieren“. Dort bleibt der vorhandene grafische Hilfeeditor mit Denkimpuls,
Farbgruppen und Kartenwahl verfügbar. Mit „Übernehmen“ werden die Hilfen in
denselben Entwurf übernommen; danach bewusst mit ⌘S sichern.

Unter „Exportieren → Schüleransicht prüfen“ öffnet sich der tatsächlich separat gebaute
Player in einem eigenen, vorübergehenden Fenster. Er besitzt keinen Studio-
Dateizugriff und keine OCR. Änderungen in dieser Vorschau verändern weder das
Autorenprojekt noch die veröffentlichte Startanordnung.

## Material importieren

Word-Dateien (`.docx`), PDFs und Fotos als PNG, JPEG oder WebP lassen sich auswählen
oder auf der Pinnwand ablegen; Dateien können auch auf der Studio-Startfläche
abgelegt werden. Jeweils eine Datei wird kontrolliert verarbeitet.

Nach dem Import zeigt ein breites Fenster links das Original und rechts die
aktuelle Karte. Nummerierte Rahmen im Original sind anklickbar. „Vorherige Karte“
und „Nächste Karte“ wechseln ebenfalls die Auswahl, bei Bedarf auch die PDF-Seite.
„Original vergrößern“ hilft beim Vergleich. Im schmalen Fenster wechseln die
beiden Ansichten über die vorhandenen Reiter.

Text-PDFs verwenden weiterhin die schnelle räumliche Textextraktion. Für Fotos und
reine Scan-Seiten startet einmal pro Seite die vollständig lokale deutsche OCR. Mehrere
Karten pro Seite werden anhand der vorhandenen Grenzen und Textpositionen
vorgeschlagen. Grenzen lassen sich markieren, verschieben, verändern, teilen,
zusammenführen, ergänzen und entfernen. Einzelne Karten können erneut erkannt
werden. Bei unklaren Bildern und Vektorzeichnungen den benötigten Originalbereich
als Bildausschnitt zuordnen und die Zuordnung prüfen.

Grafische Pixelanteile, die nicht durch OCR-Wortrechtecke erklärt werden, führen
im Studio vorsorglich zur Übernahme des Originalausschnitts. Dies ist eine
heuristische Sicherung von Bildinformationen, keine fachliche Diagrammanalyse.
Fehlende Zuordnungen und Fehlalarme bleiben möglich. Bilder, Achsen, Legenden,
Einheiten und Quellen deshalb am Original kontrollieren und bei Bedarf manuell
zuordnen. Diese Werkzeuge liegen unter „Erkennung korrigieren“ in den Bereichen
„Kartengrenzen“, „Texterkennung“, „Kartenstruktur“ und „Bilder, Diagramme und
Tabellen“. Es wird jeweils ein Aufgabenbereich geöffnet. „Zur einfachen Ansicht“
schließt die Werkzeuge; bereits bearbeitete Felder bleiben erhalten.
Mehrere Originalbilder einer Word-Karte können gemeinsam übernommen
werden. Mehr als vier Bilder werden in weiteren Vorschlägen erhalten beziehungsweise
beim Zusammenführen ausdrücklich abgewiesen; es wird kein Bild still verworfen.

Jede OCR-Karte muss einzeln geprüft werden. Besonders Jahreszahlen, Kommas,
Einheiten, Eigennamen und Quellen vergleichen. Niedrige OCR-Werte werden mit
sprachlichen Hinweisen und „(?)“ markiert; hohe Werte sind keine Garantie für
Richtigkeit. Die individuelle Bestätigung steht direkt bei der aktuellen Karte.
Der Zähler nennt ungeprüfte OCR-Karten. Erst nach der Originalkontrolle und der
abschließenden Bestätigung übernimmt „Karten übernehmen“ die Karten. Bei
Text-PDFs genügt die gemeinsame Abschlusskontrolle. Das ersetzt keinen fachlichen
Gegencheck.

Bei „Neues Mystery aus dem Dokument erstellen“ wird der alte Dateipfad gelöst.
Das erste Sichern fragt nach einer neuen Projektdatei. Ein abgebrochener Import
oder Speicherdialog überschreibt das bisherige Projekt nicht.

HEIC/HEIF, Handschrift, automatische Perspektivkorrektur und ein englisches Modell
werden nicht zugesichert. Die Kameraaufnahme ist vom Betriebssystem abhängig und
noch kein bestandener realer Kameratest.

## Projekte lokal sichern

„Exportieren → Bearbeitbares Mystery sichern“ beziehungsweise ⌘S schreibt eine
validierte `.mysteryboard`-Datei mit dem nativen Speicherdialog. Auch ein leeres
oder unfertiges Projekt lässt sich so sichern. „Speichern unter“ im Exportdialog
oder ⇧⌘S legt eine weitere Datei an. Das native Menü „Ablage“ enthält dieselben
Dateibefehle, zusätzlich „Mystery öffnen“ (⌘O). Auf der Projektübersicht öffnen
„Mystery öffnen“ und „Zuletzt bearbeitete Projekte“ vorhandene Dateien erneut.
Die Liste letzter Projekte enthält lokale Dateiverweise und ist keine Sicherung.

Erst ein erfolgreich abgeschlossener Dateischreibvorgang setzt die native
Änderungskennzeichnung zurück. Beim Schließen wird vor ungesicherten Änderungen
oder noch offenen Bearbeitungsschritten gewarnt. **Es gibt keine automatische
Projektdatei- oder Cloud-Speicherung. Eine zusätzliche Notfallwiederherstellung
nach einem Prozessabsturz ist nicht implementiert.** Deshalb regelmäßig bewusst
sichern; bei einem unerwarteten Abbruch können nicht gesicherte Eingaben verloren
gehen. Bestehende Projektdateien werden atomar ersetzt und nicht als automatische
Notfallkopie überschrieben.

## Exportieren

### Druck-PDF

„Exportieren → Als Druck-PDF speichern“ erzeugt ausschneidbare Karten. Die
Vorschau zeigt sämtliche Seiten durch Scrollen. Unter „Druckoptionen“ können A4
oder A3, Hoch- oder Querformat, Titelseite, Leitfrage, Arbeitsauftrag und
Schwarz-Weiß gewählt werden. Ohne Änderungen gelten sinnvolle Vorgaben.

Text, Rahmen und Schnittmarken bleiben PDF-Text beziehungsweise Vektorpfade.
Fotos bleiben Bilder mit ihren vorhandenen Originalpixeln. Karten werden nicht
unbemerkt zwischen Seiten geteilt. Zu große Karten erhalten ein größeres Format;
passt eine Karte auch dann nicht lesbar, wird der Export mit einer Erklärung
abgewiesen. Bilder unter etwa 180 dpi in ihrer tatsächlichen Druckgröße lösen
einen Hinweis aus. Auch bei hohen dpi feine Legenden in der Vorschau prüfen;
Auflösung allein garantiert keine lesbare physische Beschriftungsgröße.

Nicht freigegebene Karten und reine Autorenpositionen erscheinen nicht im PDF.
Zusätzliche Druckoptionen gelten für diesen Export; Titel, Untertitel und die
Mystery-Gestaltung sind Projektinhalt.

### SCORM für itslearning

„Exportieren → Für itslearning exportieren“ erzeugt eine vollständige
SCORM-1.2-ZIP. Diese ZIP unverändert als SCORM-Ressource in itslearning importieren.
Die Aufgabe einschließlich Karten, Bildern, Tabellen, Quellen, Hilfen und
Startablage ist bereits eingebaut. Schüler müssen keine zusätzliche Datei öffnen.

Der separat gebaute Player enthält keine Autorenoberfläche, keine Autoren-
Styles, keinen Dokumentimport und keine OCR-Engine. Gemeinsame Formate und
Validatoren werden weiterhin aus demselben Anwendungskern verwendet.

Die Schüler geben ihre Teambezeichnung ein und arbeiten auf der gewohnten
Arbeitsfläche. Der vollständige Arbeitsstand wird bewusst als Original-PNG mit
dem Namen `Teamname_Mysterytitel.png` gesichert. Zum Fortsetzen im selben Mystery
„Fortsetzen“ und diese Originaldatei wählen. Ein Bildschirmfoto genügt nicht.
Andere Aufgaben und Inhaltsversionen werden nicht ungeprüft vermischt.

Es gibt keine dauerhafte Browser-Speicherung von Schüleraktivitäten, keine
Bewertung und keine Übertragung von Teamnamen, Antworten oder Spielständen an
das LMS. Der bestehende SCORM-Rahmen verwendet ausschließlich seinen bisherigen
Initialize-/Finish-Lebenszyklus. Ein Inhaltsupdate benötigt einen neuen Export und
einen erneuten manuellen Import in itslearning.

### Autorenbild

„Als Bild exportieren“ erzeugt eine Aufgabenübersicht. Dies ist ausdrücklich eine
andere Rolle als die vollständige Schüler-PNG-Sicherung. Es werden keine
Schülerbeziehungen oder Musterlösungen aus der Autorenpinnwand veröffentlicht.

## Grenzen und Prüfung vor dem Unterricht

Pro Mystery höchstens 100 Karten; die bestehenden Dokument-, Bild-, PNG- und
HTML-Grenzen bleiben wirksam. Neue optionale Gestaltungs-/Medienfelder werden von
aktueller Studio-/Player-Software gelesen. Ältere, bereits ausgelieferte
Einzel-HTMLs werden nicht rückwirkend aktualisiert und können solche neuen
Erweiterungen zurückweisen. Alte gültige Dateien bleiben im aktuellen Kern lesbar.

Vor dem Einsatz auf dem eigenen Mac und in der tatsächlichen Schulumgebung:
Start und Gatekeeper-Freigabe, Quellen-/Bildkontrolle, Ausdruck mit lesbaren
Legenden, echter itslearning-Start und vollständige PNG-Wiederherstellung auf den
verwalteten Schul-iPads prüfen. Die Cloud-Prüfungen sind keine schulische Freigabe.
