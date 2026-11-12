# Nächste Funktionen – technische Spezifikation für Phase D

Stand: 12. November 2026. **Bewertung und nächster Auftrag, keine implementierten Funktionen und keine Gerätefreigabe.** Grundlage sind der universelle Kern auf `240d5fcfcac7e5924efe169493c9f7525ba5ed74` und die davon getrennte Druckentwicklung. Die eingefrorene Unterrichtsversion bleibt unverändert.

## Entscheidung und Reihenfolge

D1 und D2 heute nicht zusätzlich implementieren. Die Druckentwicklung benötigt zunächst ihre eigene vollständige Abnahme; eine tatsächliche Abnahme auf verwalteten Schul-iPads ist noch nicht belegt. Bildgesten und ein weiterer asynchroner Importweg würden gleichzeitig zwei empfindliche Bereiche erweitern. Für die Unterrichtserprobung am 13. November hat die gesicherte Fassung Vorrang. SCORM wird entsprechend dem Auftrag ausschließlich bewertet.

Danach in getrennten, kleinen Schritten: zuerst Bilddetails für ein konkret geprüftes medienreiches Mystery, anschließend QR aus einer Bilddatei. Je Schritt erst gezielte Positiv-/Negativtests, dann die gesamte aktuelle Regression und die Geräteprüfung; erst danach Übernahme in den stabilen Stand. Alle Funktionen gehören zum gemeinsamen Kern und werden mit kleinen, großen, Boden-, Fünf-Karten- und 220-Verbindungen-Inhalten geprüft. Keine Inhaltsversion, Karten-ID oder Speicherstruktur wird allein wegen einer neuen Ansicht geändert.

## Bestehende Schnittstellen und Schutzregeln

- `src/core/model.ts`: Medien liegen ausschließlich als eingebettete Daten in `CardContent.image`, mit `imageAlt`. Gruppen und sichtbare Präfixe sind Inhaltsmetadaten. `Work` speichert numerische IDs und den Arbeitsstand, keine Bildansicht oder Zoomposition.
- `src/App.tsx` und `src/style.css`: Das Lesefenster zeigt ein normales `<img>` mit `object-fit: contain`, voller verfügbarer Breite und höchstens 230 CSS-Pixeln Höhe. Es gibt noch keine eigene Bilddetailansicht. Fein gedruckte Legenden können deshalb zu klein sein.
- `src/components/Board.tsx`: R1b beendet gültige Boardtipps bei `pointerup`. Der Klickschutz im Capture-Abschnitt des Dokuments verhindert Folge-Klicks ohne neue vollständige Geste am selben noch vorhandenen Bedienelement. Capture-Verlust hebt einen Finger nicht auf; Mehrfingerfolgen bleiben bis Up/Cancel verbraucht. Unterschiede zwischen Pointer-ID/-Typ bei Down/Up und anschließendem Klick sind berücksichtigt.
- `src/core/png.ts`: Original-PNGs werden vollständig strukturell und per CRC geprüft, ohne das Bild als Bitmap zu dekodieren. Genau ein `mySt`-Block ist zulässig. Fehlen, Beschädigung, Duplikate und nicht passende Zustände führen heute zu Fehlern; es existiert kein QR-Datei-Fallback.
- `src/core/codec.ts`: Schema/MBS/MB1 und Schema/MBS/MB2 werden streng abgeglichen. SHA-256, begrenzte Dekomprimierung, Mystery-ID, Inhaltsversion und vollständiges Modell müssen passen. QR-Limit: 500 ASCII-Zeichen einschließlich Präfix; unbekannte URLs werden nicht geöffnet.
- `src/core/qr.ts` verwendet bereits das gebündelte `jsqr` über `scanPixels`. Dieser Aufruf liefert höchstens einen Treffer; er beweist nicht, dass im Bild nur ein Code vorhanden ist. `Camera.tsx` liest derzeit Kameraframes auf einem 640 Pixel breiten Canvas, stoppt die Kameratracks und führt die Ergebnisse über `fromQr` zur Zustandsprüfung.
- `App.importFile` ersetzt den Zustand erst nach vollständiger Prüfung. Die Vorgangsnummer `operation` verwirft Ergebnisse nach Schließen, Abbruch oder einem neueren Auftrag. Export und Import dürfen einen verworfenen Auftrag nicht später wieder sichtbar machen. Eine gültige teamlose Altsicherung bleibt importierbar; die Namenspflicht vor einem neuen Schülerexport bleibt bestehen.

