# Speicherformat 1

## Zustandsmodell

`Work` enthält `schema: 1`, `mystery`, `version`, `cards`, `edges`, `categories`. Die Inhalte stehen getrennt in der HTML-Datei. Identische Mystery-ID und Inhaltsversion sind erforderlich. Kartentexte und Bilder werden nicht in den Speichercode dupliziert.

Karten sind `{id, x, y, color}`. Die Reihenfolge im Array bestimmt die Überlagerung. Verbindungen sind `{id, from, to, direction, label}`; Richtung 0 = ohne, 1 = von `from` nach `to`, 2 = umgekehrt. Sechs festgelegte neutrale Farbtöne einschließlich Weiß; sechs frei benennbare Kategorien. Beschriftungen werden als Text dargestellt, nie als HTML.

Vor der Komprimierung wird folgende kompakte UTF-8-JSON-Struktur verwendet:

```text
[1, mysteryId, mysteryVersion,
 [[cardId, x, y, colorIndex], ...],
 [[edgeId, fromId, toId, direction, label], ...],
 [categoryName0, ..., categoryName5]]
```

Koordinaten bleiben als JSON-Zahlen ohne verlustbehaftete Komprimierung erhalten. Die Bedienung setzt neue Positionen auf 0,01 Arbeitsflächeneinheiten. Der Serializer verändert vorhandene Positionen nicht.

## Binärhülle

| Offset | Länge    | Inhalt                                 |
| ------ | -------- | -------------------------------------- |
| 0      | 4        | `4d 42 53 01` (MBS, Version 1)         |
| 4      | 4        | unkomprimierte UTF-8-Länge, Big Endian |
| 8      | 32       | SHA-256 der unkomprimierten JSON-Bytes |
| 40     | variabel | Zlib/Deflate-Komprimierung, Stufe 9    |

Limits: PNG maximal 30.000.000 Bytes; komprimierter Zustandsblock maximal 500.000 Bytes; dekomprimierter Zustand maximal 1.000.000 Bytes. Die Dekomprimierung erhält einen vorab begrenzten Ausgabepuffer. Zustandsprüfung: exakte Kartenmenge, eindeutige IDs, endliche Koordinaten ±100.000, Farben 0–5, bis 300 eindeutige Verbindungen ohne Selbstverknüpfung, maximal 500 Zeichen pro Beschriftung, 40 Zeichen pro Kategoriename. Unbekannte Felder werden nicht übernommen.

SHA-256 und PNG-CRC erkennen Beschädigung und nicht konsistent nachgezogene Änderungen. **Keine kryptografische Authentizität:** Wer absichtlich Daten umschreibt und sämtliche Prüfsummen neu berechnet, kann eine formal gültige Sicherung herstellen. Ohne Geheimnis oder externe Vertrauensinstanz kann eine rein lokale Anwendung keine Urheberschaft nachweisen. Semantisch ungültige Daten werden auch mit gültigen Prüfsummen zurückgewiesen.

## Original-PNG

Vor `IEND` wird genau ein privater ancillary/safe-to-copy-Chunk `mySt` eingefügt. Sein Inhalt ist die Binärhülle. Der PNG-Parser prüft Signatur, Chunkgrenzen, Typbezeichnungen, CRC sämtlicher Chunks, IHDR/IDAT/IEND und genau einen Sicherungsblock. Ein vorhandener eigener Block wird beim erneuten Einbetten ersetzt. Kein Rest hinter IEND ist zulässig. Der Import parst den Zustand ohne ein großflächiges Bitmap zu dekodieren.

Der Dateiaustausch ist atomar auf Anwendungsebene: Lesen, Integritätsprüfung, Inhalts- und Schemaabgleich, vollständige Modellprüfung; erst dann den geöffneten Zustand ersetzen. Abbrechen invalidiert die laufende Leseoperation. Es gibt kein localStorage, IndexedDB, Service Worker, automatisches Speichern oder Netzwerk-Upload.

## QR

