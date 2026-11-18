# MysteryBoard Universal – Entwicklungsphase Dokumentimport für Lehrkräfte

## 1. Ziel

Erweitere die bestehende universelle MysteryBoard-Anwendung um einen einfach bedienbaren, vollständig lokal arbeitenden Importassistenten für vorhandene Unterrichtsmaterialien.

Lehrkräfte sollen Word-Dokumente und PDF-Dateien direkt innerhalb von MysteryBoard auswählen, auslesen, in einzelne Mystery-Karten aufteilen und anschließend in den vorhandenen Lehrkräfteeditor übernehmen können.

Die Nutzung darf keine KI, keine Internetverbindung nach dem Laden der Anwendung, keine Benutzerkonten und keine kostenpflichtigen Dienste erfordern.

**Diese Entwicklungsrunde umfasst Word (.docx) und PDF-Dateien mit auslesbarer Textebene. Foto- und Scan-OCR ist ausdrücklich eine spätere zweite Entwicklungsphase.**

## 2. Ausgangsstand und Versionsschutz

Repository: `Feerson1617/Vorlage-Mysteryboard`

Ausgangsbranch:
`feat/mysteryboard-universal-release-candidate`

Ausgangscommit:
`35019c364ffef026482250ec75042b38e138fe18`

Erstelle einen neuen Feature-Branch:

`feat/mysteryboard-local-document-import`

Verwende ausschließlich die bestehende MysteryBoard-Architektur.

Unverändert erhalten bleiben:

- Universeller Lehrkräfteeditor
- Bestehendes Mystery-Datenformat Version 3
- Automatische Kartennummerierung
- Pflicht- und Vertiefungskarten
- Nummerisch sortierte Startablage
- Hilfetext- und Hilfekategorien-Editor
- Suche und Mehrfachzuordnung
- Schüler-Vorschau
- Touch- und Pinch-to-Zoom-Steuerung
- Medienvergrößerung
- Undo/Redo
- Original-PNG-Sicherung und Wiederherstellung
- A4-/A3-Druckfunktion
- Universeller SCORM-1.2-Player
- Offline-Funktion
- Versionsschutz für bestehende Schülerarbeiten

Das abgeschlossene Boden-Mystery RC2 darf nicht verändert werden.

Kein Merge in `main`, keine Änderung bestehender Release-Tags, keine öffentliche Veröffentlichung.

## 3. Technische Architektur

Prüfe zunächst den vorhandenen Build, die SCORM-Verpackung und die bestehenden Datenmodelle.

Für den Dokumentimport können geeignete kostenlose Open-Source-Bibliotheken eingesetzt werden.

Bevorzugte Kandidaten:

- `mammoth` für DOCX
- `pdfjs-dist` für PDF

Prüfe vor der Integration aktuelle Bibliotheksversionen, Lizenzbedingungen, Browserkompatibilität, Paketgröße, Sicherheitsrisiken und die Eignung für iPadOS/Safari.

Alle notwendigen Laufzeitressourcen müssen lokal in der Anwendung beziehungsweise dem SCORM-Paket enthalten sein.

Keine CDN-Verweise und keine Verarbeitung über externe Server.

Die Importbibliotheken sollen erst geladen werden, wenn die Lehrkraft den Dokumentimport öffnet. Die normale Schüleransicht darf dadurch nicht unnötig langsamer oder speicherintensiver werden.

Bei zusätzlichen PDF-Workern oder anderen Dateien müssen alle lokalen Verweise im SCORM-Manifest korrekt enthalten sein.

Die bisherige Größenbegrenzung der HTML und die Speicherbelastung auf Schul-iPads prüfen. Wenn die bisherigen Grenzen mit einem vollständig integrierten Import technisch nicht eingehalten werden können, dokumentiere den Konflikt und entwickle eine nachvollziehbare Lösung mit optionalen lokalen Importressourcen. Keinesfalls die Offlinefähigkeit stillschweigend aufgeben.