## D1 – Generische Bilddetailansicht

### Bedienung und Daten

Im bestehenden Kartenlesefenster erhält ein vorhandenes Bild eine klar beschriftete Aktion „Bild vergrößern“. Keine neue dauerhaft sichtbare Board-Schaltfläche. Diese Aktion wird allein aus `card.image` abgeleitet, ohne Fach-, Mystery- oder Kartennummern-Sonderfall.

Vorzugsweise bleibt derselbe Karten-Dialog geöffnet und wechselt seinen Inhalt zwischen Lesen und Bilddetail; keine Kette verschachtelter modaler Dialoge. „Zur Karte“ führt zum selben Lesefenster zurück, „Schließen“ beendet dieses. Kartenkennung einschließlich konfiguriertem Präfix, Bildbeschreibung und Bildquelle bleiben zugeordnet. Fokus kehrt zum auslösenden Bildbutton zurück; Escape und Tastaturbedienung werden ausdrücklich geprüft.

Die Ausgangsansicht passt das vollständige Bild proportional und zentriert in den verfügbaren Raum ein (`contain`). Quadrat, Hochformat und Panorama dürfen weder gestreckt noch beschnitten werden. Ein temporärer Bildausschnitt beim bewussten Zoomen ist zulässig; „Ganzes Bild“ stellt den vollständigen Inhalt wieder her. Ansicht und Transformation gehören ausschließlich zum lokalen Komponentenstatus: kein `commit`, kein History-Eintrag, keine Änderung an `Work`, IDs, Gruppenzuordnung, `dirty`, PNG oder QR.

Bildvergrößerung verwendet das bereits eingebettete Original über `<img>`; kein `innerHTML`, keine neue externe Bildquelle und kein zusätzlicher großer Canvas. Eine pixelarme Rasterdatei gewinnt durch Zoom keine fachlichen Details. Unzureichende Ausgangsauflösung oder unleserliche Legenden müssen als Inhaltsproblem dokumentiert werden.

### Touch und Rückkehr

Eine eigene Bildfläche verwaltet ausschließlich ihre Bildgesten. Ein Finger verschiebt ein bewusst vergrößertes Bild; zwei Finger zoomen um ihren gemeinsamen Bezugspunkt. Ein begrenzter Zoom, etwa 1–4 relativ zur eingepassten Ansicht, ist ein zu prüfender Startwert, keine bereits abgenommene Vorgabe. Temporäre Plus-/Minus-/„Ganzes Bild“-Kontrollen mit ausreichenden Touchflächen ermöglichen dieselbe Bedienung ohne Pinch.

`touch-action` und Pointer-Capture werden nur auf die Bildfläche begrenzt. Auf Schließen-/Zurück-Buttons und außerhalb der Bildfläche bleibt normale Bedienung erhalten. Kein globales `preventDefault`, kein Zurücksetzen der R1b-Zustandsmaschine und keine pauschale Klicksperre nach Zeit. Bloßes `stopPropagation()` auf der Bildfläche genügt nicht als Schutzkonzept, weil der vorhandene Dokument-Capture-Listener früher läuft.

Der Vorschlag nutzt den unveränderten R1b-Schutz: Der Board-SVG ist kein Vorfahr der Bildfläche, die modale Ansicht verhindert direkte Treffer auf die Arbeitsfläche. Bild-Pointer erhalten eigene Erfassung und Abbruchbehandlung. Up, Cancel, `touchcancel`, Capture-Verlust, das Entfernen der Ansicht und versetztes Loslassen müssen die Bildgeste eindeutig beenden bzw. verwerfen. Der letzte Finger einer Mehrfingerfolge darf nicht zu einer Boardaktion werden. Ein nachlaufender Klick darf weder die zurückgekehrte Karte auswählen noch deren Schließen-/Löschen-Button bedienen. Ein neuer bewusster Button-Tipp muss unmittelbar funktionieren.

