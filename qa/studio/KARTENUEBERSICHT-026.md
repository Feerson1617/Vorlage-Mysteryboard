# Kompakte Schülerkarten in MysteryBoard Studio 0.2.6

Die Schülerpinnwand zeigt die vollständige umgebrochene Überschrift und bis zu sechs Zeilen Kartentext. „Vollständigen Text öffnen“ erscheint auf längeren Karten. Ein Tipp auf die Karte öffnet den vollständigen Text, die Bilder, Diagramme und Quellen in der vorhandenen Leseansicht. Die Bildvergrößerung bleibt dort verfügbar.

Beim Schreiben bleiben die Kartenpositionen erhalten. Kartenumrisse, Pfeilanschlüsse und die Überlagerungskontrolle verwenden dieselben Vorschauabmessungen. „Überlagerte Karten anzeigen“ bleibt für tatsächlich überlagerte Karten erreichbar.

Die Original-PNG kann in ihrer Bildansicht Auszüge zeigen. Ihr Datenblock enthält die unveränderte Aufgabe und den vollständigen Schülerarbeitsstand. Aufgaben-, Projekt- und Arbeitsstandformat sind identisch mit 0.2.5. Die Druckfassung verwendet weiterhin vollständige Texte.

## Nachweise

- `npm test` prüft Daten, Historie und Layout. `npm run build`, `npm run test:e2e` und `npm run test:rc2` prüfen die bestehenden Browser- und Unterrichtsfunktionen.
- `npm run studio:build`. Für den neuen SCORM-Test `STUDIO_VERSION=0.2.6 STUDIO_025_SCORM=/pfad/Textkarten-SCORM.zip node qa/studio/student-text-025.mjs /tmp/schuelerkarten` verwenden. `STUDIO_025_SCORM` verweist auf den anhand einer festgelegten SHA-256 geprüften Export aus 0.2.5. Mit denselben Variablen und `MB_ENGINE=webkit` denselben Ausgabeordner prüfen.
- `python3 qa/studio/verify-readability-pdf.py /tmp/schuelerkarten` prüft mit PyMuPDF den tatsächlich erzeugten A4-Ausdruck anhand der Endmarken der 23 langen Texte. Die Browserprüfung vergleicht zusätzlich jeden vollständigen Text einschließlich Absätzen im Druckdokument.
- Der Bildvergleich lädt dieselbe Original-PNG in beiden Playern. Beim archivierten Player aus 0.2.5 wird ausschließlich die eingebettete Aufgabenreferenz durch die identische Aufgabe des Vergleichslaufs ersetzt. Screenshots verwenden je Browser dieselbe Ansicht. Kartenpositionen, Farben, Nummern, Textzeilenzahl, Überlagerungen und Verbindungslinien werden anhand der gerenderten SVG-Daten verglichen.
- Der Workflow `.github/workflows/studio-macos-026.yml` setzt `STUDIO_EXEC` auf die aus der verifizierten DMG kopierte Apple-Silicon-App. Er stellt ein Installations-ZIP mit einer DMG bereit. Der native P01-Originalnachweis aus 0.2.4 bleibt Voraussetzung der Gesamtfreigabe.
