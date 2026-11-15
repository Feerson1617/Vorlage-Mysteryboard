# Dokumentimport aus der echten Lieferung prüfen

Im vollständig entpackten Abnahmepaket, im Ordner `browserpruefung`:

```sh
npm ci
npx playwright install chromium
npm test
```

Ein vorhandenes `/usr/bin/chromium` wird verwendet; alternativ `CHROMIUM_PATH` setzen. Node.js 24/npm und passende Browser-Systembibliotheken sind nur für technische Prüfungen nötig. Die fertige Anwendung benötigt diese Werkzeuge nicht. Alle verwendeten Prüfwerkzeuge sind kostenlos.

Der Prüfer importiert keinen Anwendungscode. Er startet eigene lokale Prüfserver und verwendet die tatsächlich enthaltenen HTML-/SCORM-Dateien sowie echte DOCX-/PDF-Dateien unter `dateien/`. Nach dem Laden werden die Kontexte offline geschaltet. Er vergleicht alle ursprünglichen Titel, Texte, Quellen, Tabellenzellen und Pflicht-/V-Angaben mit `ORIGINAL-INHALTE.json`. Das ist eine technische Originalprüfung, kein KI- oder OCR-Test.

Vollständige Abläufe mit Word B und PDF C laufen jeweils bei 1440 × 1000, 1024 × 768, 768 × 1024, 600 × 800 und 320 × 700 Pixeln. Geprüft werden Teilung/Zusammenführung, Ergänzung/Löschung, Bild-/Tabellenkorrektur, Hilfen, echte Entwurfsdownloads, neue Sitzung, Schülerversion, echte SCORM-ZIP, Teamname, Touch/Pinch, Original-PNG und vollständige frische Wiederherstellung mit Weiterarbeit. Dazu kommen Word A mit V3/V8/V12, Scan-PDF E ohne vorgetäuschte Texterkennung, der vollständige Originalvergleich des komplexen PDFs D und sieben zurückgewiesene Fehlerdateien sowie Abbruch mit exakt unverändertem vorhandenen Entwurf. Die PNG-Dokumente werden separat mit Node-zlib und SHA-256 gelesen. Kein Local-/SessionStorage und keine App-Netzwerkübertragung; die simulierte LMS-API darf nur Initialisieren/Beenden erhalten.

Ergebnisse, tatsächliche Dateien und Screenshots entstehen unter `browserpruefung/ergebnisse/dokumentimport/`. Das vollständige Quellpaket enthält zusätzlich sämtliche Playwright-/Datentests, insbesondere komplexes PDF, Ausschnittproportionen, Abbruch, aktive/manipulierte Dateien, bestehende Entwürfe, neue Mystery-Identität und verzögertes Laden/Freigeben der Parser.

Optional: `node benchmark.mjs ..` misst fünf Starts je Referenz-/Importversion und einen Word-Import. Die alte Referenz-HTML unter `referenz/` dient ausschließlich dem Vergleich und ist keine aktuelle Schülerfassung. Erfasst werden Chromium-V8-Heapwerte und Startzeiten auf der Testmaschine, keine vollständige Prozess-/GPU-/Canvas-Speichermenge und keine Schul-iPad-Leistung. Ergebnisse landen unter `browserpruefung/ergebnisse/benchmark/`.

Die Dateien F enthalten harmlose Sicherheits-Prüfmuster (darunter eine echte PDF-JavaScript-Aktion und ein blockierter VBA-Part-Platzhalter). Nicht als Schüleraufgabe verteilen. MysteryBoard weist diese Muster zurück beziehungsweise übernimmt enthaltene Skriptzeichen ausschließlich als Text. Der unabhängige Prüflauf bleibt eine separat ausführbare Prüfung derselben erstellenden KI; er ersetzt keine unabhängige menschliche Begutachtung und keine reale Safari-/Schul-iPad-/itslearning-Abnahme.

Für einen reproduzierbaren Quellbuild aus der frisch entpackten Projektvorlage: `sh qa/document-import/cold-build.sh` im Wurzelordner starten. Der Lauf installiert eigene Abhängigkeiten, validiert echte Word-/PDF-Importdokumente und verlangt bytegleiche HTML-/SCORM-Ausgaben.

Optionaler direkter Dateiaufruf: `node file-scheme.mjs ../MysteryBoard-Universal.html ../dateien`. Bei einer administrativen Dateizugriffssperre wird `open` dokumentiert, kein Erfolg. Die vollständige Hauptprüfung verwendet unveränderte Dateien über localhost und schaltet danach das Browsernetzwerk ab.

Zusätzlicher Word-Strukturvergleich mit einem zweiten Parser: `python3 word-original.py ../dateien` (kostenloses `python-docx` erforderlich, optional mit `python3 -m pip install python-docx`). Verglichen werden alle Originalabsätze/Quellen, sämtliche Tabellenzellen und die SHA-256-Werte der eingebetteten Bilder. Das bestätigt echte DOCX-Strukturen, keine Microsoft-Word-Seitenlayout-Zertifizierung.
