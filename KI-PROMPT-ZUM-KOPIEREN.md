# MysteryBoard – diesen Auftrag zusammen mit dem Projektordner und Material kopieren

Du erhältst den vollständigen Projektordner „MysteryBoard-Universal-Projektvorlage“ und mein Ausgangsmaterial als Foto, Scan, PDF oder Dokument. Übertrage mein vorhandenes Mystery in diese bestehende Universalvorlage. Entwickle keine neue Anwendung und ändere keine Programmfunktionen, um mein Thema einzubauen.

Lies zuerst START-HIER.md, AI-ANLEITUNG.md und docs/UNIVERSAL-FORMAT.md. Verwende die vorhandenen Inhalts- und Dokumentenschemata sowie dieselben Validierungs- und Erzeugungsskripte wie die Anwendung.

## Inhalt sorgfältig und nachvollziehbar übernehmen

1. Erfasse Aufgabenstellung, alle Karten, Überschriften, Fließtexte, Zahlen, Einheiten, Tabellen, Legenden und Quellen. Ordne jedes Element eindeutig seiner Originalkarte und Originalseite zu. Vergleiche jede Übertragung anschließend erneut mit dem Original.
2. Erfinde nichts, was im Original nicht erkennbar oder ausdrücklich beauftragt ist. Kennzeichne unlesbare Stellen und fehlende Angaben im gesonderten Übergabeprotokoll. Stelle präzise Rückfragen. Gib eine unvollständige Übertragung nicht als fachlich vollständige Schülerversion aus. Nur nach ausdrücklicher Freigabe dürfen sichtbare Unsicherheitsmarker in die Schülerkarten übernommen werden.
3. Unterscheide Originaltexte, notwendige technische Anpassungen und fachliche Überarbeitungen. Korrigiere unklare oder möglicherweise falsche fachliche Aussagen nicht stillschweigend. Schlage Änderungen separat vor und warte bei inhaltlichen Entscheidungen auf meine Antwort.
4. Verwende eindeutige, fortlaufende Karten-IDs von 1 bis n. Dokumentiere bei abweichender Originalnummerierung eine Zuordnung Originalnummer → neue Nummer. Reihenfolge und Nummern sind Orientierung, keine vorgegebene Lösungskette.
5. Übernimm die Zuordnung zu Pflicht- und Vertiefungskarten aus meinem Material. Sie wird ausdrücklich je Karte über Gruppenmetadaten festgelegt. Fehlt die Zuordnung, frage nach; leite sie nicht aus einer vermeintlich üblichen Pflichtkartenanzahl ab. Die sichtbaren Präfixe bleiben konfigurierbar.
6. Bette rechtmäßig verwendbare Fotos, Karten und Diagramme als tatsächliche PNG-/JPEG-/WebP-Bilddaten ein. Bewahre Seitenverhältnis, Achsen, Zahlen und Legenden; prüfe die Lesbarkeit im Lesefenster und im Druck. Verlinkte Bilder oder lokale Dateipfade genügen nicht. Übernimm Tabellen nach Möglichkeit als bearbeitbare Tabellenwerte und vergleiche jede Zelle. Bewahre die Originalmedien zusätzlich für die Kontrolle auf.
7. Übernimm Quellen unverändert und dokumentiere Herkunft, Rechte und gegebenenfalls Lizenz der Medien. Behaupte keine Nutzungsrechte, die du nicht geprüft hast. Frag bei fehlenden Rechten nach oder biete separat rechtmäßig verwendbare Alternativen an.
8. Baue keine Musterlösung, Lösungspfeile, automatische fachliche Sortierung oder Bewertung in die Schülerversion ein. Nutze eine neutrale numerische Startablage. Hilfekategorien nur bei ausdrücklicher Beauftragung: freiwillig, anfänglich ausgeblendet, eindeutige Namen/Farben, höchstens eine Gruppe je markierter Karte; unmarkierte Karten bleiben zulässig. Keine fachliche Zuordnung ohne Prüfung.

## Bestehendes Format und Werkzeuge verwenden

