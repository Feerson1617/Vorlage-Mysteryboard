# Bearbeitbare Schülerkarten in MysteryBoard Studio 0.2.5

Im Kartenformular steuert die Checkbox die Freigabe von Überschrift und Text. In „Mystery gestalten“ zeigt „Bearbeitungsfreigabe“ vor jedem Sammelschritt die Anzahl der betroffenen Karten. Neue Karten sind standardmäßig gesperrt. Die Pinnwand markiert freigegebene Karten mit „Text bearbeitbar“.

Im SCORM öffnet „Text bearbeiten“ die beiden Eingabefelder. Übernehmen erzeugt einen Schritt in Rückgängig/Wiederholen. Abbrechen verwirft die Eingaben. Wiederherstellen übernimmt den veröffentlichten Text und lässt sich ebenfalls rückgängig machen. Bei überlagerten Karten öffnet die Pinnwand eine Liste der betroffenen Karten. Die Lehrkraft oder das Team kann die betroffene Karte gezielt neben die anderen setzen. Das Verschieben ist ein eigener rückgängig machbarer Schritt.

## Daten und Kompatibilität

Die Freigabe `studentEditable: true` ist optional und Teil der Inhaltsprüfsumme. Eine Freigabeänderung erhöht die Inhaltsversion. Ältere Aufgaben ohne das Feld beginnen mit gesperrten Karten. Das Dokumentformat MBX3 speichert geänderte Überschrift und Text im Arbeitsstand `work.schema: 3` mit `textEdits` je Karten-ID. Der eigenständige kompakte Arbeitsstand verwendet MBS3. Beide Wege weisen Änderungen an unbekannten und gesperrten Karten ab. Bestehende Sicherungen mit Schema 1 oder 2 bleiben mit ihrer jeweiligen Aufgabenfassung verwendbar. Ältere Leser erkennen Schema 3 als inkompatibel. Das Sicherungsbild enthält den Arbeitstext vollständig im PNG-Datenblock. Ein QR-Code erscheint nur, wenn er den unterstützten vollständigen Arbeitsstand aufnehmen kann.

## Prüfungen

- `npm test` prüft Versionierung, erlaubte und unzulässige Daten, Originaltrennung, History und bis zu 100 Änderungen bei voller Textlänge.
- `npm run build`, `npm run test:e2e` und `npm run test:rc2` prüfen Produktionsartefakte, Browserfunktionen und die eingefrorene Unterrichtsfassung.
- `npm run studio:build` und `node qa/studio/student-text-025.mjs /tmp/textkarten` prüfen Erstellen und Wiederöffnen des Projekts, einen echten SCORM-Export, Touch, Druckvorschau, Überlagerungen, Text-Undo/Redo, Positionen, Farben und Beziehungen sowie Original-PNGs mit 5, 12, 20, 60 und 100 Karten. Der Test blockiert Nicht-Loopback-Anfragen und prüft ein frisches Browserprofil auf gespeicherte Daten.
- `MB_ENGINE=webkit node qa/studio/student-text-025.mjs /tmp/textkarten` verwendet dieselbe fertig exportierte Aufgabe. Der Mac-Workflow setzt für den Chromium-Durchlauf `STUDIO_EXEC` auf die aus der verifizierten DMG separat installierte ARM64-Anwendung. Er führt auch die bestehenden nativen, historischen und neutralen Importtests aus.
- Der GitHub-Workflow erzeugt ausschließlich Testkandidaten. Die endgültige Freigabe setzt den unabhängigen nativen P01-Nachweis aus 0.2.4 voraus. Touch-Emulation ersetzt den Einsatztest auf einem Schul-iPad nicht.

Workflow: `.github/workflows/studio-macos-025.yml`.
