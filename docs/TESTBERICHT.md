# Testbericht · MysteryBoard-Prototyp

Stand: 9. November 2026. Ausgeführt in der bestehenden Codex-Cloud-Umgebung unter Linux, Chromium 156.0.8078.79, Node.js 24.22.1, npm 11.9.0, Playwright 1.65.0. **Keine echte Schul-iPad- oder Canva-Abnahme.**

## Ergebnis

Der technische Kern ist im Desktop-Browser geprüft: Karten verschieben, Ansicht bewegen und zoomen, Karten unabhängig vom Zoom lesen, Farben und Kategorien ändern, Verbindungen durch zwei Kartenauswahlen anlegen sowie Texte/Richtungen bearbeiten oder löschen. Rückgängig funktioniert für diese Zustandsänderungen. PNG-Sicherung und vollständige Wiederherstellung funktionieren auch oberhalb des QR-Limits.

Der letzte vollständige Lauf von `npm run check` bestand: **22 Datentests, 12 Browserprüfungen**, TypeScript-Prüfung und beide HTML-Builds. Kein Test übersprungen, deaktiviert oder als erwarteter Fehler markiert. Nach Erweiterung des Übersichts-Zoombereichs für weit auseinanderliegende Karten wurden Build sowie die beiden betroffenen Browserprüfungen zu Ansicht/Bedienung und Zwei-Finger-Gesten erneut ausgeführt; Beide Prüfungen bestanden ebenfalls.

## Ausgaben

| Datei                                     | Tatsächliche Größe einschließlich Lizenzhinweisen | Grenze                                  |
| ----------------------------------------- | ------------------------------------------------: | --------------------------------------- |
| `artifacts/MysteryBoard-klein.html`       |                                     446.749 Bytes | < 10.000.000 Bytes; Ziel < 6 MB erfüllt |
| `artifacts/MysteryBoard-umfangreich.html` |                                     479.635 Bytes | < 10.000.000 Bytes; Ziel < 6 MB erfüllt |

Die tatsächlichen Artefakte enthalten alle Bibliotheken, Inhaltsdaten, Styles, Diagramme und Lizenzhinweise. Sie werden durch den Build erzeugt und sind im Repository enthalten. Eine künstliche Eingabedatei mit exakt 10.000.000 Bytes wurde zusätzlich gegen den Größenprüfer getestet: korrekt mit Exitcode 1 und verständlicher Fehlermeldung abgewiesen.

Datensatz klein: 12 Karten, 9 Verbindungen, 2 eingebettete Diagramme. Datensatz umfangreich: 60 Karten, 90 Verbindungen, 8 eingebettete Diagramme, lange deutsche Beschriftungen und Sonderzeichen. Inhalt und Startzustand sind von der Anwendung getrennte JSON-Daten; keine Mystery-Auswahlplattform in der Schüleransicht.

## Tatsächlich ausgeführte Prüfungen