### Abnahme D1

- Alle drei Produktions-HTMLs sowie Fünf-Karten- und 220er-Test; Bilder nur aus den jeweiligen Inhaltsdaten.
- Quadratische, hohe und breite Rasterbilder sowie SVG; native Proportionen, vollständige Ausgangsansicht und Wiederherstellung nach „Ganzes Bild“ messen.
- Komplexe Karte mit kleiner Legende und Diagramm mit feinen Achsenbeschriftungen auf 768×1024 und 1024×768 visuell prüfen. Fachliche Lesbarkeit durch Lernende bzw. Lehrkraft bestätigen, nicht allein aus einer CSS-Schriftgröße ableiten.
- Öffnen, Pinch, Verschieben, Zurück, erneutes Öffnen, Escape, Fokus-Rückgabe; gedrehte Geräteansicht und Unterbrechung einer Geste.
- Pointer-Cancel/Capture-Verlust, versetztes Loslassen, mehrere Finger sowie alte Klicks ohne neue Down-/Up-Folge, einschließlich 450-ms-Verzögerung. R1b-ID-/Typwechsel und neue bewusste Button-Tipps unverändert prüfen.
- Vorher/nachher exakt gleicher vollständiger Arbeitsstand; keine neue History, kein geänderter Sicherungsstatus. PNG-Rundlauf, Gruppenkennungen, Verbindungen und Offline-Anfragen unverändert.
- Wiederholtes Öffnen/Schließen auf einem realen verwalteten iPad auf Speicherverbrauch und verständliche Bedienung prüfen. Browseremulation ersetzt diese Abnahme nicht.

## D2 – QR-Wiederherstellung aus einer ausgewählten Bilddatei

### Eigene Aktion, Original-PNG hat Vorrang

Eine zusätzliche Aktion „QR-Code aus Bild lesen“ gehört in den bestehenden Fortsetzen-Dialog. „Sicherungsbild auswählen“ bleibt der eindeutige Original-PNG-Weg. Kein automatischer Wechsel in die QR-Erkennung nach irgendeinem Importfehler.

Vor einer späteren Implementierung ist die PNG-Prüfung um ein typisiertes Ergebnis bzw. Fehlercodes zu ergänzen. Die Entscheidung darf nicht von deutschen Fehlermeldungstexten abhängen. `no-state` darf ausschließlich nach vollständiger gültiger PNG-Prüfung und festgestelltem Fehlen von `mySt` entstehen. Ein zerstörter, abgeschnittener oder CRC-fehlerhafter PNG-Container ist kein Nachweis für „kein Zustandsblock“.

| Ausgewählte Datei / Prüfergebnis | Zulässiger Weg |
| --- | --- |
| Gültige Original-PNG, genau ein vollständig gültiger und kompatibler `mySt`-Zustand | Originalzustand hat Vorrang, auch über die ausdrückliche QR-Bild-Aktion. Kein Bilddecode und kein QR-Abgleich nötig. |
| `mySt` vorhanden, aber beschädigt, doppelt, nicht unterstütztes Schema oder falsche Mystery-ID/Inhaltsversion | Abweisen; geöffneten Stand erhalten. **Kein QR-Fallback**, auch dann nicht, wenn ein lesbarer QR eine andere oder ältere gültige Sicherung enthält. |
| PNG-Container beschädigt, Struktur/CRC unklar oder nach IEND angehängte Daten | Abweisen. Nicht als zustandslos behandeln und nicht über sichtbare Pixel „retten“. |
| Vollständig gültige PNG ohne `mySt` | Originalaktion meldet fehlenden Zustand. QR-Erkennung erst nach der ausdrücklich gewählten QR-Bild-Aktion. |
| Unterstützte echte JPEG-Bilddatei ohne PNG-Container | Nur innerhalb der ausdrücklichen QR-Bild-Aktion dekodieren. Dateityp anhand Signatur prüfen; Dateiendung/MIME allein genügen nicht. |
| Unbekanntes, widersprüchlich deklariertes oder nicht unterstütztes Format | Verständlich abweisen; für den ersten Schritt PNG und JPEG vorsehen, kein SVG-/HEIC-/animierter Bildimport. |