`MB1:` + Base64url der identischen Binärhülle, ohne `=`-Padding. Höchstens **500 ASCII-Zeichen einschließlich Präfix**, Fehlerkorrektur M, Ruhezone vier Module. Die Ausgabe verwendet ein ganzzahliges Raster mit mindestens vier Bildpunkten pro Modul; der Code wird danach nicht skaliert. Darüber wird **kein** Code erzeugt. Der Grenze liegt eine bewusst begrenzte Symboldichte zugrunde, keine Zusage für jede Kamera oder Druckgröße. Der gesamte Zustand wird kodiert; keine URL, kein Verweis und keine gekürzte Sicherung.

PNG-Export reserviert einen eigenen unteren Bereich für Hinweise und QR. Auf kleinen Ausgaben müssen Codegröße, Druckqualität und Entfernung praktisch geprüft werden. Wenn der Code zu dicht oder nicht lesbar ist, bleibt die Originaldatei maßgeblich.

## Export und Speicherbudget

- Groß: 4961 × 3508 Pixel, A3-Seitenverhältnis (etwa 300 dpi bei passender Druckskalierung).
- Klein: 2480 × 1754 Pixel, etwa 150 dpi.
- PNG enthält keine verbindliche Drucker-DPI-Einstellung; im Druckdialog A3 quer und passende Skalierung wählen.
- Das große RGBA-Canvas allein benötigt 69.612.752 Bytes (rund 66,4 MiB); Kodierung, PNG und Browserkopien benötigen zusätzlich Speicher. Der kleinere Puffer benötigt 17.399.680 Bytes (rund 16,6 MiB).
- Die Bitmapgröße ist fest und hängt niemals von Arbeitsflächenabständen oder Bildschirmzoom ab. Exportlayout wird aus Inhalt, Zustand und Zielgröße neu berechnet. Alle Kartentexte und Bilder werden gezeichnet.
- Bei abfangbarem Fehler des großen Exports wird der kleine versucht; dieser ist zusätzlich direkt über Menü → „Kleineres Sicherungsbild“ wählbar, ohne zuerst ein großes Canvas anzulegen. Ein vom Betriebssystem beendeter Browserprozess ist nicht abfangbar. Deshalb muss die kleinere Größe vorab auf speicherarmen iPads getestet werden.
- Sehr weit auseinandergezogene oder stark überlagerte Karten und dichte Verbindungsbeschriftungen bleiben auch im Export entsprechend klein bzw. überlagert. Keine automatische inhaltliche Umsortierung. Für lesbaren Druck großer Boards werden später Seitenaufteilung und ein eigener Druckmaßstab gebraucht.

Gemeinsame Geometrie und ein separater Renderer bilden die Grundlage für spätere Seitenkacheln. Das erste Format bleibt PNG. Es sind keine PDF-/SCORM-Ausgaben vorgetäuscht.

## Bedienmodell

Eine Pointer-Geste beginnt als Kandidat für Antippen, Kartenziehen oder Flächenziehen. Erst ab acht Bildschirmpixeln wird gezogen. Zwei beteiligte Finger wechseln in Pinch/Pan und verwerfen die unbestätigte Kartenverschiebung. Bis alle Finger losgelassen sind, entsteht daraus kein neuer Klick oder Einzel-Finger-Zug. Pointer-Cancel verwirft die Vorschau. Im Verbindungsmodus erzeugt nur ein bewusstes Antippen eine Zielauswahl; Ziehen verbindet nicht.

Die Kartenansicht ist SVG; das Lesefenster ist normales HTML mit eigener Schriftgröße. Dadurch bleiben Lesegröße und Dialogbedienung unabhängig vom Boardzoom. Zahlen werden beim Herauszoomen begrenzt gegenskaliert. Im Export wird eine feste, vollständig innerhalb der Exportgrenzen liegende Nummernmarkierung gezeichnet.

React Flow wurde für diesen abgegrenzten Prototyp nicht eingebunden: Es wären zusätzliche Überschreibungen für die Zwei-Karten-Auswahl und das Rücksetzen schon begonnener Kartengesten nötig gewesen. Die kleine eigene Zustandsmaschine hat keine Anschlusspunkte und lässt sich gezielt per Pointer-/Touch-Test prüfen. Die tatsächliche Safari-Gestenerkennung bleibt eine eigene Abnahme.
