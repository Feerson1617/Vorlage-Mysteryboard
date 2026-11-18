# MysteryBoard – Abschlussoptimierung des Hilfeeditors und Vorbereitung der Weitergabe

## Ausgangslage

Repository: `Feerson1617/Vorlage-Mysteryboard`

Branch: `feat/mysteryboard-author-help-editor`

Geprüfter Commit: `d7b41c20a8d773248f71f858ce18f5ce1b5c51d8`

Die aktuelle Anwendung hat 124 unabhängige Funktionsprüfungen in Chromium bestanden.

Ziel dieser Entwicklungsrunde ist eine besonders einfache, schnelle und selbsterklärende Bedienung für Lehrkräfte ohne Programmierkenntnisse.

Arbeite im bisherigen MysteryBoard-Codex-Chat. Erstelle einen separaten Feature-Branch, aber keine neue Anwendung und keine grundlegende Architektur.

## 1. Schüler-Vorschau eindeutig vom echten Unterrichtsmodus trennen

In der Funktion „Hilfe aus Schülersicht ansehen“ können Lehrkräfte derzeit echte Sicherungsdateien erzeugen.

Dies wurde unabhängig reproduziert.

Korrigiere dieses Verhalten.

In der Vorschau müssen weiterhin funktionieren:

- Karten öffnen und lesen
- Karten verschieben
- Verbindungen ausprobieren
- Pinch-to-Zoom
- Übersicht
- Hilfestufe 1
- Hilfestufe 2

Folgende Funktionen dürfen in der Vorschau dagegen nicht erreichbar sein:

- Arbeitsstand sichern
- Dateien importieren beziehungsweise „Fortsetzen“
- Teamname ändern
- Druck-/PDF-Export
- Zur Startansicht wechseln

Nutze hierfür die vorhandene gemeinsame App-Komponente mit einer ausdrücklich gekennzeichneten Vorschau-Betriebsart. Keine zweite Schüleranwendung entwickeln.

Die Vorschau muss ihre temporären Veränderungen beim Schließen vollständig verwerfen.

Der echte Schülerplayer behält sämtliche bisherigen Funktionen.

## 2. Beschriftungen für Lehrkräfte präzisieren

Ändere den Einstieg „Hilfetext festlegen“ im Lehrkräftemodus zu:

**„Hilfen bearbeiten“**

Darunter kann knapp stehen:

„Denkimpuls und farbige Kartennummern“

Im eigentlichen Editor bleiben die getrennten Bereiche „Hilfetext festlegen“ und „Farbige Nummernorientierung“ erhalten.

Ergänze im Lehrkräftemodus eine kurze Übersicht über die bestehenden Einstellungen, beispielsweise:

„Hilfe eingerichtet: Denkimpuls · 3 Farbgruppen · 5 Karten markiert“

Diese Information muss aus den tatsächlich gespeicherten Daten abgeleitet werden.

Nach „Hilfe übernehmen“ muss deutlich werden, dass die Änderungen zunächst nur im geöffneten Entwurf liegen und dieser anschließend über „Entwurf sichern“ heruntergeladen werden muss.

Keine automatische Speicherung vortäuschen oder neu einführen.

Verwende kurze, präzise und konsistente Formulierungen. Keine auffälligen Überschriften, dekorativen Farbfelder oder zusätzlichen großen Menüs.

## 3. Karten-Zuordnung für große Mysterys vereinfachen

Unabhängiger Testbefund:

Bei 60 Karten ist die Hilfeeditor-Seite auf einem 768 × 1024 großen Bildschirm etwa 7.356 CSS-Pixel hoch. Allein die Karten-Zuordnung benötigt etwa 5.520 Pixel.

Die Funktion ist technisch korrekt, aber für Lehrkräfte unnötig aufwendig.

Ergänze innerhalb „Karten zuordnen“:

**A – Suchfunktion**

Suche nach Kartennummer oder Kartentitel.

Bei gefilterten Ergebnissen muss eindeutig erkennbar sein, wie viele Karten angezeigt werden. Alle anderen Zuordnungen bleiben unverändert.

**B – Optionale Mehrfachzuordnung**

Eine Lehrkraft soll eine bestehende Farbgruppe auswählen, mehrere Karten markieren und gemeinsam zuordnen können.

Die bisherige einfache Einzelzuordnung bleibt vollständig erhalten und ist weiterhin der Standard.

Die zusätzliche Funktion wird nur bei Bedarf eingeblendet.

Beim Wechsel einer bestehenden Zuordnung darf keine Karte versehentlich zwei Gruppen erhalten.

Kleine Mysterys mit zwölf Karten dürfen durch diese Erweiterung nicht komplizierter werden.

## 4. Didaktische Qualität erhalten

