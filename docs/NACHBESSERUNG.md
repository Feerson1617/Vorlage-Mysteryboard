# Prüfbericht: gezielte technische Nachbesserung

9. November 2026. Prüfgrundlage: `f02b411a20d49f5dbed5d6886c8d816e6411ad13`, Branch `feat/mysteryboard-prototype`. Ausführung in der bestehenden Cloud-Umgebung: Node.js 24.22.1, Chromium 156.0.8078.79, Playwright 1.65.0. **Keine reale Canva- oder Schul-iPad-Abnahme.**

## Ergebnis und Ursachen

| Mangel                                                | Ursache                                                                                                                                                                                      | Korrektur und betroffene Dateien                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eigene PNG-Sicherung kann über dem Importlimit liegen | `parse()` begrenzte nur die Eingangsdatei; `embedWork()` addierte anschließend ungeprüft den neuen Chunk.                                                                                    | `src/core/png.ts`: gemeinsame Grenze `MAX_PNG_BYTES`, Prüfung der endgültigen Bytezahl vor der Ausgabe. Entfernte alte Sicherungsblöcke werden korrekt abgezogen. `src/App.tsx`: dieselbe Importgrenze und verständliche Meldung, falls auch der kleinere Export scheitert. Der bestehende A3→klein-Rückfallweg fängt den Größenfehler ab.                            |
| Wiederholen fehlt                                     | Frühere Version hatte ausschließlich eine Liste vergangener Zustände.                                                                                                                        | `src/core/history.ts`, `src/App.tsx`: vollständige Zustände, atomarer Reducer, Vergangenheit/Zukunft mit gemeinsam höchstens 40 Schritten. Neue echte Bearbeitung verwirft die Zukunft; Laden/Startansicht setzt beide zurück. `src/style.css`: Wiederholen in derselben Werkzeugleiste, bei kleinen Breiten mit verständlichen Pfeilsymbolen und zugänglichen Namen. |
| Bilder werden verzerrt                                | Canvas zeichnete jede Quelle direkt in 264 × 98 Pixel, unabhängig vom Quellseitenverhältnis. Zusätzlich zeigten SVG-Quellen ohne `viewBox` im SVG-Board ein anderes Verhalten als im Canvas. | `src/core/layout.ts`: gemeinsame proportionale, zentrierte Einpassberechnung. `src/core/export.ts`: intrinsische Bildabmessungen statt Strecken. `src/components/CardImage.tsx` und `Board.tsx`: dieselbe Einpassung auch auf dem Board, einschließlich SVG ohne `viewBox`. Kein Beschneiden.                                                                         |
| Sicherungsstatus ist zu ungenau                       | Der alte `dirty`-Schalter blieb nach vollständigem Rückgängig aktiv. Er wurde bereits zuvor nicht durch die PNG-Erzeugung gelöscht; dieses wichtige Verhalten bleibt erhalten.               | `history.ts`, `App.tsx`: Vergleich mit dem geladenen/gestarteten Ausgangsstand. Erzeugen, Herunterladen sowie erfolgreiches oder abgebrochenes Teilen liefern keinen Nachweis einer externen Ablage. Der Warnstatus bleibt bei Änderungen aktiv. Die Oberfläche erläutert diese Grenze.                                                                               |

Die vorhandene Trennung zwischen Inhalten, `Work`-Zustand, Board und Export bleibt bestehen. Inhalte, Inhaltsversionen, QR-Grenze, kompaktes Zustandsformat und PNG-Chunkformat wurden nicht verändert. Keine automatische Speicherung, Bewertung, Musterlösung, SCORM- oder mehrseitige Druckfunktion hinzugefügt.

## Ausgeführte Befehle und Ergebnisse

Arbeitsverzeichnis für alle Befehle: `/workspace/Vorlage-Mysteryboard`.

Der abschließende Gesamtlauf:

```sh
set -o pipefail
npm run check 2>&1 | tee /tmp/mysteryboard-correction-check.log
```

`npm run check` führte vollständig und mit Gesamtexitcode **0** aus:

```sh
npm test
npm run build
npm run test:e2e
```

| Prüfung                                                                   | Ergebnis                                                                                            |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Vitest, alle drei Testdateien                                             | **29 bestanden, 0 fehlgeschlagen, 0 übersprungen**; darin sämtliche 22 bestehenden Tests            |
| TypeScript (`tsc --noEmit`, Bestandteil von Build)                        | Bestanden                                                                                           |
| Vite-Build für klein und umfangreich, Ein-Datei-Prüfung und Größenprüfung | Bestanden                                                                                           |
| Playwright, beide Testdateien, Chromium                                   | **19 bestanden, 0 fehlgeschlagen, 0 übersprungen**; darin sämtliche 12 bestehenden Browserprüfungen |
| Prüflaufzeit                                                              | Vitest etwa 8 Sekunden, Chromium etwa 1,5 Minuten; keine Leistungszusage für iPads                  |