## 4. Einfacher Einstieg im Lehrkräftemodus

Ergänze in den bestehenden Lehrkräfteeditor eine Schaltfläche:

**„Dokument importieren“**

Darunter gegebenenfalls ein kurzer Hinweis:

„Karten aus einer Word- oder PDF-Datei übernehmen.“

Nach dem Anklicken erscheint ein übersichtlicher Importassistent.

Keine separate Autorenanwendung und keine neue Startseite notwendig.

Die Oberfläche muss dieselbe ruhige Gestaltung verwenden wie der bisherige Lehrkräfteeditor.

Keine auffälligen Farben, übergroßen Überschriften oder technischen Begriffe.

## 5. DOCX-Import

Unterstütze `.docx`.

Nicht unterstützte ältere `.doc`-Dateien müssen mit verständlichem Hinweis zurückgewiesen werden.

Verarbeite vorhandene Dokumente lokal.

Extrahiere nach Möglichkeit:

- Überschriften
- Absätze
- Aufzählungen
- Tabellen
- Eingebettete Bilder
- Quellenangaben
- Erkennbare Kartenüberschriften
- Dokumentstruktur

Strukturierte Word-Tabellen sollen möglichst als bearbeitbare MysteryBoard-Tabellen übernommen werden.

Alle Tabellenwerte und Einheiten müssen erhalten bleiben.

Unterstütze mehrere Karten innerhalb eines Word-Dokuments.

Die Erkennung soll anhand vorhandener Strukturmerkmale mögliche Kartengrenzen vorschlagen.

**Keine automatische fachliche Interpretation.**

Eine Überschrift darf nicht allein deshalb zum Kartentitel werden, weil sie groß formatiert ist.

Die Lehrkraft muss sämtliche vorgeschlagenen Grenzen kontrollieren und verändern können.

## 6. PDF-Import

Unterstütze PDF-Dateien mit auslesbarer Textebene.

Die Anwendung soll:

1. Das PDF lokal öffnen.
2. Die vorhandenen Seiten anzeigen.
3. Textinformationen extrahieren.
4. Mögliche Kartenbereiche erkennen.
5. Kartentexte zur Überprüfung bereitstellen.

Berücksichtige:

- Mehrspaltige Seiten
- Unterschiedliche Schriftgrößen
- Kartenrahmen
- Mehrere Karten pro Seite
- Tabellen
- Diagramme und Bilder
- Seitenübergreifende Texte

Die extrahierte Reihenfolge muss nicht immer der visuellen Reihenfolge entsprechen.

Kennzeichne unsichere Zuordnungen und ermögliche ihre Korrektur.

Wenn eine PDF-Seite nicht sinnvoll in einzelne Karten aufgeteilt werden kann, muss die Lehrkraft Textbereiche manuell auswählen beziehungsweise bearbeiten können.

Eine PDF-Seite soll bei Bedarf lokal als Bild gerendert werden können, damit eine Karte ein ausgewähltes Diagramm oder einen Ausschnitt als Grafik erhält.

Das Seitenverhältnis bleibt erhalten.

PDF-Tabellen dürfen nur dann automatisch als strukturierte Tabellen übernommen werden, wenn ihre Zellstruktur zuverlässig erkannt wurde.

Andernfalls bleibt eine manuelle Korrektur oder die Übernahme als Bild möglich.

### PDF ohne auslesbaren Text

Bei gescannten PDFs ohne Textebene darf die Anwendung keine Texterkennung vortäuschen.

Zeige verständlich:

„Dieses PDF enthält keinen auslesbaren Text. Sie können eine Seite als Bild übernehmen. Die automatische Texterkennung ergänzen wir später.“

Eine vollständige OCR-Funktion gehört nicht zu dieser Entwicklungsphase.

## 7. Importassistent mit drei klaren Schritten

### Schritt 1 – Datei auswählen

Schaltfläche:

„Word- oder PDF-Datei auswählen“

Zeige anschließend:

