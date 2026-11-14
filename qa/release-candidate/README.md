# Release Candidate direkt aus der Lieferung prüfen

Dieser Ordner liegt im entpackten Abnahmepaket als `browserpruefung/`.

```sh
npm ci
npx playwright install chromium
npm test
```

Ist `/usr/bin/chromium` vorhanden, kann die Browserinstallation entfallen. Alternativ `CHROMIUM_PATH` auf einen installierten Chromium-Browser setzen. Node.js 24, npm und passende Browserbibliotheken sind nur für diese technische Prüfung erforderlich. Die fertige Anwendung selbst benötigt kein Terminal. Verwendete Prüfwerkzeuge sind kostenlos: Playwright (Apache 2.0) und fflate (MIT).

`pruefen.mjs` führt zwei eigenständige Blackbox-Läufe nacheinander aus. `hilfe-pruefen.mjs` prüft Hilfeeditor, Vorlagen, Suche/Mehrfachwahl, isolierte Vorschau, Portabilität, Druck und 60 Karten in allen vier Ansichten. `papier-pruefen.mjs` prüft bei allen vier Ansichten die neue zehnteilige Papier-Referenz: alle Texte/Quellen/Tabellen/Bilder, bestehende Bildvergrößerung, Karte hinzufügen/löschen, Text/Diagramm/Hilfen ändern, Entwurf frisch öffnen, Schülerversion, tatsächliche SCORM-ZIP, Touch/Pinch, Original-PNG frisch restaurieren und die alte Fassung danach unvermischt öffnen.

Die Skripte importieren keinen Anwendungscode. Sie verwenden ausschließlich HTML, SCORM und Beispiele aus dem entpackten Paket, starten lokale Prüfserver und schalten die Kontexte nach dem Laden offline. Ein separater Node-zlib-/SHA-256-Leser vergleicht die vollständigen PNG-Dokumente. Local-/SessionStorage müssen leer bleiben; nach dem Laden dürfen keine Laufzeit-Netzwerkanfragen erfolgen. Eine simulierte LMS-API darf nur Initialisieren/Beenden erhalten.

Ergebnisse und tatsächliche Downloads/Screenshots/PDFs entstehen unter `browserpruefung/ergebnisse/`; `ENDABNAHME.json` fasst beide Läufe zusammen. Ein Fehler beendet den Lauf mit Fehlerstatus. Alternativ im Quellordner: `node qa/release-candidate/pruefen.mjs PFAD_ZUM_ENTPACKTEN_ABNAHMEPAKET`.

Das ist eine separat ausführbare technische Prüfung derselben erstellenden KI, keine unabhängige menschliche Zertifizierung und keine Prüfung eines fremden KI-Anbieters. Fremd-KI-Übertragung, reale Schul-iPads/Safari/itslearning/Canva und native Safari-Druckdialoge bleiben offen. Anleitung zur tatsächlichen Fremd-KI-Probe: `papierprobe/FREMD-KI-PRUEFANLEITUNG.md`.

Für den vollständigen Neuaufbau der tatsächlich entpackten **Projektvorlage** aus deren Wurzel: `sh qa/release-candidate/cold-build.sh`. Das Skript installiert die dokumentierten Abhängigkeiten frisch, validiert die Papierprobe, erzeugt eine neue Aufgabe und baut HTML/SCORM. Alle Referenzvergleiche erfolgen innerhalb desselben entpackten Ordners. Ein optionaler Linux-Dateizugriffs-Trace wird vom abschließenden Lieferlauf separat bereitgestellt; strace ist für die Nutzung oder normale Builds nicht erforderlich.