Die bisherigen fünf Denkimpulse und zwei vorbereiteten Farbgruppierungen sind ausreichend.

Keine weiteren Vorlagen ohne nachgewiesenen Nutzen hinzufügen.

Verbindlich bleibt:

- Keine automatische Sortierung nach vermeintlich richtigen Zusammenhängen
- Keine automatische fachliche Karten-Zuordnung
- Keine Musterlösung
- Keine lineare Lösungskette durch die Hilfefarben
- Nicht alle Karten müssen markiert werden
- Nur Nummernmarkierungen ändern ihre Farbe
- Die Hilfe ist freiwillig und anfänglich deaktiviert

Die bereits implementierte Prüfung gegen doppelte Gruppennamen muss erhalten bleiben.

## 5. Alle Änderungen selbst im Browser testen

Führe die tatsächliche Anwendung in Chromium aus.

Teste mindestens:

1. Lehrkraft öffnet einen vorhandenen Entwurf.
2. Sie bearbeitet den Denkimpuls.
3. Sie richtet Farbgruppen ein.
4. Sie verwendet Einzel- und Mehrfachzuordnung.
5. Sie filtert Karten nach Nummer und Titel.
6. Sie öffnet die Schüler-Vorschau und verändert dort probeweise Karten und Pfeile.
7. Sie schließt die Vorschau.
8. Sie prüft, dass keine Vorschauveränderung im Entwurf gespeichert wurde.
9. Sie sichert den Entwurf.
10. Sie öffnet ihn in einer neuen Sitzung und erstellt eine Schülerversion.
11. Diese wird in der universellen SCORM-Anwendung bearbeitet.
12. Die Schülergruppe verwendet Hilfe, Touch und Pinch-to-Zoom.
13. Sie sichert eine Original-PNG und stellt diese in einer neuen Sitzung vollständig wieder her.
14. Ein altes Schülerdokument bleibt auch nach einer neuen Inhaltsrevision unverändert lesbar.

Teste 12 und 60 Karten sowie 1024 × 768, 768 × 1024, 600 × 800 und 320 × 700 CSS-Pixel.

Prüfe zusätzlich fehlerhafte Gruppen, leere Zuordnungen, alte Sicherungsdateien und A4-/A3-Druckfassungen.

Die bisherigen Datentests, Chromiumtests, R1/R1b-Touchprüfungen und RC2-Regressionen müssen erhalten bleiben und vollständig bestehen.

## 6. Vollständige Weitergabe an Kollegen absichern

Das endgültige Ziel bleibt ein vollständiger Projektordner, den andere Lehrkräfte einer KI ihrer Wahl geben können.

Prüfe deshalb auch die bereits entwickelte Projektvorlage auf Vollständigkeit.

Sie benötigt:

- den gesamten Quellcode,
- das gemeinsame Mystery-Dateiformat,
- das maschinenlesbare Inhaltsschema,
- die KI-Anleitung,
- eine einfache Lehrkräfteanleitung,
- Beispieldateien,
- Validierungs- und Buildskripte,
- eine vollständige SCORM-Verpackungsroutine.

Führe einen frischen Build aus dem vollständig entpackten Projekt-ZIP durch.

Eine fremde KI soll ein vorliegendes Papier-Mystery anhand eines Fotos oder Dokuments in die strukturierte MysteryBoard-Datei übertragen können. Unklare Angaben dürfen nicht erfunden werden.

Es ist keine neue KI-Schnittstelle, kein eigener Server und kein automatischer OCR-Dienst innerhalb von MysteryBoard zu entwickeln.

## 7. Abschließende Lieferung

Erstelle einen neuen Commit und pushe ausschließlich in den neuen Feature-Branch.

Keine Änderungen an `main`, den bestehenden Tags oder der abgeschlossenen Boden-RC2.

Liefere tatsächlich herunterladbar:

- `MysteryBoard-Hilfeeditor-Final-Abnahmepaket.zip`
- `MysteryBoard-Universal-Projektvorlage.zip`
- `MysteryBoard-Universal-SCORM-1.2.zip`

Das Abnahmepaket muss die aktuelle HTML, SCORM, vollständige Beispieldokumente, echte Schüler-PNGs, Screenshots, PDFs, Prüfsummen, Testprotokolle und unabhängig ausführbare Browserprüfskripte enthalten.

Alle ZIPs selbst entpacken und ihre Integrität bestätigen.

**Abnahmekriterium:** Lehrkräfte können mit wenigen klar verständlichen Schritten ein Mystery mit individuellen Hilfen erstellen, überprüfen, sichern und an Lernende verteilen. Die Schülerarbeit bleibt vollständig portabel, und sämtliche bereits erfolgreich getesteten MysteryBoard-Funktionen bleiben erhalten.