# Vollständige MysteryBoard-Dokumente, Format 3

Dieses Format ergänzt den bisherigen Work-Codec. Es ersetzt weder MBS1/MBS2 noch eingefrorene RC2-Dateien. Die verbindliche Implementierung liegt in `src/core/documents.ts`, `media.ts`, `authoring.ts`, `png.ts` und im bestehenden `model.ts`. Die beiden Schemata werden lokal gebündelt; ihre URI-Kennungen lösen keine Netzwerkanfragen aus.

## Dokumenttypen und Verantwortlichkeiten

| Typ | Inhalt | Zusätzliche Daten | Beim Öffnen |
| --- | --- | --- | --- |
| `task` | Vollständige neutrale Aufgabe | keine privaten Autoren- oder Schülerfelder | Titel, neuer Teamname, neutraler Beginn |
| `draft` | Vollständige bearbeitbare Inhalte, auch noch nicht veröffentlichte Karten | `author.initials`, `status`, `hiddenCards` | Lehrkräfteeditor |
| `student` | Vollständige zugehörige Inhaltsfassung | validierter `work` | Schülerarbeit ohne Neusortierung fortsetzen |

Gemeinsame Felder: `format: "MysteryBoard"`, `formatVersion: 3`, `kind`, `content`, `contentHash`. Zusätzliche unbekannte Felder werden zurückgewiesen. Entwürfe können 0 Karten und einen leeren Titel enthalten. Aufgaben und Schülerstände benötigen 1–100 Karten und einen nicht leeren Titel.

`content` enthält dauerhafte ID, Inhaltsversion, Titel, optionalen Untertitel, Karten, explizite Gruppenmetadaten, optional Hilfen und eine neutrale Startanordnung. Karten enthalten Text und optionale eingebettete Bilder, Alternativtext, Quelle und strukturierte Tabelle. Eine Rastergrafik ist keine editierbare Text-/Tabellenstruktur.

`work` verwendet weiter das bestehende Schema 1/2: Mystery-ID, Inhaltsversion, Kartenpositionen/Farben, bis zu 300 Beziehungen mit IDs/Richtung/Beschriftung, sechs eigene Kategorien und optional Teamname. `validateWork` prüft sämtliche Referenzen gegen den mitgelieferten Inhalt. Neue Schülerexports verlangen einen Teamnamen. Altdaten ohne Team bleiben im passenden Legacy-Pfad zulässig; vor einem neuen Schülerexport erfolgt die Nachfrage.

`author.initials` ist maximal 40 Zeichen lang, ohne Steuerzeichen und nicht nur Leerraum. `status` ist `in-progress` oder `reviewed`; Bearbeitung setzt den Status auf `in-progress`. `hiddenCards` enthält gültige eindeutige Karten-IDs. Der Editor verwaltet die Veröffentlichungsfreigabe je Karte; beim Aufgabenexport werden verborgene Karten und sämtliche Autorenfelder entfernt. Die übrigen IDs, Anfangsdaten und Hilfereferenzen werden gemeinsam neu nummeriert.

## Drei unterschiedliche Versionsbegriffe

- **Anwendungsversion/Quellcommit:** Stand des Programms; wird in der Lieferung dokumentiert.
- **Dokumentformat:** `formatVersion: 3`; beschreibt vollständige portable Dokumente und ihren Container.
- **Inhaltsversion:** `content.version`, beispielsweise `1.0.17`; beschreibt diese konkrete Fassung eines Mysterys.

Der grafische Editor beginnt mit einer UUID-basierten Mystery-ID und Inhaltsversion `1.0.0`. Jede erfolgreich übernommene Inhaltsänderung erhöht den Patch-Anteil um eins. Direkte Formularänderungen am Titel/Untertitel/Methodentext können je Eingabe mehrere Revisionen erzeugen. Das reine Öffnen einer Aufgabe im Editor ändert ihre Version noch nicht. Die Strukturänderung an einer Karte wird beim Übernehmen oder bestätigten Löschen versioniert. Bei Patch 999999 wird eine weitere Änderung mit Erklärung abgelehnt; ein Überlauf ist ausgeschlossen.

Die CLI übernimmt eine explizit angegebene Inhaltsversion; eine externe Bearbeitung muss sie bewusst erhöhen. Ein Inhalts-Hash bindet außerdem den **gesamten** normalisierten Inhalt einschließlich Bilder, Gruppen, Hilfen und Startanordnung. Es wird nie ein fremder Arbeitsstand an aktuell geladene Karten angehängt. Eine ältere selbsttragende Sicherung ersetzt beim bewussten Import das ganze Dokument und lädt ihre eigene ältere Fassung.