- Dateiname
- Dateiformat
- Seitenzahl, sofern verfügbar
- Anzahl erkannter Textbereiche
- gegebenenfalls Anzahl enthaltener Bilder

Fehler verständlich beschreiben.

Beispiel:

„Die Datei konnte nicht gelesen werden. Bitte überprüfen Sie, ob es sich um eine gültige Word- oder PDF-Datei handelt.“

### Schritt 2 – Karten prüfen

Die Lehrkraft soll möglichst übersichtlich das Original und die erkannten Karten vergleichen können.

Auf größeren Bildschirmen können beide Bereiche nebeneinander stehen.

Auf schmalen iPad-Bildschirmen muss zwischen Original und Kartenansicht gewechselt werden können, ohne Eingaben zu verlieren.

Jede erkannte Karte erhält:

- vorläufige Kartennummer
- bearbeitbare Überschrift
- bearbeitbaren Text
- Vorschau zugeordneter Bilder
- gegebenenfalls strukturierte Tabelle
- Auswahl Pflichtkarte oder Vertiefungskarte

Ermögliche:

- Karte hinzufügen
- Karte entfernen
- Text korrigieren
- Zwei Textbereiche zusammenfügen
- Einen Textbereich in zwei Karten teilen
- Bild einer anderen Karte zuordnen
- Kartengrenzen korrigieren

Die Lehrkraft muss die vorgeschlagene Gliederung nicht übernehmen.

Unsichere Stellen eindeutig markieren.

**Keine erfundenen Zahlen, Wörter, Einheiten, Quellen oder Kartenzuordnungen.**

### Schritt 3 – Karten übernehmen

Nach Prüfung übernimmt die Lehrkraft die ausgewählten Karten in den vorhandenen MysteryBoard-Lehrkräfteeditor.

Verwende die bestehenden Funktionen für:

- Datenvalidierung
- Kartennummerierung
- Pflicht-/Vertiefungszuordnung
- Bilder
- Tabellen
- Hilfefunktionen
- Export
- Inhaltsversionen

Kein zweites Kartenmodell entwickeln.

Der Importassistent ist nur eine Eingabehilfe für das bestehende Dokumentformat.

## 8. Bestehende Entwürfe schützen

Der Import kann sowohl bei einem neuen Mystery als auch bei einem bereits geöffneten Lehrkraftentwurf verwendet werden.

Bei einem bestehenden Entwurf muss die Lehrkraft wählen können:

- „Karten zu diesem Mystery hinzufügen“
- „Neues Mystery aus dem Dokument erstellen“

Eine bereits begonnene Arbeit darf niemals ohne ausdrückliche Bestätigung überschrieben werden.

Vor einem möglichen Ersetzen muss ein Hinweis auf ungesicherte Änderungen erscheinen.

Ein abgebrochener Import darf vorhandene Titel, Karten, Medien, Hilfen und Entwurfsdaten nicht verändern.

Erst beim ausdrücklich bestätigten Übernehmen werden die neuen Karten in den Entwurf eingefügt.

Alle übernommenen Daten müssen vor der Übernahme mit dem vorhandenen MysteryBoard-Validator geprüft werden.

## 9. Medien und Datenintegrität

Verwende die bereits bestehenden MysteryBoard-Grenzen für Bildgröße, Auflösung und Gesamtmedienumfang.

Prüfe zusätzlich angemessene maximale Importdateigrößen und Seitenzahlen.

Sichere die Anwendung gegen:

- Beschädigte DOCX-/PDF-Dateien
- Übermäßig große Dateien
- Komprimierungsbomben
- Ungewöhnlich große eingebettete Medien
- Fehlerhafte Zeichenkodierungen
- Versteckte ausführbare Inhalte
- Externe Links oder Ressourcen
- JavaScript in importierten Inhalten
- Übermäßige Arbeitsspeichernutzung
- Abbruch während des Imports

Wichtig für Mammoth:

Die HTML-Ausgabe darf niemals ungeprüft als ausführbares HTML in die Anwendung übernommen werden.

Extrahiere ausschließlich ausdrücklich erlaubte Text-, Tabellen- und Bilddaten. Keine Skripte, Eventhandler oder fremden URLs übernehmen.

Die ursprüngliche Datei bleibt auf dem Gerät der Lehrkraft.

Keine Serverübertragung und keine automatische Speicherung im Browser oder LMS.

Bei Importfehlern muss der bisherige Lehrkraftentwurf unverändert erhalten bleiben.

## 10. Bedienung aus Lehrkraftperspektive prüfen

Die Zielgruppe sind Lehrkräfte ohne Programmierkenntnisse.

Simuliere folgenden Auftrag:

„Ich habe ein Mystery als Word-Dokument. Bitte übernehmen Sie die Karten in MysteryBoard, kontrollieren Sie die Texte und stellen Sie anschließend eine Schülerversion für die Klasse bereit.“

Die Anwendung muss dabei selbsterklärend sein.

Prüfe:

- Wie viele Bedienhandlungen sind nötig?
- Sind alle Schaltflächen sofort verständlich?
- Ist erkennbar, was bereits übernommen wurde?
- Ist das Original jederzeit zum Vergleich verfügbar?
- Kann die Lehrkraft Fehler unkompliziert korrigieren?
- Werden Pflicht- und Vertiefungskarten klar unterschieden?
- Ist eindeutig, wann der Import abgeschlossen ist?
- Ist der Unterschied zwischen Import, Entwurf sichern und Schülerversion erstellen verständlich?

Unnötige Dialoge und Klicks reduzieren.

Keine zusätzliche Komplexität in der Schüleransicht.

## 11. Verbindliche Testdokumente

Erstelle eigene Testdateien für mindestens folgende Fälle:

**A – Einfaches Word-Mystery**

Zwölf Karten, davon neun Pflicht- und drei Vertiefungskarten, klare Überschriften.

**B – Word mit Medien und Tabelle**

Mindestens sechs Karten, zwei Bilder und eine strukturierte Tabelle mit Messwerten.

**C – PDF mit einzelnen Karten**

Zwölf Karten auf mehreren Seiten.

**D – PDF mit komplexem Layout**

Mehrspaltige Texte, Bilder, Diagramme und mehrere Karten auf einer Seite.

**E – Gescanntes PDF ohne Textebene**

Prüft die verständliche Ablehnung einer vermeintlichen Texterkennung sowie die optionale Übernahme einer Seite als Bild.

**F – Beschädigte oder manipulierte Dateien**

Prüft Sicherheit, Fehlermeldungen und Erhalt eines bereits bestehenden Entwurfs.

Die Dokumente müssen echte DOCX- und PDF-Dateien sein, keine bloß umbenannten Textdateien.

Vergleiche die erkannten Inhalte anschließend unabhängig mit den Originalen.

## 12. Vollständiger End-to-End-Test

Führe mit der tatsächlich erzeugten HTML folgende Schritte durch:

1. Universelle MysteryBoard-Vorlage öffnen.
2. Lehrkräftemodus aufrufen.
3. Vorhandenes Word-Mystery importieren.
4. Sämtliche erkannten Karten und Texte prüfen.
5. Eine Kartengrenze korrigieren.
6. Eine Karte ergänzen.
7. Eine Karte entfernen.
8. Ein Bild ersetzen.
9. Eine Tabelle bearbeiten.
10. Pflicht-/Vertiefungskarten festlegen.
11. Bestehende Hilfefunktion konfigurieren.
12. Entwurf als `.mysteryboard` sichern.
13. Anwendung vollständig schließen.
14. Entwurf in einer neuen Sitzung öffnen.
15. Sämtliche Inhalte vergleichen.
16. Schülerversion erstellen.
17. Schülerversion in der universellen SCORM-Anwendung öffnen.
18. Teamname eingeben.
19. Karten verschieben und verbinden.
20. Pinch-to-Zoom verwenden.
21. Original-PNG sichern.
22. In einer neuen SCORM-Sitzung vollständig wiederherstellen.
23. Arbeitsstand weiterbearbeiten.

