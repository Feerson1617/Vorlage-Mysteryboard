# RC2: fachliche Voraussetzungen und neutrale Anordnung

Stand: 13.11.2026. Vergleichsbasis: RC1, Commit `240d5fcfcac7e5924efe169493c9f7525ba5ed74`.

## Ergebnis der inhaltlichen Prüfung

Es ist keine Änderung der fachlich geprüften Kartentexte notwendig. Alle zwölf Pflichtkarten wurden erneut gelesen. Sie ermöglichen mit der **vorhandenen Begriffshilfe des Schüler-PDFs** die Grundbearbeitung ohne vorausgesetztes Bodenwissen. V13–V18 enthalten für diese Grundbearbeitung kein unersetzliches Wissen. Das ist eine fachliche Materialprüfung, kein empirischer Nachweis, dass jede Lerngruppe die Aufgabe in 20 Minuten bewältigt.

| Voraussetzung | Bereits vorhanden |
| --- | --- |
| Bodenporen, Wasser, Luft und Wurzelbedarf | Pflichtkarte 2 |
| Tragfähigkeit, Verdichtung, Empfindlichkeit feuchten Lehmbodens | Pflichtkarte 8; „Porenstruktur“ zusätzlich in der Begriffshilfe |
| Mögliche Folgen für Versickerung, Luftaustausch, Wurzeln | Pflichtkarte 11; „Versickerung“, „Unterboden“ in der Begriffshilfe |
| Oberflächenabfluss, auch ohne Verdichtung bei Wassersättigung | Pflichtkarte 4; „wassergesättigt“ in der Begriffshilfe |
| Ablösung, Transport, Ablagerung: Wassererosion | Pflichtkarte 9; „Oberboden“ und „Humus“ in der Begriffshilfe |
| Bedeutung von Pflanzenbedeckung und Wurzeln | Pflichtkarte 6 |
| Landschaft und Fallbeobachtungen, betrieblicher Entscheidungsdruck | Pflichtkarten 1, 3, 5, 7, 10 und 12 |
| Unterscheidung Beobachtung / mögliche Erklärung | Fiktive Fallangaben sind bezeichnet; Karte 12 nennt fehlende Bodenmessungen; Karte 4 erlaubt Abfluss ohne Verdichtung |
| Weitere Begriffe | Vorhandene Hilfe erklärt Schluff, Ton, organisch und Zwischenfrucht |

Humus wird zwar auf V13 ausführlicher erläutert, seine für Pflichtkarte 9 notwendige Bedeutung steht bereits in der vorhandenen Begriffshilfe. Es besteht deshalb kein sachlicher Grund, V13 zur Pflicht zu machen oder den Kartentext zu ändern. Die Erosions- und Verdichtungsprozesse sind ausdrücklich mögliche Erklärungen des fiktiven Falls, keine bewiesene Diagnose allein aus den Beobachtungen.

**Unterrichtsvoraussetzung:** Die erste Seite von `Boden-Mystery-Schuelermaterial.pdf` mit Arbeitsauftrag und Begriffshilfe muss zusätzlich ausliegen oder als Material erreichbar sein. Sie ist wie bisher kein Bestandteil der App. Das unveränderte Original-PDF liegt dem Abnahmepaket bei; die darin enthaltene analoge Kartenreihenfolge wird nicht als neue digitale RC2-Anordnung ausgegeben.

Die 20 Minuten dienen der Erarbeitung: Mindestleistung ist ein nachvollziehbarer Ursache-Wirkungs-Weg; Regelleistung sind zwei verständliche Erklärungswege zu möglicher Verdichtung und Erosion; Vertiefung sind zusätzliche Wirkungen, Unsicherheiten oder Schutzmaßnahmen. Die gemeinsame Sicherung muss beide Grundprozesse und ihr mögliches Zusammenwirken erschließen. Die App erzwingt weder eine Pfeilzahl noch eine bestimmte Reihenfolge und enthält keine Bewertung oder Musterlösung. Diese Materialprüfung ist eine Lehrkraft-/Abnahmeunterlage und liegt **nicht im SCORM-Schülerpaket**.

## Geänderte Startanordnung

Nur `initial.cards` in `src/content/boden-klasse11.json` wurde verändert: Anfangskoordinaten und Zeichenreihenfolge. Gleiche Karte, gleiche Nummer, gleicher Inhalt, gleiche Pflicht-/V-Metadaten. Die feste räumliche Verteilung lautet von links nach rechts:

| Reihe | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- |
| oben | 4 | V16 | 9 | 2 | V14 | 5 |
| Mitte | V13 | 7 | 11 | V18 | 3 | 10 |
| unten | 8 | 1 | V15 | 6 | 12 | V17 |

Dies ist eine Anordnungstabelle, kein Lösungspfad. Jede Reihe enthält zwei V-Karten, jede Spalte eine; beide Arbeitsumfänge sind über die gesamte Fläche verteilt. Gleiche Abstände (480 Einheiten horizontal, 500 vertikal), gleiche Ausgangsfarbe, keine Pfeile, keine Kategorien und keine gesonderte Markierung einer Startkarte. Die Abfolge bildet weder eine Nummernfolge noch die zeitliche Fallgeschichte noch ein Schema aus Ursachen, Folgen und Maßnahmen ab. Ein flächiger Raster bietet gleichwertige Plätze; die linke obere Position bekommt keine zusätzliche Bedeutung.

Die Inhalts-ID `geo11-boden-ploen-2026` und Inhaltsversion `2.0.0` bleiben gleich. Ein importierter Arbeitsstand verwendet seine eigenen gespeicherten Positionen und wird nicht neu angeordnet. Die RC1-Referenz und ihr ursprünglicher Anordnungs-Fingerprint bleiben als explizite Regressionstest-Referenz erhalten. Der bestehende Inhaltstest wurde auf die ausdrücklich beauftragte RC2-Anordnung umgestellt und um die unveränderte RC1-Referenz ergänzt; keine Inhalts- oder Funktionsprüfung wurde gestrichen.
