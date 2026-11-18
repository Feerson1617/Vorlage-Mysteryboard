# MysteryBoard – Release Candidate, unabhängige Endabnahme und Vorbereitung der Weitergabe an Lehrkräfte

## 1. Ausgangslage

Repository: `Feerson1617/Vorlage-Mysteryboard`

Aktueller Entwicklungsbranch: `feat/mysteryboard-help-editor-final`

Aktueller Commit: `ae0f4cba54522752474bc474ac43a6b878b38751`

Die universelle Anwendung mit Lehrkräftemodus, zweistufiger Hilfefunktion, Karteneditor, Medien, SCORM, Touch-Steuerung und portablem Speicherformat ist inzwischen weitgehend fertiggestellt.

In der letzten Entwicklungsrunde wurden die Schüler-Vorschau vom normalen Unterrichtsmodus getrennt und die Karten-Zuordnung um Suche und optionale Mehrfachauswahl erweitert.

Diese Neuerungen sind im Quellcode vorhanden. Die Hilfsfunktionen haben unabhängige Logiktests bestanden. Eine vollständige unabhängige Browserabnahme des neuesten HTML-Builds steht noch aus.

**Ziel dieser Runde ist ein verlässlich nutzbarer und an andere Lehrkräfte weitergebbarer Release Candidate.**

Keine neue Architektur entwickeln.

## 2. Zuerst die aktuelle Version endgültig abnehmen

Bevor weitere Anpassungen vorgenommen werden:

1. Den aktuellen Feature-Branch vollständig prüfen.
2. Das tatsächlich aktuelle HTML-Build und die SCORM-ZIP neu erzeugen.
3. Die vollständige vorhandene Testsuite ausführen.
4. Ein frisches, eigenständig nutzbares Abnahmepaket erstellen.
5. Das Paket nach dem Verpacken erneut entpacken.
6. Die enthaltene Anwendung direkt aus dieser Lieferung im Browser ausführen.

Besonders prüfen:

- Hilfeeditor mit fünf Denkimpulsen
- Auswahl der beiden Farbgruppierungen
- Eigene Hilfekategorien
- Einzel- und Mehrfachzuordnung
- Suche nach Kartennummer und Kartentitel
- Korrekte Berücksichtigung von Vertiefungskarten
- Wechsel zwischen Vorlagen
- Eindeutige Fehler- und Speicherhinweise
- Schüler-Vorschau ohne Sicherungs-, Import- oder Druckfunktion
- Vollständiges Verwerfen aller Vorschauveränderungen
- Entwurf sichern und erneut importieren
- Schülerversion erstellen
- SCORM importieren und bearbeiten
- Original-PNG sichern und wiederherstellen

Die bestehenden Funktionen für Pinch-to-Zoom, Kartenziehen, Beziehungen, Undo/Redo und Druck dürfen nicht verändert werden.

Prüfe sowohl zwölf als auch sechzig Karten.

Verwende 1024 × 768, 768 × 1024, 600 × 800 und 320 × 700 CSS-Pixel.

Führe reale Chromium-Browseraktionen aus. Quellcodeaussagen oder zuvor gespeicherte Testprotokolle reichen nicht.

### Abnahmekriterium

Der gesamte Lehrkraft–Schüler–Wiederherstellungs-Kreislauf funktioniert ohne unerwartete Datenverluste, Fehlermeldungen oder Bedienabbrüche.

Wenn ein Fehler nachgewiesen wird, korrigiere ihn gezielt und wiederhole die betroffenen Regressionen.

---

# Teil A – Bedienung für Lehrkräfte vereinfachen

## 3. MysteryBoard muss ohne technische Vorkenntnisse verständlich sein

Der zentrale Maßstab lautet:

Eine Lehrkraft soll beim ersten Öffnen verstehen, wie sie ein Mystery erstellt, bearbeitet, sichert und für ihre Klasse bereitstellt.

Untersuche die bestehende Oberfläche daraufhin erneut kritisch.

Prüfe besonders:

- Eindeutige Schaltflächenbezeichnungen
- Logische Reihenfolge der Arbeitsschritte
- Einheitliche deutsche Anrede
- Keine unnötigen Fachbegriffe aus der Programmierung
- Verständliche Dateibezeichnungen
- Klare Unterscheidung zwischen Entwurf und Schülerversion
- Keine unklare Unterscheidung zwischen „Übernehmen“, „Sichern“ und „Herunterladen“
- Keine technisch überladenen Menüs
- Gute Erreichbarkeit auf dem iPad

Vermeide knallige Überschriften, überflüssige Farben, Animationen und zusätzliche Werkzeugleisten.

Führe nur nachweislich sinnvolle kleine Anpassungen aus.

## 4. Den drei wichtigsten Arbeitswegen klare Einstiege geben

MysteryBoard soll folgende Wege verständlich unterstützen:

**A – Eigenes Mystery erstellen**

Die Lehrkraft beginnt mit einer leeren Vorlage und erstellt ihre Karten innerhalb der Anwendung.

**B – Vorhandenes Mystery bearbeiten**

Die Lehrkraft lädt eine bereits veröffentlichte `.mysteryboard`-Datei und verändert Inhalte, Medien und Hilfen.

**C – Mystery von einer KI übernehmen**

Die Lehrkraft erhält eine von einer KI erstellte `.mysteryboard`-Datei, öffnet sie im Lehrkräftemodus und kann sie vollständig weiterbearbeiten.

Alle drei Wege müssen denselben gemeinsamen Anwendungskern und dasselbe Dokumentformat verwenden.

Prüfe, ob die vorhandene Oberfläche diese Möglichkeiten bereits ausreichend verständlich darstellt. Ergänze nur fehlende, wirklich notwendige Orientierung.

---

# Teil B – Projektvorlage für andere Lehrkräfte und KIs

## 5. Vollständigen weitergabefähigen Projektordner vorbereiten

Erzeuge die fertige:

`MysteryBoard-Universal-Projektvorlage.zip`

Der Ordner muss unabhängig vom bisherigen Codex-Chat verwendbar sein.

Er enthält:

- Gesamten Quellcode
- Universelle HTML
- Universelle SCORM-1.2-ZIP
- Gemeinsame Mystery-Datenformate
- Maschinenlesbare Inhalts- und Dokumentenschemata
- Vollständige Build- und Validierungsskripte
- Lehrkräfteeditor und Hilfeeditor
- KI-Anleitung
- Lehrkräfteanleitung
- Geeignete Beispieldateien
- Automatisierte Regressionstests
- Prüfsummen und eindeutige Versionierung

Keine Zugangsdaten, API-Schlüssel oder lokalen Cloud-Pfade.

Keine externen Laufzeitressourcen.

Es darf keine kostenpflichtige Software zur Verwendung der fertigen Anwendung erforderlich sein.

## 6. Eine kurze START-HIER-Anleitung integrieren

Die umfangreiche technische KI-Anleitung bleibt erhalten.

Zusätzlich benötigt der Projektordner eine **kurze, wirklich leicht verständliche Einstiegsanleitung für Lehrkräfte**.

Datei:

`START-HIER.md`

Diese soll maximal etwa zwei Seiten umfassen.

Erkläre ohne technische Vorkenntnisse:

- Wie öffne ich die Software?
- Wie erstelle ich selbst ein Mystery?
- Wie lasse ich eine KI ein vorhandenes Mystery übertragen?
- Welche Datei gebe ich meinen Schülerinnen und Schülern?
- Was muss ich einmalig in itslearning hochladen?
- Wie kann ich eine bereits erstellte Aufgabe später ändern?
- Wie speichern die Schülerinnen und Schüler ihre Ergebnisse?

Vermeide Programmierbegriffe, wo sie für die Nutzung nicht notwendig sind.

Die ausführliche technische Dokumentation bleibt separat verfügbar.

## 7. Einen fertigen Prompt für andere KIs bereitstellen

Erstelle:

`KI-PROMPT-ZUM-KOPIEREN.md`

Darin steht ein vollständig ausformulierter Prompt, den eine Lehrkraft zusammen mit dem Projektordner und ihrem Material an eine KI ihrer Wahl geben kann.

Beispielhafter Auftrag:

„Übertrage das beigefügte Mystery in die MysteryBoard-Vorlage. Bewahre alle erkennbaren Informationen, Kartentexte und Quellen. Erstelle daraus eine vollständige, direkt importierbare Mystery-Datei sowie einen bearbeitbaren Lehrkraftentwurf. Prüfe anschließend alle Inhalte und technischen Anforderungen.“

Der vollständige Prompt muss präziser sein und insbesondere verlangen:

1. Text aus Fotos, Scans oder Dokumenten sorgfältig übernehmen.
2. Nichts erfinden, was auf dem Original nicht erkennbar ist.
3. Unlesbare Stellen ausdrücklich kennzeichnen.
4. Originaltexte und fachliche Überarbeitungen unterscheiden.
5. Karten korrekt nummerieren.
6. Pflicht- und Vertiefungskarten korrekt kennzeichnen.
7. Bilder, Karten und Diagramme korrekt einbetten.
8. Quellen und gegebenenfalls Bildrechte berücksichtigen.
9. Keine Musterlösung in die Schülerversion einbauen.
10. Eine gültige `.mysteryboard`-Datei erzeugen.
11. Dieselbe Datei mit dem vorhandenen Validator prüfen.
12. Eine vollständige, erneut bearbeitbare Lehrkraftdatei bereitstellen.
13. Unklare fachliche Aussagen nicht stillschweigend korrigieren.
14. Das Ergebnis mit dem ursprünglichen Material systematisch vergleichen.

Keine neue integrierte KI, kein OCR-Dienst und keine API-Anbindung in MysteryBoard entwickeln.

---

# Teil C – Praxistest des KI-Arbeitswegs

## 8. Ein vollständiges Mystery unabhängig aus einer Papier- oder Bildvorlage übertragen

Erstelle ein neutrales Test-Mystery als druckbare Originalvorlage.

Es soll beispielsweise enthalten:

- acht bis zwölf Informationskarten
- verschiedene Kartentexte
- mindestens eine Vertiefungskarte
- eine kleine Tabelle
- mindestens ein eingebettetes Diagramm
- mindestens eine Quellenangabe
- eine fachlich gehaltvolle Problemstellung

Die Vorlage muss vollständig dokumentiert sein, damit eine spätere KI-Übertragung mit dem Original verglichen werden kann.

Prüfe den vorgesehenen KI-Arbeitsweg so weit wie tatsächlich möglich.

Dabei gilt:

Die Verarbeitung durch eine unabhängige KI ist nur dann als erfolgreich zu bezeichnen, wenn diese tatsächlich mit dem Projektordner und dem Ausgangsmaterial gearbeitet hat.

Wenn im Codex-Lauf keine unabhängige KI verfügbar ist, liefere stattdessen die vollständige Testvorlage, den KI-Prompt, die erwartete Inhaltsstruktur und eine konkrete Prüfanleitung. Dokumentiere die fehlende externe Erprobung ausdrücklich.

Keine erfolgreiche Fremd-KI-Nutzung simulieren oder behaupten.

## 9. Ergebnis mit MysteryBoard öffnen und weiterbearbeiten

Teste anschließend mit einer tatsächlich erzeugten, validierten Testdatei:

1. Mystery importieren.
2. Alle Karten und Medien kontrollieren.
3. Lehrkräftemodus öffnen.
4. Eine Karte hinzufügen.
5. Eine Karte löschen.
6. Einen Kartentext verändern.
7. Ein Diagramm ersetzen.
8. Hilfekategorien bearbeiten.
9. Den Entwurf erneut sichern.
10. Eine neue Schülerversion erzeugen.
11. Diese in der universellen SCORM-Anwendung öffnen.
12. Eine Schülerarbeit beginnen und als Original-PNG sichern.
13. Die Arbeit in einer neuen SCORM-Sitzung vollständig wiederherstellen.

Die ursprüngliche Mystery-Version und vorhandene Schülerarbeiten müssen weiterhin unverändert verwendbar sein.

---

# Teil D – Abschließende Qualitätssicherung

## 10. Vollständige technische Regression

Prüfe:

- 5, 12, 18 und 60 Karten
- Nummerisch sortierte Startablage
- Pflicht- und Vertiefungskarten
- Lange und kurze Kartentexte
- Bilder, Karten und Diagramme
- Strukturierte Tabellen
- Hilfestufe 1 und 2
- Suche und Mehrfachzuordnung
- Pinch-to-Zoom
- Kartenziehen
- Arbeitsfläche verschieben
- Pfeile und Beschriftungen
- Undo/Redo
- Original-PNG
- Wiederherstellung in neuer Sitzung
- A4-/A3-Druck
- Offline-Verhalten
- SCORM 1.2
- Manipulierte Dateien
- Alte Dateiversionen
- Neue Inhaltsrevisionen
- Vollständigkeit der Schülerexporte

Die bisherige Boden-RC2 ist unverändert zu erhalten.

Alle bestehenden Tests bleiben bestehen.

Keine Tests abschwächen, um einen positiven Bericht zu erhalten.

## 11. Reproduzierbarer Neubau

Entpacke die endgültige Projektvorlagen-ZIP in einem vollständig neuen Arbeitsverzeichnis.

Prüfe ohne Zugriff auf den ursprünglichen Projektordner:

1. Installation der dokumentierten Abhängigkeiten
2. Validierung eines neuen Mysterys
3. Erstellung einer importierbaren `.mysteryboard`-Datei
4. Build der Universal-HTML
5. Erstellung des universellen SCORM-Pakets
6. Technische Prüfung beider Anwendungen
7. Vergleich mit den ausgelieferten Referenzdateien

Der Neubau muss vollständig reproduzierbar sein.

Wenn ein Build wegen eines fehlenden Werkzeugs oder einer undokumentierten Abhängigkeit scheitert, behebe das vor Abschluss.

---

# Teil E – Lieferung und Projektabschluss

## 12. Bereitstellung

Erstelle bei Bedarf einen neuen Feature-Branch aus dem aktuell geprüften Stand.

Keine Änderungen an `main`, bestehenden Release-Tags oder der abgeschlossenen Boden-RC2.

Liefere:

**A – Projektvorlage**

`MysteryBoard-Universal-Projektvorlage.zip`

**B – Direkt nutzbares universelles SCORM-Paket**

`MysteryBoard-Universal-SCORM-1.2.zip`

**C – Eigenständige Anwendung**

`MysteryBoard-Universal.html`

**D – Unabhängiges Abnahmepaket**

`MysteryBoard-ReleaseCandidate-Abnahme.zip`

Das Abnahmepaket enthält:

- Aktuelle HTML und SCORM-ZIP
- Bearbeitbaren Lehrkraftentwurf
- Veröffentlichte Schülerversion
- Echte Schüler-Sicherungs-PNG
- Geänderte zweite Inhaltsversion
- KI-Testvorlage
- KI-Prompt
- Prüfsummen
- Testprotokolle
- Screenshots
- Unabhängig ausführbare Browserprüfungen

Alle ZIP-Dateien tatsächlich erstellen, entpacken und auf Integrität kontrollieren.

Stelle sie unmittelbar zum Herunterladen bereit.

## 13. Keine ungefragte Veröffentlichung

Die Arbeit endet zunächst auf dem Feature-Branch.

Kein Merge in `main`.

Keine öffentliche Veröffentlichung oder automatische Freigabe für Schulen.

Insbesondere die finale Freigabe auf verwalteten Schul-iPads mit itslearning bleibt bis zu einer realen Geräteprüfung offen.

## 14. Erfolgskriterium

MysteryBoard ist als Universalvorlage bereit, wenn eine Lehrkraft ohne Programmierkenntnisse:

- ein eigenes Mystery erstellen oder von einer KI übernehmen kann,
- sämtliche Inhalte und Hilfen nachträglich bearbeiten kann,
- ohne technische Zwischenschritte eine vollständige Schülerversion erhält,
- die Aufgabe über das universelle SCORM-Paket bereitstellen kann,
- und eine Schülergruppe ihre Arbeit vollständig sichern und wiederherstellen kann.

**Der entscheidende Maßstab ist nicht die Anzahl der Funktionen, sondern dass die Erstellung und Verwendung eigener Mysterys für Lehrkräfte einfach, zuverlässig und fachlich kontrollierbar ist.**