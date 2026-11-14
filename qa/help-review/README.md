# Unabhängiger Browserprüflauf

Im Abnahmepaket liegt dieser Ordner als `browserpruefung/`. Dort:

```sh
npm ci
npx playwright install chromium
npm test
```

Node.js 24/npm und ein Chromium-Browser werden nur für die technische Prüfung benötigt. Bei vorhandenem System-Chromium kann die Browserinstallation entfallen; `CHROMIUM_PATH` überschreibt den Pfad. Linux benötigt die passenden Browserbibliotheken. Alle verwendeten Werkzeuge sind kostenlos, Playwright ist Apache-2.0-lizenziert und fflate MIT-lizenziert. Es werden keine API-Schlüssel benötigt.

Im Quellprojekt kann der Lauf nach `npm ci` auch direkt gestartet werden:

```sh
node qa/help-review/pruefen.mjs PFAD_ZUM_ENTPACKTEN_ABNAHMEPAKET
```

Der Code importiert keine Anwendungsmodule. Er startet einen lokalen HTTP-Server auf 127.0.0.1, verwendet die tatsächlich mitgelieferte HTML und extrahiert die tatsächlich mitgelieferte SCORM-ZIP. Die SCORM-App muss bytegleich zur HTML sein. Nach dem Laden werden die Kontexte offline geschaltet. Die PNG-Dokumente liest der Prüfer separat über Node-zlib und SHA-256. Alle Ergebnisse und echten Download-Dateien werden unter `browserpruefung/ergebnisse/` im entpackten Paket abgelegt. Der Server und Browser werden nach dem Lauf beendet.

Geprüft werden die Kartensuche und optionale Mehrfachzuordnung einschließlich unsichtbarer Auswahl, die Vorschau ohne Datei-/Team-/Druckfunktionen und das Verwerfen ihrer temporären Änderungen, der vollständige Autoren-/Schülerkreislauf, drei manuell erstellte Gruppen mit unmarkierten Karten, frische Sitzungen, Nummernfarben/Legende, unveränderte Arbeitsdaten beim Hilfewechsel, Touch/Pinch, Undo/Redo, Verbindungen, Farbe/Kategorie, tatsächliche A4-/A3-PDF-Bytes, Original-PNG und vollständige Wiederherstellung sowie eine neue Inhaltsrevision und das unveränderte Öffnen der alten Schülerarbeit. Die simulierte LMS-API darf nur Initialisieren/Beenden erhalten.

Das ist ein automatisierter Chromium-Test. Echte Schul-iPads, Safari, itslearning, Canva, Farbsehfähigkeiten realer Nutzer und der native Safari-Systemdruckdialog werden dadurch nicht abgenommen. Die Lehrkraft benötigt für die normale Anwendung weder Node.js noch ein Terminal.

Zusätzlich wird der vollständige 60-Karten-Ablauf bei 1024 × 768, 768 × 1024, 600 × 800 und 320 × 700 CSS-Pixeln wiederholt: Suche, Mehrfachzuordnung, echte Vorschau, erneutes Entwurfsöffnen, SCORM, Touch/Pinch und Original-PNG mit frischer vollständiger Wiederherstellung. Die Quellvorlage enthält ergänzend dieselben acht kompletten 12-/60-Karten-Kombinationen als Playwright-Tests.

Optionaler Vorher-/Nachher-Nachweis mit einer separat verfügbaren historischen HTML: `node reproduce-preview.mjs ALT.html ENTWURF.mysteryboard NEUE-AUSGABE.png`. Der Prüfer lädt die Datei lokal, prüft die echte Vorschau und lädt nur bei noch vorhandener Sicherungsfunktion eine reale PNG herunter. Bei der korrigierten HTML meldet er das Fehlen der Sicherungs-/Importaktionen und erzeugt keine Datei. Er benötigt keine alte HTML im Abnahmepaket und überschreibt keine vorhandene Datei.