| Prüfung                                                                                                                         | Ergebnis                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Vollständige PNG-Zustandszyklen, je zehn Wiederholungen für 12 und 60 Karten                                                    | Bestanden; exakter Vergleich einschließlich Überlagerungsreihenfolge, Positionen, Kategorien, Labels und Richtung |
| Zehn zusätzlich tatsächlich gerenderte PNG-Export-/Importzyklen im Browser                                                      | Bestanden; identischer Zustand in jedem Zyklus                                                                    |
| A3-Canvas 4961 × 3508 für beide Datensätze                                                                                      | Bestanden; PNG-Abmessungen anhand IHDR geprüft                                                                    |
| Kleinere Ausgabe 2480 × 1754                                                                                                    | Bestanden; nach künstlichem Fehler der großen Canvas-Kodierung automatisch verwendet und wieder importiert        |
| Export bei verändertem Bildschirmzoom                                                                                           | Bestanden; erzeugte PNG-Bytes waren identisch                                                                     |
| Kleine Sicherung in neuem Browserfenster öffnen                                                                                 | Bestanden; danach Karte umgefärbt und vorhandene Verbindung umbeschriftet und umgedreht                           |
| Große Sicherung oberhalb QR-Limit                                                                                               | Bestanden; 60 Karten und 90 Verbindungen wiederhergestellt, anschließend bearbeitet                               |
| Beschädigte Bilddaten, abgeschnittene PNG, angehängte Daten, fehlende/doppelte Zustandsblöcke                                   | Zurückgewiesen                                                                                                    |
| Falsche Mystery-ID oder Version, unbekanntes Speicherformat, ungültige Karten/Verbindungen/Farben/Koordinaten/Labels/Kategorien | Zurückgewiesen                                                                                                    |
| Manipulierte Zustandsprüfsumme, übergroße deklarierte Entpackgröße, unvollständiger QR-Code, fremde URL                         | Zurückgewiesen                                                                                                    |
| Fehlgeschlagener Import bei geöffnetem Arbeitsstand                                                                             | Bisheriger Stand unverändert                                                                                      |
| Abgebrochener asynchroner Import                                                                                                | Bisheriger Stand unverändert                                                                                      |
| Karte ziehen, Fläche ziehen, Zoom, Übersicht, Lesefenster, Farben und Kategorien, neue Verbindung, Rückgängig                   | Bestanden                                                                                                         |
| Vorhandene Verbindung direkt an ihrer Beschriftung öffnen, bearbeiten, löschen, rückgängig                                      | Bestanden                                                                                                         |
| Zwei Finger auf schon angezogener Karte, Pinch/Pan und versetztes Loslassen                                                     | Bestanden in Chromium-Touch-Emulation; kein gespeicherter Zug und kein Klick                                      |
| Zwei Finger während Verbindungsauswahl                                                                                          | Keine ungewollte Verbindung                                                                                       |
| Offline nach Auslieferung der fertigen HTML-Datei                                                                               | Bedienung und eingebettetes Diagramm funktionieren, keine zusätzliche Laufzeitanfrage                             |
| Kamera verweigert                                                                                                               | Verständliche Meldung und weiterhin nutzbare Bildauswahl                                                          |
| Kameraablauf mit künstlichem Canvas-Videostream                                                                                 | Vollständiger QR-Zustand übernommen, Kamera-Track danach beendet                                                  |
| QR aus tatsächlich exportiertem kleineren PNG                                                                                   | Vollständig erkannt, Zustand identisch                                                                            |
| QR nahe der endgültigen Grenze (490–500 Zeichen) im kleineren PNG                                                               | Vollständig erkannt, Zustand identisch                                                                            |

Die Kameraprüfung nutzt einen künstlichen Videostream und ersetzt keinen optischen Scan mit einer echten iPad-Kamera. Touch-Emulation ersetzt keine Safari-/Hardwareprüfung.

## QR-Größen und geprüfte Grenze

Der unveränderte kleine Anfangsstand benötigt **278 Bytes** in der komprimierten Binärhülle und **375 ASCII-Zeichen** im vollständigen QR-Text. Dieser Code wurde aus dem gerenderten PNG gelesen. Zusätzlich wurde ein zufallsähnlich erweiterter Zustand im Bereich **490–500 Zeichen** aus der kleineren Ausgabe vollständig erkannt. Die feste Grenze beträgt jetzt **500 Zeichen einschließlich Präfix**, Fehlerkorrektur M, vier Module Ruhezone, ganzzahlige Modulgröße von mindestens vier Pixeln. Diese Werte belegen digitale Dekodierung; echte Kameradistanz und Druckqualität bleiben zu prüfen.

Der umfangreiche Anfangsstand benötigt **3.644 Bytes** in der Binärhülle bzw. theoretisch **4.863 QR-Zeichen** und überschreitet die Grenze deutlich. Er bekommt keinen QR-Code. Seine vollständige Original-PNG wurde erfolgreich wiederhergestellt.