Führe denselben Import- und Veröffentlichungsweg mindestens einmal mit einem echten textbasierten PDF durch.

Alle Schritte müssen eigenständig mit Chromium ausgeführt werden.

Prüfe sowohl große Desktop-Bildschirme als auch 1024 × 768, 768 × 1024, 600 × 800 und 320 × 700 CSS-Pixel.

Teste Eingaben und Interaktionen mit Touch.

Weder frühere Testprotokolle noch Aussagen aus dem Quellcode gelten als Ersatz für tatsächliche Funktionsprüfungen.

## 13. Regressionen und Leistungsfähigkeit

Alle vorhandenen Tests müssen bestehen.

Insbesondere:

- R1/R1b-Touch-Regressionen
- Pinch-to-Zoom
- Kartenziehen und Arbeitsflächenverschieben
- Numerische Startablage
- Karteneditor
- Hilfeeditor
- PNG-/QR-Sicherung
- SCORM-Dokumentimport
- Offline-Betrieb
- Versionsschutz
- A4-/A3-Druck
- 60 Karten und 220 Verbindungen
- Manipulierte Mystery-Dateien
- Alte Schülerstände

Untersuche zusätzlich, ob die Importbibliotheken die Startgeschwindigkeit der Schüleransicht oder den Speicherverbrauch auf iPads merklich beeinflussen.

Prüfe bei großen Dokumenten, ob ein Import abgebrochen werden kann und danach alle Funktionen weiterhin nutzbar sind.

Ein tatsächlicher Safari-/Schul-iPad-Test muss als offen gekennzeichnet bleiben, wenn keine passende Umgebung vorhanden ist.

## 14. Lieferung

Erstelle einen neuen Commit und pushe ausschließlich in den neuen Feature-Branch.

Stelle folgende Dateien bereit:

- `MysteryBoard-Dokumentimport-Abnahmepaket.zip`
- `MysteryBoard-Universal-Projektvorlage.zip`
- `MysteryBoard-Universal-SCORM-1.2.zip`
- `MysteryBoard-Universal.html`

Das Abnahmepaket enthält:

- Tatsächlich lauffähige HTML
- Tatsächlich lauffähige SCORM-ZIP
- Alle Test-DOCX- und Test-PDF-Dateien
- Ausgangsmaterialien zum Originalvergleich
- Importierte Mystery-Dateien
- Bearbeitbare Lehrkraftentwürfe
- Schüler-Sicherungs-PNGs
- Screenshots
- Vollständige Browser-Testprotokolle
- Prüfsummen
- Dokumentierte Grenzen und offene Probleme
- Reproduzierbare Testskripte

Die aktualisierte Projektvorlage muss weiterhin vollständig für andere KIs nutzbar sein.

Alle ZIP-Dateien tatsächlich erstellen, entpacken und auf Vollständigkeit prüfen.

## 15. Wichtigste Entwicklungsregeln

Keine neue Anwendung entwickeln.

Keine neue MysteryBoard-Datenstruktur einführen.

Keine künstlich intelligente Kartenerkennung behaupten.

Keine unbelegten Textinhalte ergänzen.

Keine automatische Veröffentlichung ungeprüfter Karten.

Keine externen Server, Benutzerkonten oder kostenpflichtigen Dienste.

Keine Veränderungen der abgeschlossenen Boden-RC2.

Kein Merge in `main`.

**Abnahmekriterium: Eine Lehrkraft kann ein vorhandenes Word-Dokument oder textbasiertes PDF direkt in MysteryBoard übernehmen, die erkannten Karten einfach kontrollieren und anschließend ohne technische Kenntnisse eine vollständig funktionsfähige Schülerversion für das universelle itslearning-SCORM erzeugen.**