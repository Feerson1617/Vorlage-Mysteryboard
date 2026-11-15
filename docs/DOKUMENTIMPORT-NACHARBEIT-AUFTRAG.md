# Codex-Nacharbeit: Dokumentimport – Datenintegrität und echtes Abnahmepaket

Repository `Feerson1617/Vorlage-Mysteryboard`, Branch `feat/mysteryboard-local-document-import`, geprüfter Commit `8418a445248893c2ba01bea673d84febcdf36537`. Arbeite nur auf einem neuen Feature-Branch aus diesem Stand; kein Merge und keinerlei Änderung der eingefrorenen Boden-RC2.

## P1 – Reproduzierten Fehler bei „Karte teilen → zusammenfügen“ beheben

Im aktuellen `DocumentImport.tsx` wird beim Teilen `source` auf beide Hälften kopiert. `mergeImported` hängt anschließend identische Quellen erneut aneinander. Außerdem fügt die Standard-Zusammenführung selbst mitten im Wort eingefügte Leerabsätze ein. Reproduktion mit einem Text `Material 1` und Quelle `Eigene technische Vorlage B1.`: Ergebnis `Materia\n\nl 1` und doppelte Quelle. Die gespeicherte DOCX-Beispielaufgabe enthält die duplizierte Quelle.

- Prüfe und korrigiere den Originalitäts-Rundlauf bei Teilen und anschließendem unmittelbarem Zusammenfügen ohne weitere Bearbeitung. Textzeichen und identische Quellen sollen exakt wiederherstellbar sein.
- Bewahre bei Zusammenführung verschiedener tatsächlich eigenständiger Karten alle unterschiedlichen Quellen und Karteninformationen; niemals stillschweigend Medien/Tabellen verlieren. Für nicht eindeutig rekonstruierbare Fälle angemessen warnen.
- Ergänze gezielte Tests für Teilung am Wortzwischenraum, mitten im Wort, vor/nach Absätzen, bei Tabelle, Bild, Quellentext, V-Karte und verschiedenen Quellen.
- Verifiziere die ausgegebene `.mysteryboard`-Datei, nicht nur den Editordialog.

## P2 – Unabhängig ausführbare aktuelle Lieferung bereitstellen

Erzeuge und stelle als **wirklich herunterladbare ZIP** `MysteryBoard-Dokumentimport-Abnahmepaket.zip` bereit, mit **aktueller** Universal-HTML, SCORM-1.2-ZIP, Original-/Referenz-DOCX-/PDFs A–H, importierten Entwürfen und Aufgaben, Schüler-PNG, zwei Inhaltsversionen, Prüfsummen, Testlogs und browserunabhängig startbaren Playwright-Prüfskripten. Exakte Pfade und Commit-SHA angeben. ZIP selbst entpacken und auf CRC/Dateivollständigkeit prüfen. Keine bloße GitHub-Verzeichnisliste oder Dateinamen als Ersatz für das Paket. Zusätzlich die vollständige `MysteryBoard-Universal-Projektvorlage.zip` für einen kalten Neubau liefern.

## P3 – Aktuelle Anwendung und SCORM erneut real testen

Von den **gelieferten Bytes** aus: DOCX A/B, PDF C/D/E, Fehlerfälle F, seitenübergreifender Fall G und Abbruch H tatsächlich in Chromium ausführen. Bestehenden Entwurf beim Abbruch unverändert erhalten. Originalbild und Texte/Quellen/Tabellen jeweils gegen Ausgangsdatei vergleichen. Karten hinzufügen/löschen/teilen/zusammenführen, Pflicht/V, Hilfe, Entwurf speichern und neu öffnen, veröffentlichen, innerhalb der tatsächlichen SCORM-App Team/Pinch/Pfeil/Undo/Redo verwenden, echte PNG sichern und in neuer Sitzung fortsetzen. A4/A3 erzeugen. Breiten 1024×768, 768×1024, 600×800 und 320×700. Die unveränderten R1/R1b- und Boden-RC2-Tests erneut laufen lassen. Keine abgeschwächten Tests.

## P4 – Echte iPad-Grenzen ehrlich kennzeichnen

Zusätzliche Offline-DOCX/PDF-Bibliotheken vergrößern die HTML stark. Messe lokale Dateigrößen und Chromium-Startzeiten und dokumentiere worker-/WASM-/PDF-Speicherbedarf. Behaupte keine Safari-, itslearning-, Schul-iPad- oder native iPad-Druckfreigabe ohne echte Geräteausführung. Wo möglich die Importlogik erst nach Lehrkraftaktion aktivieren, ohne den funktionierenden Schülerplayer zu verändern.

**Erfolgskriterium:** Belegbar originale importierte Inhalte, keine doppelten Quellen durch Split/Merge, funktionsfähige neue DOCX/PDF-Workflows und ein vollständig herunterladbares, unabhängig testbares Abnahmepaket. Keine weiteren unaufgeforderten Großfunktionen.