Die gezielten Vorläufe nutzten ebenfalls ausführbare Befehle:

```sh
npx tsc --noEmit
npx playwright test tests/browser/corrections.spec.ts
npx playwright test tests/browser/corrections.spec.ts --grep 'Proportionen'
npx playwright test tests/browser/corrections.spec.ts --grep 'Proportionen|erzeugtes Bild'
```

Dabei erkannte der Bildvergleich zuerst die SVG-Abweichung. Nach gemeinsamer Einpassung wurden Raster- und SVG-Bilder anhand realer Bildschirm-/PNG-Pixel geprüft. Die Messauflösung wurde erhöht, damit wenige Randpixel kleiner Vorschaubilder nicht als geometrische Verzerrung fehlinterpretiert werden. Entscheidend für das Ergebnis ist der abschließende vollständige Lauf; keine fehlgeschlagene Assertion wurde abgeschaltet.

## Gezielt ergänzte Nachweise

- **PNG-Grenze:** `tests/limits.test.ts` und `tests/fixtures/png.ts` erzeugen gültige PNGs mit echtem komprimiertem Pixelinhalt, zusätzlichem erlaubtem privaten Chunk und gültigen CRCs. Eine Eingangsdatei mit **29.999.999 Bytes** wird beim Einbetten zurückgewiesen, sobald der vollständige Arbeitsstand die Grenze überschreiten würde. Für **12 und 60 Karten** werden fertige Dateien von **exakt 30.000.000 Bytes** erzeugt und vollständig wiederhergestellt. Auch das Ersetzen eines vorhandenen Sicherungsblocks am Limit funktioniert.
- **Rückfallweg:** Browserprüfung vergrößert ein tatsächlich gerendertes PNG mit einem gültigen Zusatzchunk bis knapp unter die Grenze. Der A3-Export scheitert dadurch beim Einbetten; die kleinere Ausgabe wird erzeugt, heruntergeladen und vollständig importiert. Ein zweiter Test lässt beide Größen scheitern: verständliche Meldung, kein Download-/Teilen-Angebot, geöffneter Stand und Warnstatus unverändert.
- **Historie:** `tests/history.test.ts` prüft vollständige Zustandsgleichheit für Position, Überlagerung, Farbe, Kategorie sowie Erstellen, Bearbeiten, Richtung und Löschen von Verbindungen. Sechs aufeinanderfolgende Aktionen werden im Browser rückgängig gemacht und wiederholt. Neue Bearbeitung löscht die Zukunft; unveränderte Übernahme nicht. 55 Änderungen prüfen die bestehende Grenze von 40 Schritten. Laden setzt beide Historien zurück.
- **Bildproportionen:** Drei Formate (120 × 120, 120 × 300, 480 × 120) werden jeweils als Raster-PNG und SVG ohne `viewBox` geprüft. Farbflächen werden in einem echten Screenshot und im erzeugten Export vermessen. Sollverhältnisse 1:1, 0,4:1 und 4:1; gemessene Exportverhältnisse liegen je nach Randrasterung zwischen 0,9878–1,0125, bei etwa 0,3951 und zwischen 3,9818–4,0556. Toleranzen: unter 4 % auf dem Bildschirm und unter 2 % im Export. Das sind pixelbasierte Nachweise, keine bloße Kontrolle der `drawImage`-Argumente.
- **Sicherungsstatus:** Vor Bearbeitung kein Hinweis, danach aktiver Hinweis; Erzeugung, Download, simuliertes erfolgreiches Teilen und simuliertes Abbrechen bestätigen keine Ablage. Ein tatsächlicher Chromium-`beforeunload`-Dialog beim Schließen wird ausgelöst und abgebrochen. Vollständiges Rückgängig zum Ausgangsstand entfernt den Hinweis, Wiederholen stellt ihn wieder her, Import setzt den Ausgangsstand neu.
- **Werkzeugleiste:** Bei 320 Pixeln Breite kein horizontales Scrollen; alle fünf Funktionen bleiben erreichbar und haben mindestens 48 × 48 Pixel große Schaltflächen.
- **HTML-Grenze:** Automatisierter Negativtest weist exakt 10.000.000 Bytes mit Exitcode 1 zurück. Beide tatsächlichen HTML-Artefakte bestehen die Größenprüfung.