Ein zunächst getesteter Grenzwert von 1.100 Zeichen scheiterte beim Lesen eines dichten Codes aus dem kleineren PNG. Daraufhin wurden die Grenze auf 500 gesenkt, der reservierte Exportbereich vergrößert und das Modulraster auf ganze Pixel festgelegt. Der finale Grenztest besteht. Es werden keine unvollständigen Sicherungen als QR ausgegeben.

## Sichtprüfung und Speichergrenzen

Die Arbeitsfläche und beide A3-Exporte wurden bildlich geprüft: vollständige Kartennummern, Diagramme, Farben, Beschriftungen und Pfeile; QR bzw. Originaldatei-Hinweis im eigenen Bereich unter dem Board. Eine versehentlich sichtbare Dateiauswahl und von Beschriftungen verdeckte kurze Linien wurden dabei korrigiert. Die Übersicht passt wieder vollständig in den sichtbaren Bereich.

A3-Export lief im Cloud-Chromium erfolgreich. Das große RGBA-Canvas benötigt allein rund 66,4 MiB, das kleinere rund 16,6 MiB, jeweils zuzüglich Browser-, Bild- und Kodierungsspeicher. Auf einem echten iPad wurden weder Speicherverbrauch noch Laufzeiten gemessen. Der automatische Rückfallweg ist nur für abfangbare Fehler bestätigt. Für schwache Geräte ist der kleine Export direkt im Menü erreichbar. Ein vom Betriebssystem beendeter Browserprozess kann nicht abgefangen werden.

Bei 60 Karten oder weit auseinandergezogenen Karten wird ein einzelnes Bild zwangsläufig dicht bzw. klein. Überlagerte Karten und gekreuzte Beschriftungen werden nicht automatisch inhaltlich umgeordnet. Die Daten bleiben vollständig; für gut lesbaren Druck beliebig großer Boards bleibt ein späterer mehrseitiger Export erforderlich.

## Offene praktische Abnahme und Umgebungsgrenzen

1. **Echtes Schul-iPad / Safari:** Gestenkonflikte, Leistung, große Exporte, Dateiablage mit Erhalt des privaten PNG-Blocks, Kameraqualität und Download-/Share-Verhalten nicht praktisch abgenommen.
2. **Canva Code:** Keine tatsächliche Ausführung oder Veröffentlichung dort. Das Artefakt ist eigenständig; unveränderte HTML-Ausführung, iframe-Sandbox, Downloads und Kamera müssen im konkreten Canva-Veröffentlichungsweg geprüft werden. Kompatibilität ist noch nicht bestätigt. Ein von Canva neu generierter Code gilt nicht automatisch als dieses getestete Artefakt.
3. **Lokale HTML-Datei:** Der verwaltete Cloud-Chromium verweigerte `file://` mit `ERR_BLOCKED_BY_ADMINISTRATOR`. Die fertigen Dateien wurden deshalb unverändert von einem lokalen statischen Testserver ausgeliefert. Die App selbst benötigt keinen Serverdienst oder externe API; der lokale Dateiöffnungsweg auf Zielgeräten ist noch zu prüfen.
4. **Integrität statt Urheberschaft:** SHA-256 und PNG-CRC erkennen beschädigte und inkonsistent geänderte Daten. Absichtliche Änderungen mit vollständig neu berechneten Prüfsummen sind ohne externes Vertrauen nicht kryptografisch auszuschließen; die Modellvalidierung bleibt aktiv.
5. **Browserfähigkeiten:** Pointer Events, HTML-Dialoge, moderne Canvas-APIs, Blob/Dateiauswahl und SVG werden benötigt. Eine Mindest-iPadOS-Version wurde nicht empirisch bestimmt.
6. **Pull Request:** Die GitHub-API wird vom Umgebungsproxy mit HTTP 403 verweigert. Das ist ein Zugriffsproblem der Entwicklungsumgebung, kein Laufzeitbedarf der Anwendung.

Die Schritt-für-Schritt-Abnahme steht in [PRAXISTEST.md](PRAXISTEST.md); das Speicherformat in [FORMAT.md](FORMAT.md). Keine Anwendung und keine neue Umgebung wurde veröffentlicht.
