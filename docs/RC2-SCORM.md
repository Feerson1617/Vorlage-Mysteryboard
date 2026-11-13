# RC2 als SCORM 1.2 in itslearning erproben

Die Datei `MysteryBoard-Boden-Klasse11-RC2-SCORM-1.2.zip` ist das Upload-Paket. Sie muss **unverändert** als SCORM-1.2-Lernpaket in itslearning importiert werden. Nicht entpacken, umbenennen oder erneut komprimieren. Ein tatsächlicher Import in itslearning und der verwaltete Schul-iPad-Test können durch lokale Browserautomatisierung nicht abgenommen werden.

## Aufbau und Datenschutz

Im ZIP-Wurzelverzeichnis liegen `imsmanifest.xml`, `launch.html`, `session.js` und `app.html`. Das Manifest verweist auf genau einen SCO (`launch.html`), das `app.html` ohne einschränkende eigene Sandbox einbettet. Die Anwendung darin ist **byteidentisch** zu `MysteryBoard-Boden-Klasse11-RC2.html`. Keine Anpassung am Anwendungskern, kein zweites Datenmodell, keine externe Bibliothek oder Laufzeitressource. Alle Lizenzhinweise der eigenständigen HTML bleiben erhalten.

Die Manifestkennung ist `MysteryBoard-Boden-Klasse11-2026-11-13-RC2`, die SCORM-Version **1.2**, die fachliche Inhaltsversion weiterhin **2.0.0**. Namespace-URLs im XML kennzeichnen den Standard und sind keine Netzwerkressourcen, die die Anwendung lädt.

Die separate Hülle sucht eine erreichbare SCORM-1.2-API im Elternfenster oder Öffner. Sie ruft nur `LMSInitialize("")` und bei tatsächlichem Verlassen `LMSFinish("")` auf. Kein `LMSGetValue`, `LMSSetValue` oder `LMSCommit`; insbesondere keine Teamnamen, Antworten, Spielstände, Punkte, Bewertungen, Bearbeitungszeiten oder Fortschrittsfelder. Die Hülle greift nicht auf den Arbeitsstand zu. Sie schreibt nichts in lokale oder Sitzungs-Speicher. Ohne API oder bei fehlgeschlagener Initialisierung bleibt die App benutzbar; eine funktionierende LMS-Sitzung ist dann nicht nachgewiesen.

Ein LMS kann den Start eines Pakets selbst protokollieren; die App steuert diese Plattformprotokollierung nicht. Automatisches Abschließen, Punkte- oder Fortschrittsübertragung ist im Paket nicht implementiert. Browser-Cache und die vom Nutzer bewusst gespeicherte Original-PNG sind von einer automatischen Speicherung des Arbeitsstands zu unterscheiden. Ein Fensterwechsel, Sitzungssignal oder Paketneustart stellt keinen Spielstand aus dem LMS wieder her. Vor dem Schließen die PNG ausdrücklich sichern.

## Auf einem verwalteten Schul-iPad

1. ZIP in itslearning importieren und den erzeugten Eintrag zunächst selbst als Lernender öffnen. Großen Player oder Vollansicht verwenden; eine kleine Kursvorschau ersetzt nicht die Arbeitsfläche. Die erste Seite des vorhandenen Schüler-PDFs mit Begriffshilfe zusätzlich bereitstellen.
2. Teambezeichnung eingeben. Alle 18 Karten und die gemischte RC2-Anordnung kontrollieren. Hoch- und Querformat prüfen; Werkzeuge müssen vollständig erreichbar bleiben.
3. Karten und Nummern antippen, Texte lesen, mit einem Finger bewegen, freie Fläche verschieben und mit zwei Fingern zoomen. „Übersicht“ muss alle Karten zurückholen. V-Karten genauso testen.
4. Eine Verbindung beschriften, Richtung ändern, löschen und rückgängig machen; Farben, Kategorie und Teamname ändern; Rückgängig/Wiederholen prüfen.
5. „Sichern“ wählen und die **Original-PNG in Dateien** ablegen. PNG-Erzeugung allein bestätigt keine dauerhaft gespeicherte Datei. Kein Bildschirmfoto oder vom LMS verkleinertes Vorschaubild verwenden.
6. Paket vollständig schließen, erneut öffnen, „Fortsetzen“ → „Sicherungsbild auswählen“. Gespeicherte PNG aus Dateien wählen. Team, Positionen, Farben, Kategorien und Pfeile vergleichen; danach weiterbearbeiten und erneut sichern.
7. Gerätebezeichnung, iPadOS-/Safari-Version, itslearning-Player, Datum und Ergebnis festhalten. Downloads oder Dateiauswahl können durch LMS-Sandbox und Schulverwaltung eingeschränkt werden; die Verpackung selbst setzt solche Sperren nicht.

Keine erfolgreiche Schul-iPad-, Safari- oder itslearning-Abnahme wird ohne diesen tatsächlichen Durchlauf behauptet. Auch SCORM-WebKit-Emulation wäre kein Gerätetest. Die separate Druckentwicklung ist nicht Teil von RC2.

## Reproduzierbarer Build und Test

Voraussetzungen: dieselbe Node/npm-Werkzeugkette wie im Repository, installierte Paketabhängigkeiten, Python 3 mit `lxml`, Chromium. Neue Runtime-Abhängigkeiten der Schüleranwendung entstehen nicht.

```sh
npm ci
npm run check
npm run release:rc2
npm run test:rc2
```

`release:rc2` baut die drei bestehenden Varianten, kopiert die fertige Boden-HTML unter den RC2-Namen und verpackt genau diese Bytes. Anschließend prüft `validate-scorm.py` ZIP-CRC, XML-Parsing, Manifeststruktur und sämtliche lokalen Referenzen sowie die Bytegleichheit. Das ist keine ADL-Zertifizierung. `test:rc2` testet die endgültige RC2-HTML und die aus der tatsächlichen ZIP gelesene App in beiden iPad-typischen Ansichten, jeweils offline nach lokalem Laden. Das simulierte LMS protokolliert alle API-Aufrufe. Manifest/ZIP-Hashes stehen in `artifacts/RC2-integrity.json`.

RC1 ist weiterhin über Tag `unterricht-2026-11-13-rc1` erreichbar. RC2 bekommt den eigenen Tag `unterricht-2026-11-13-rc2`; bestehende Sicherungen derselben Inhaltsversion bleiben kompatibel. Keine öffentliche Pages-Veröffentlichung gehört zu diesem Auftrag.