Der Hash ist ein Integritätsmerkmal, **keine digitale Signatur oder Authentifizierung**. Wer eine lokale Kopie besitzt, kann eine neue gültige Datei erstellen. Das Autorenwerkzeug ist kein Berechtigungsmodell.

## JSON-Projektdatei `.mysteryboard`

UTF-8-JSON, maximal **20.000.000 Bytes**. `canonical()` sortiert Objektschlüssel rekursiv lexikographisch, lässt `undefined` weg, erhält Arrayreihenfolge und verwendet JSON-Zeichen-/Zahlendarstellung ohne Einrückung. SHA-256 über die UTF-8-Bytes des kanonisch **normalisierten** `content` ergibt den kleingeschriebenen 64-stelligen `contentHash`.

Die Normalisierung verwendet den bestehenden Mystery-Validator und ergänzt z. B. den neutralen Ausgangszustand. Daher nicht über eine beliebige rohe JSON-Datei hashen. `taskDocument`, `validateDocument` und `encodeDocument` sind die maßgeblichen Routinen. Der dokumentierte CLI-Weg erzeugt den korrekten Umschlag automatisch.

Der Browser liest ausschließlich vollständige Dokumente. Eine reine `content.json` wird zuerst mit `npm run create:mystery` in eine `.mysteryboard`-Aufgabe umgewandelt. Die CLI akzeptiert für ihre Validierung beide Formen sowie vollständige PNGs.

## Original-PNG

Das vorhandene private ancillary PNG-Chunk `mySt` enthält einen eindeutig neuen Datenblock:

| Byteoffset | Länge | Bedeutung |
| --- | ---: | --- |
| 0 | 4 | `4D 42 58 03` (`MBX`, Formatkennung 3) |
| 4 | 4 | Länge des unkomprimierten JSON, unsigned big-endian |
| 8 | 32 | SHA-256 des unkomprimierten vollständigen Dokument-JSON |
| 40 | variabel | zlib-komprimiertes JSON |

PNG-Signatur, Chunk-Struktur, CRCs, IEND, vorhandene Bilddaten und genau ein Sicherungsblock werden geprüft. Vor der Ausgabe wird die endgültige Dateigröße **einschließlich** des Blocks auf maximal **30.000.000 Bytes** geprüft. Bestehende Sicherungsblöcke werden beim Ersetzen abgezogen. Maximal 10.000 PNG-Chunks; die zusätzliche Einbettung prüft auch diese Endgrenze. Eine Datei, die dadurch unimportierbar wäre, wird nicht als Sicherung angeboten.

Die bisherige kleinere Exportvariante und der Rückfall beim großen Schülerexport bleiben erhalten. Schlägt auch dieser Weg fehl, erklärt die Anwendung den Fehler; die Projektdatei bleibt eine Alternative. Das Aufgaben-PNG im Editor nutzt direkt die kompakte Variante. Das sichtbare Bild ist nur eine Darstellung: Die vollständigen Daten liegen im Chunk. Auch im Bild verkürzte Tabellenhinweise ändern nichts am vollständigen gespeicherten Inhalt.

Komprimierte Daten werden in einen auf die deklarierte, geprüfte Länge begrenzten Puffer entpackt. Hash und Schema werden anschließend geprüft. Import/CRC/Entpacken laufen in einem eingebetteten Worker, mit 15-Sekunden-Grenze. Abbruch beendet den Worker; ein Vorgangstoken verhindert, dass verspätete Ergebnisse einen neueren Zustand überschreiben. Die Bilddecoderprüfung erfolgt anschließend einzeln, mit je acht Sekunden Grenze. Eine ungültige Datei ersetzt den geöffneten Stand nicht.

## QR und ältere Dateien

Legacy `MBS1`/`MBS2` und bestehende QR-Formate bleiben im bisherigen Codec unverändert. Sie enthalten keine vollständigen Inhalte. Die universelle Vorlage erkennt ältere Sicherungen und verweist ausdrücklich auf die ursprüngliche passende Mystery-HTML. Die unveränderte RC2-HTML lädt ihre bisherigen Dateien weiterhin.