Das vorgeschlagene Ergebnis könnte `state(work)`, `no-state` oder einen eindeutig benannten Fehler enthalten. Der vorhandene `restorePng`-Vertrag und seine bisherigen Prüfungen müssen erhalten bleiben. Keine zweite, schwächere Implementierung des PNG-Parsers.

### Begrenzte Verarbeitung und Mehrdeutigkeit

Die bestehende Original-PNG-Grenze **30.000.000 Bytes** bleibt unverändert und wird vor `arrayBuffer()` geprüft. Für den ersten QR-Datei-Weg dieselbe Obergrenze verwenden. Sie begrenzt jedoch nicht den dekodierten Pixelspeicher.

Vor einem Rasterdecode müssen Abmessungen aus den gültigen Dateistrukturen bestimmt und gegen ein konservatives Budget geprüft werden. Vorschlag für die Geräteabnahme: höchstens 16 Millionen Quellpixel, höchstens 8192 Pixel je Quellkante; maximal zwei Millionen Verarbeitungspixel und 2048 Pixel je Canvas-Kante. Dies sind zu verifizierende Startwerte, keine iPad-Speichergarantie. Ein gültiger `mySt`-Import benötigt kein Rasterdecode und darf durch diese zusätzlichen QR-Rastergrenzen nicht unnötig eingeschränkt werden.

Ein vollständiges, proportional herunterskaliertes Bild zuerst prüfen; transparente Pixel auf Weiß zeichnen. Für genauere Versuche nur wenige begrenzte Ausschnitte/Skalen nacheinander verwenden, nie eine unbeschränkte Vergrößerung oder mehrere große Canvas-Flächen. Ausgabegrenzen und Zeitbudget vor jedem Versuch prüfen. Bei zu geringer Modulauflösung, überschrittenen Grenzen oder fehlendem Treffer deutlich zur Original-PNG beziehungsweise einem engeren Bildausschnitt mit vollständigem Code und Ruhezone auffordern. Kein Qualitätsversprechen für jeden Screenshot, jede Kompression oder Rotation.

`scanPixels`/das vorhandene `jsqr` kann wiederverwendet werden; keine CDN-, OCR-, Netzwerk- oder kostenpflichtige Decoderabhängigkeit. Die aktuelle Kameraverkleinerung auf 640 Pixel darf nicht ungeprüft für ganze Dokumentbilder übernommen werden. Sie kann einen kleinen QR in einem großen Screenshot unlesbar machen.

**Mehrere Codes sind ein eigener Abnahmefall.** `jsqr` liefert einen ersten Treffer, keine verlässliche Aussage über alle Codes im Bild. Nicht blind den ersten passenden oder zuletzt gefundenen Zustand übernehmen und nicht nach Fehlern einfach zum nächsten Code wechseln. Ein begrenzter Suchlauf mit Ausmaskieren gefundener Bereiche kann Mehrfachtreffer erkennen, beweist aber nicht allgemein deren Abwesenheit. Bei mehreren erkannten Codes oder unklarer Zuordnung abbrechen und ein Bild mit genau einem vollständig sichtbaren Code verlangen. Eine robuste Auswahl-/Ausschnittfunktion wäre ein gesondert zu begrenzender Erweiterungsschritt.

Ein QR-Kandidat wird erst durch `fromQr` vollständig geprüft. Danach soll die Bilddatei-Ansicht vor dem Ersetzen Mystery, Teamangabe und Kartenzahl zeigen und eine bewusste Übernahme verlangen; die bereits vorhandene Warnung zum Ersetzen des geöffneten Stands bleibt erhalten. Diese Bestätigung ist kein Ersatz für Mehrfachcode-Prüfung. Es werden keine URLs aus Codes geöffnet, keine abgeschnittenen Nutzdaten akzeptiert und keine fehlenden Teamangaben erfunden.