9. Erstelle eine vollständige Inhaltsdatei, danach eine direkt importierbare `.mysteryboard`-Aufgabe und einen vollständigen erneut bearbeitbaren Lehrkraftentwurf. Beide enthalten alle Karten und eingebetteten Medien. Die Aufgabe enthält keine Autoren- oder Schülerarbeitsdaten. Verwende das vorhandene Dokumentformat Version 3; erfinde keine zweite Dateistruktur und keine Prüfsumme.
10. Verwende nach Installation der dokumentierten kostenlosen Werkzeuge die vorhandene Routine, beispielsweise:

```sh
npm ci
npm run validate:mystery -- ausgabe/inhalt.json
npm run create:mystery -- ausgabe/inhalt.json ausgabe/Meine-Aufgabe.mysteryboard
npm run validate:mystery -- ausgabe/Meine-Aufgabe.mysteryboard
```

Der Validator benötigt Chromium; falls kein System-Chromium vorhanden ist, installiere den in der Projektanleitung genannten Playwright-Browser. Er prüft neben Schemata und Referenzen auch die tatsächlichen Bilddaten. Erzeuge den Lehrkraftentwurf im vorhandenen Editor über Entwurf sichern oder mit der vorhandenen Funktion draftFromContent und encodeDocument aus dem gemeinsamen Kern; danach ebenfalls mit demselben CLI-Validator prüfen. Kennzeichne einen Entwurf ohne erfolgte menschliche Inhaltsprüfung weiterhin als in Bearbeitung.

11. Prüfe die tatsächlich erzeugten Dateien, nicht nur eine vermutete Datenstruktur. Öffne sie in der mitgelieferten Universal-HTML. Kontrolliere alle Texte, Tabellenzellen, Quellen, Nummern, Pflicht-/V-Markierungen und Bilder. Ändere probeweise eine Karte und ein Bild, sichere den Entwurf, öffne ihn frisch und erzeuge erneut eine Schülerversion. Falls keine Browserausführung möglich ist, benenne das ausdrücklich als offene Prüfung.
12. Prüfe die Schülerversion in der universellen SCORM-Anwendung, sofern die Werkzeuge verfügbar sind: Aufgabe öffnen, Teamnamen vergeben, Karten/Verbindung ändern, Original-PNG tatsächlich herunterladen, Anwendung schließen und PNG in neuer Sitzung vollständig wiederherstellen. Keine dauerhafte Übertragung von Arbeitsdaten oder Bewertungen an die Lernplattform ergänzen.
13. Bewahre die ursprüngliche Aufgabe unverändert. Eine überarbeitete Fassung erhält dieselbe Mystery-ID mit neuer Inhaltsversion; eine andere Aufgabe eine neue ID. Prüfsummen werden über die vorhandenen Werkzeuge neu berechnet. Alte Schülerarbeiten enthalten ihre eigene Fassung und dürfen nicht mit einer neuen Fassung vermischt werden.

## Tatsächlich liefern und ehrlich berichten

Liefere mir:

- die vollständige Inhaltsdatei;
- die validierte, direkt nutzbare Schülerversion `.mysteryboard`;
- den erneut bearbeitbaren Lehrkraftentwurf `.mysteryboard`;
- alle nötigen Original-/Vergleichsmedien und eine Originalkarte-zu-Ausgabekarte-Tabelle;
- ein Protokoll mit systematischem Vergleich jedes Kartentexts, jeder Zahl, Tabelle, Legende und Quelle;
- ausgeführte Prüfungen mit Befehlen, Ergebnissen, Dateigrößen und SHA-256-Prüfsummen;
- getrennte Listen offener Lesestellen, fachlicher Rückfragen, Rechtefragen und noch fehlender Geräteprüfungen.

Behaupte keine erfolgreiche Fremd-KI-, Browser-, itslearning- oder Schul-iPad-Prüfung, die du nicht tatsächlich ausgeführt hast. Ohne menschliche Inhalts- und echte Schulgeräteprüfung keine schulische Freigabe. Keine kostenpflichtigen Dienste einsetzen oder neue KI-/OCR-Schnittstellen, Server, Benutzerkonten oder automatische Speicherung in MysteryBoard einbauen. Keine Veröffentlichung, keinen Merge und keine Änderung bestehender Release-Tags vornehmen.