Vollständige neue QR-Inhalte beginnen mit `MB3:` und transportieren URL-sicheres Base64 desselben MBX3-Blocks. Der aktuelle Zusatz ist auf 370 binäre Bytes und 500 Textzeichen begrenzt. Passt der gesamte Inhalt nicht hinein, wird kein QR erzeugt. Es gibt keinen abgeschnittenen Text-/Bildersatz und keinen externen Link. Große Dateien werden als Original-PNG oder Projektdatei transportiert. Reale Kameraerkennung und Freigaben im LMS sind separat auf dem Gerät zu prüfen.

## Medien, Tabellen und Sicherheitsgrenzen

| Bereich | Grenze / Prüfung |
| --- | --- |
| Karten | 1–100; Entwurf 0–100; eindeutige IDs 1 bis n |
| Titel / Kartentitel / Text | 100 / 100 / 4000 Zeichen |
| Untertitel / Quelle / Bildbeschreibung | 300 / 1000 / 300 Zeichen |
| Gruppen | explizite Referenz, kurzer Präfix bis 3 Zeichen, Bezeichnung bis 80 |
| Hilfe | Methodentext bis 500; 1–6 gültige Kategorien; keine mehrfach zugeordnete Karte |
| Bilddatei | PNG, JPEG, WebP; echte Signatur; maximal 3.000.000 Bytes |
| Bildabmessungen | 4096 Pixel je Achse, 4 Millionen Bildpunkte je Bild |
| Alle Bilder | maximal 12.000.000 Bytes und 24 Millionen Bildpunkte |
| Tabelle | 1–6 Spalten, 1–20 gleich breite Zeilen; Zellen bis 120 Zeichen |
| Schülerarbeit | bestehende Grenzen, z. B. 300 Beziehungen, 500 Zeichen je Pfeilbeschriftung, Team bis 80 |
| JSON / PNG / HTML | 20 MB / 30 MB / HTML strikt unter 10.000.000 Bytes |

Die Bildprüfung wertet vor dem Browserdecoder Dimensionen aus, lehnt Animation, fehlerhafte Container und inkonsistente WebP-Frames ab. Der Decoder muss anschließend erfolgreich lesen; gültige JPEG-Orientierung kann Breite/Höhe vertauschen. Bilder werden nicht auf ein anderes Seitenverhältnis gestreckt. Die Grenzen beschränken Speicherbedarf, sind aber **keine Messung oder Garantie des maximalen Safari-Speicherverbrauchs**.

Importierte Texte werden als Text gerendert, nicht als HTML. Keine externen Bild-URLs, SVG-Skripte, zusätzlichen ausführbaren Dokumentfelder oder dynamischen Imports aus Inhaltsdaten. Worker, Programm und Bibliotheken sind in der HTML enthalten. Kein Local-/SessionStorage, IndexedDB, Service Worker oder automatischer LMS-Upload für Arbeitsstände.

Die maschinenlesbaren Draft-7-Schemata definieren Struktur und statische Limits. Semantische Querverweise, zusammengezählte Byte-/Pixelbudgets, neutrale Anfangsdaten, tatsächliches Bilddecodieren und Hashes benötigen zusätzlich die gemeinsame Validierung. `npm run validate:mystery -- DATEI` und der Browserimport führen diese Prüfungen aus. Ein positives Ergebnis eines beliebigen Schema-Werkzeugs allein ist keine vollständige Abnahme.

## Druck, Hilfe und weitere Bearbeitung

Die bestehende Druckroutine erhält den dynamischen Inhalt. Neue optionale Quellen und Tabellen werden vollständig paginiert; Tabellen erscheinen im Druck als beschriftete Zeilen, im Lesefenster als HTML-Tabelle. Ab 30 Seiten warnt die Druckvorschau. PDF-Dateien sind weder Projektdateien noch Sicherungen.

Die Bearbeitung bewahrt Hilfemetadaten. Beim Entfernen von Karten werden Kategorienreferenzen angepasst; leere Kategorien entfallen. Die Anzeigehilfe selbst bleibt flüchtig. Schülerhistory, Farben und Beziehungen werden nicht ins Aufgabenformat kopiert.

Die neue Medienvergrößerung ist auf das Lesefenster beschränkt. `Board.tsx`, `history.ts` und der Legacy-`codec.ts` bleiben gegenüber dem Ausgangscommit byteidentisch. Anwendungshost und Editor verwenden den vorhandenen Board-Kern.