### Abbruch und atomare Übernahme

Neue Bildjobs übernehmen das bestehende Vorgangsnummernprinzip. Schließen, erneute Auswahl und eine inzwischen erfolgte andere Wiederherstellung machen ältere Ergebnisse wirkungslos. Während Erkennung und Vorschau bleiben `Work`, History und `dirty` unangetastet; erst die gültige bewusste Übernahme verwendet den bestehenden `accept`-Pfad.

Maximal ein Bild-/Canvas-Job gleichzeitig. Ein bereits laufender synchroner Decoder lässt sich nicht mitten im Aufruf abbrechen: Zwischen begrenzten Versuchen an die Oberfläche zurückgeben, Vorgangsnummer erneut prüfen und den verworfenen Job vollständig freigeben, bevor ein neuer großer Job beginnt. Blob-URLs widerrufen, Bitmaps schließen, Canvas-Flächen zurücksetzen und Referenzen auch bei Fehler/Abbruch lösen. Teamlose Schema-1-Zustände bleiben gültig; vor dem nächsten Schülerexport greift unverändert die zentrale Namenspflicht.

### Abnahme D2

- Unveränderte Original-PNGs mit 12, 18, 60 und fünf Karten; echter 220er-Zustand und beide Speicherschemas. Originaldaten müssen auch dann gewinnen, wenn der sichtbare QR einen anderen gültigen Stand enthält.
- Gültige Container ohne `mySt`; echte QR-Screenshots in PNG/JPEG; vollständiger Zustand nach Import in neuem Kontext und weitere Bearbeitung.
- Beschädigte SHA-/Zlib-Daten, fehlerhafte Chunk-CRC, doppelte Blöcke, abgeschnittene Dateien, zusätzliche Daten hinter IEND, falsche Mystery-ID/Inhaltsversion und ungültige Team-/Kartenwerte: auch mit daneben sichtbarem gültigem QR **keine** Übernahme.
- Falsches QR-Präfix, MB1/MB2-Widerspruch, über 500 Zeichen, fremde URL, verlorene Ruhezone, mehrere widersprüchliche Codes, kein Code, stark verkleinerter und unscharfer Code; Zustand und Historie bleiben bei Ablehnung exakt erhalten.
- 30-MB-Dateigrenze, sehr kleine komprimierte Dateien mit riesigen Pixelmaßen, ungültige Dimensionen, EXIF-Drehung, Transparenz sowie Raster-/Canvas-Grenzen prüfen, bevor große Speicherflächen entstehen.
- Abbruch vor/während/nach Decode, schnelle zweite Dateiauswahl, erneut gewählte identische Datei, Schließen der Kandidatenansicht und konkurrierender anderer Import. Ein verspätetes Ergebnis darf weder einen Dialog noch einen alten Stand öffnen.
- Vorher-/Nachher-PNG-Vergleich, keine dauerhafte Speicherung, keine externen Anfragen, tatsächliche Speicher-/Reaktionszeit auf Ziel-iPads. Bereits funktionierende Kameraerkennung und R1b-Touchbedienung vollständig regressieren.

Bis diese Fälle bestanden sind, bleibt D2 ein Vorschlag. Ein bestandener Einzelcode-Test allein genügt nicht für die Behauptung allgemeiner Screenshot-Wiederherstellung.

## D3 – Optionale SCORM-1.2-Verpackung für itslearning

Heute keine SCORM-Implementierung. Als kleinste spätere Erprobung dieselbe geprüfte Einzel-HTML unverändert in ein Content-Package legen, zusammen mit `imsmanifest.xml` im ZIP-Wurzelverzeichnis. Das Manifest enthält nur öffentliche Inhaltsmetadaten, eine Organisation mit einem Start-Item und genau eine Ressource. Der zentrale Ressourcentyp wäre:

```xml
<resource identifier="mysteryboard" type="webcontent"
          adlcp:scormtype="asset" href="MysteryBoard.html">
  <file href="MysteryBoard.html" />
</resource>
```

