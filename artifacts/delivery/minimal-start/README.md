# MysteryBoard – reduzierte Startseite

Aktuelle Universal-HTML und SCORM-1.2-ZIP mit den Schüleraktionen **Aufgabe öffnen** / **Arbeit fortsetzen** und dem nachgeordneten Zugang **Lehrkräfteeditor**. Kein fest vorgegebenes Mystery. Alle vorhandenen Funktionen werden weiterverwendet.

- `MysteryBoard-Universal.html`: fertige Einzeldatei.
- `MysteryBoard-Universal-SCORM-1.2.zip`: unentpackt als SCORM 1.2 in itslearning hochladen.
- `Startseite-iPad-Querformat.png` / `Startseite-iPad-Hochformat.png`: tatsächliche Chromium-Screenshots mit 1024 × 768 / 768 × 1024 CSS-Pixeln.
- `screenshots/`: alle vier geforderten Ansichten in HTML und SCORM.
- `PRUEFBERICHT.md`, `ERGEBNIS.json`, `QUELLSTAND.json`, `SHA256SUMS.txt`, `testlogs/`: Umfang, konkrete Befehle, vollständige Prüfergebnisse, Quelle und Dateiintegrität.

130 Datentests, 201 Browserfälle erfolgreich ausgeführt und vier zusätzliche Boden-RC2-Tests bestanden. Transparente Aufteilung: 197 Browserfälle im ersten Gesamtlauf; vier Papierproben nach Aktualisierung der ausdrücklich entfernten KI-Texterwartung vollständig erneut bestanden. Produktdateien zwischen diesen Läufen unverändert. Die acht neuen Starttests bestanden gezielt und im Gesamtlauf. Keine bisherigen Funktionstests entfernt oder abgeschwächt.

Der Quellcommit steht in `QUELLSTAND.json`; ein nachfolgender Liefercommit enthält ausschließlich diese Dateien. Hauptbranch, vorheriger Feature-Branch und eingefrorene Boden-RC2 bleiben unverändert. Kein Merge und kein Pages-/Release-Deployment. Reale Safari-/Schul-iPad-/itslearning-Abnahme bleibt offen.