## Bestätigte bestehende Regressionen

Alle bisherigen Prüfungen wurden erneut bestanden: jeweils zehn vollständige Zustandszyklen mit 12 bzw. 60 Karten; zehn zusätzlich gerenderte PNG-Zyklen; großer Arbeitsstand mit 90 Verbindungen oberhalb der QR-Grenze; erneute Bearbeitung nach Import in einem neuen Browserfenster; beschädigte/unvollständige/fremde Sicherungen; abgebrochener Import; unabhängige Leseransicht; Zoomen, Flächen- und Kartenziehen; keine unbeabsichtigte Kartenbewegung oder Verbindung bei Zwei-Finger-Gesten; direkte Verbindungsbearbeitung; QR-Erkennung inklusive Grenzfall; künstlicher Kamerastream und Freigabe seiner Tracks; verweigerte Kamera; kleiner Export bei Canvas-Fehler; bytegleicher Export bei geändertem Bildschirmzoom.

Der bestehende Offline-Test wurde zusätzlich um **PNG-Erzeugung, Download und Import bei ausgeschalteter Netzwerkverbindung** erweitert. Außer der anfänglichen Auslieferung der eigenständigen HTML-Datei gab es keine HTTP(S)-Anfrage. Eingebettete Bilder werden lokal geladen.

## Aktualisierte eigenständige HTML-Dateien

| Datei                                     | Bytes einschließlich Lizenzhinweisen |
| ----------------------------------------- | -----------------------------------: |
| `artifacts/MysteryBoard-klein.html`       |                              448.935 |
| `artifacts/MysteryBoard-umfangreich.html` |                              481.821 |

Beide liegen deutlich unter 6 MB und unter der verbindlichen Grenze von 10.000.000 Bytes. Größen, SHA-256-Prüfsummen, Testzahlen und Bildmesswerte sind zusätzlich in [test-evidence/nachbesserung.json](test-evidence/nachbesserung.json) festgehalten. Der vom aktuellen Lauf erzeugte Playwright-Bericht liegt lokal in `playwright-report/`, seine Ausgaben in `test-results/`; diese werden bei weiteren Testläufen ersetzt und nicht als Quellcode eingecheckt.

## WebKit und offene Risiken

WebKit war nicht installiert. Tatsächlich versucht:

```sh
PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright npx playwright install webkit
```

Ergebnis: **Exitcode 1**, Download von Playwright WebKit 27.2/build 2388 durch den Netzwerkproxy mit **HTTP 403 „Domain forbidden“** verweigert. Betroffene offizielle Hosts: `cdn.playwright.dev` und `playwright.download.prss.microsoft.com`. Die Alternativversuche wurden vom Installer selbst ausgeführt. **Keine WebKit-Tests ausgeführt**; fehlende Installation wurde nicht als bestandener Test oder als iPad-Abnahme gewertet. Für einen späteren WebKit-Lauf braucht es eine erlaubte Installation; eventuelle weitere Laufzeitabhängigkeiten konnten noch nicht geprüft werden.

Weiter offen bleiben:

1. Echte Schul-iPads: Safari-Gesten, Performance/Speicher, hochauflösende Exporte und Dateien-/Teilen-Verhalten unter der schulischen Geräteverwaltung. Eine 30-MB-Grenze kontrolliert die Dateigröße, nicht den gesamten Canvas-/Kodierungsspeicher. Ein Prozessabbruch durch iPadOS kann den Rückfallweg umgehen.
2. `beforeunload` ist insbesondere auf Mobilgeräten nicht garantiert. Browser und Einbettung können den Hinweis unterdrücken. Tatsächliche Dateiablage und Erhalt der PNG-Zusatzdaten müssen in „Dateien“ geprüft werden.
3. Canva Code: unveränderte Ausführung des HTML, Download-/Dateiauswahlrechte, iframe-Sandbox und Kamerafreigabe weiterhin nicht praktisch abgenommen.
4. Echte Kamerascans und gedruckte QR-Codes sind weiter offen. Der vollständige Zustand ist nur in der unveränderten Original-PNG garantiert; Bildbearbeitung/Komprimierung kann Zusatzdaten entfernen.
5. Prüfsummen bestätigen Integrität, keine kryptografische Urheberschaft. Die bekannte Grenze bleibt dokumentiert.

Die aktualisierte [Praxisanleitung](PRAXISTEST.md) ergänzt Wiederholen und den sachlichen Sicherungsstatus. Änderungen bleiben auf dem Feature-Branch; kein Merge und keine Änderung des Hauptbranches sind Teil dieses Auftrags.