Dies ist nur ein Fragment der vorgeschlagenen Manifeststruktur, kein fertiges oder geprüftes Paket. Ein vollständiges Manifest muss SCORM-1.2-Metadaten, Namespaces und die passende Organisation/Item-Referenz enthalten und vor einem LMS-Test lokal validiert werden.

Ein **Asset** benötigt keine SCORM-Runtime-Aufrufe. Ein als SCO deklariertes Paket hätte dagegen einen vorgesehenen LMS-Lebenszyklus; ein Wrapper ohne diese Kommunikation darf nicht als interoperables SCO ausgegeben werden. Daher zunächst ausdrücklich prüfen, ob itslearning die Asset-Variante akzeptiert. Falls nicht, bleibt dies eine offene Produktentscheidung; keine heimliche Ergänzung von Trackingaufrufen, um einen Importtest zu bestehen. Eine freigegebene statische HTTPS-Auslieferung bleibt unabhängig möglich.

Ein optionaler Wrapper darf ausschließlich eine Start-/Darstellungsseite sein. Direkter Start der unveränderten HTML ist vorzuziehen; zusätzliche Frames können verfügbare Fläche, Kamera-/Dateizugriff und Downloads auf iPads erschweren. Die separat gelieferte Einzel-HTML muss unverändert und ohne LMS weiterhin offline nutzbar sein.

### Verbindliche Daten- und Bewertungsgrenzen

- Keine Suche nach einem LMS-API-Objekt, keine Initialisierungs-/Commit-/Finish-Aufrufe und keine LMS-Lese-/Schreibaufrufe in dieser Asset-Variante.
- Insbesondere keine `cmi.suspend_data`, `cmi.core.lesson_location`, `cmi.interactions.*.student_response`, sonstigen Antworten, Kommentare, Teamnamen oder Spielstände im LMS. Keine API für das Speichern/Wiederaufnehmen des Mystery-Zustands.
- Keine Bewertung, Punkte, Bestehensentscheidung oder von der Anwendung gesetzte Abschlussmeldung. Keine fremden SCORM-/Analysebibliotheken.
- Keine Datenübertragung über URL-Parameter, Formulare, `postMessage`, Fetch/XHR/Beacon oder einen Wrapper. Keine Ableitung der Teamangabe aus LMS-Klarnamen. Der Name bleibt selbstgewählt und ausschließlich im laufenden Zustand sowie bewusst erzeugten Sicherungen.
- Die freiwillige Original-PNG bleibt der maßgebliche Wiederherstellungsweg. Ein LMS-Resume ersetzt sie nicht.

**Abgrenzung:** Anmeldung, Kurszugriff, Dateiaufruf oder Startzeit können vom LMS selbst protokolliert werden. MysteryBoard kann diese plattformeigene Verarbeitung nicht ausschalten oder zusagen, dass keinerlei LMS-Protokolle entstehen. Belegt werden kann nur, dass Anwendung und eigener Wrapper keine Schülerzustände oder Teamdaten übermitteln; die tatsächlich geltenden LMS-Einstellungen sind separat zu prüfen.

### Offene Abnahme D3

itslearning-Import und Start als Schülerkonto tatsächlich durchführen; keine Kompatibilitätszusage allein aufgrund eines gültigen Manifests. Danach Teamansicht, Touch, verfügbare Fläche, Original-PNG-Download in „Dateien“, vollständiges Beenden, erneuter Start, Dateiimport und Weiterbearbeitung auf zwei verwalteten Schul-iPads prüfen. In einer kontrollierten Testumgebung API-Spies und Netzwerkmitschnitt für den Anwendungsframe verwenden und Anwendungsvorgänge von LMS-eigenen Requests trennen. Daten-, Team- und Bewertungsübertragungen dürfen nicht auftreten. Die HTML-Prüfsumme muss innerhalb und außerhalb des Pakets identisch sein.

SCORM kann erst nach dieser eigenständigen Abnahme angeboten werden. Es ist kein Bestandteil der eingefrorenen Unterrichtsdatei und nicht Voraussetzung für die praktische Erprobung am 13. November.
