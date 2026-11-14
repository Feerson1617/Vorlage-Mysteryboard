# Inhalts- und Speicherformate

## Inhaltsmetadaten

Jedes Mystery ist eine eigene Inhaltsdatei mit `id`, `version`, `title` und `cards`. Für neue Inhalte ist `initial` optional; ohne Anfangspositionen verwendet die Vorlage die nummerisch geordnete Startablage. Ein vorhandenes `initial` legt weiterhin Positionen, Farben, Verbindungen und die sechs Kategorien fest. Inhalte werden beim Build gebündelt und nicht aus einer Sicherung übernommen.

Optional definiert `cardGroups` benannte Gruppen als `{label, prefix}`; jede Karte verweist mit `group` ausdrücklich auf einen solchen Schlüssel. Beispiel: `cardGroups: {required: {label: "Pflicht", prefix: ""}, extension: {label: "Vertiefung", prefix: "V"}}`. Die sichtbare Kennung ist Präfix plus numerische Karten-ID. Es gibt keine Kartennummerngrenze für Vertiefungskarten. Ohne Gruppen bleibt die bisherige Nummerierung unverändert.

Gruppenschlüssel sind 1–40 Zeichen lang, beginnen mit einem ASCII-Buchstaben und enthalten anschließend nur Buchstaben, Ziffern, `_` oder `-`; reservierte Prototypnamen sind ausgeschlossen. Gruppenlabels enthalten 1–80 Zeichen, Präfixe höchstens drei UTF-16-Codeeinheiten ohne Leerraum oder Steuerzeichen. Unbekannte Gruppen und kollidierende sichtbare Kennungen werden abgelehnt. Gruppenzuordnung, Titel, Texte und Bilder gehören zur Inhaltsversion; gespeichert werden weiterhin numerische IDs.

## Startablage

| Inhaltskonfiguration | Verhalten beim Beginn |
| --- | --- |
| Kein `initial`, kein `startLayout` | Neuer Standard: numerisch geordnete, neutrale Ablage |
| Vorhandenes `initial`, kein `startLayout` | Bestandslayout vollständig beibehalten |
| `startLayout: {"mode":"explicit"}` mit `initial` | Explizites Layout vollständig beibehalten |
| `startLayout: {"mode":"ordered"}` | Ausdrücklich gewählte nummerische Ablage; eventuell vorhandene Anfangskoordinaten werden nur beim Beginn neu berechnet |
| `startLayout: {"mode":"ordered","columns":6}` | Optional feste Spaltenzahl statt automatischer Wahl |

`mode` ist `ordered` oder `explicit`. Nur `ordered` erlaubt `columns`, eine ganze Zahl von 1 bis 12. Zusätzliche Layoutfelder, unbekannte Modi oder `explicit` ohne Anfangspositionen werden abgewiesen. Wird `ordered` zusammen mit einem `initial` verwendet, muss dieses ohne Verbindungen, Kartenfarben und Kategorien sein; ein fachlich vorbelegter Start darf nicht versehentlich zur neutralen Ablage erklärt werden.

Geordnet wird nach der numerischen Karten-ID, niemals nach Anzeigetext, Präfix oder einer Hilfekategorie. Ohne feste Spaltenzahl wählt die Anwendung beim Beginnen ein zum aktuellen Fensterformat und zur Kartenanzahl passendes Raster. Zeilenhöhen berücksichtigen die tatsächlich gemessenen Karten einschließlich Bilder; Abstände reservieren Platz für die größtmögliche begrenzte Nummernmarkierung und freie Verbindungen. Eine neue Sitzung in anderem Fensterformat kann daher eine andere Spaltenzahl haben. `Übersicht`, Fensterwechsel, Zoom, Undo/Redo und Import sortieren eine begonnene Arbeit **nicht** neu.

Intern normalisiert der Inhaltsvalidator fehlende Anfangsdaten zu einem gültigen neutralen Zustandskern. Die tatsächliche Bildschirmablage entsteht durch `initialBoardWork()` mit gemessenen Kartenhöhen genau beim Beginnen. Der reine Modellhelfer `initialWork()` benötigt weiterhin weder Browser noch Canvas. Beim Import werden ausschließlich gespeicherte Kartenpositionen verwendet.

## Zweistufige Hilfe

Optionales, fachlich zu prüfendes Inhaltsfeld:

```json
"help": {
  "method": "Welche Information könnte eure Beobachtung erklären? Begründet eure Vermutung.",
  "categories": [
    { "id": "conditions", "label": "Bedingungen", "color": "#2166ac", "cardIds": [1, 4] },
    { "id": "processes", "label": "Vorgänge", "color": "#f5a623", "cardIds": [2] }
  ]
}
```

Die Zahlen sind lediglich ein Schema-Beispiel, kein fachlicher Lösungsvorschlag. `method` ist optional, 1–500 UTF-16-Codeeinheiten, nicht leer und ohne Steuer-/Formatzeichen. Ohne individuellen Text wird ein allgemeiner methodischer Denkimpuls verwendet. Ohne `categories` gibt es keine zweite Stufe und keine Zuordnung nach Nummernblöcken.

`categories` enthält, wenn angegeben, 1–6 Objekte mit genau `id`, `label`, `color` und `cardIds`. Kategorie-IDs beginnen mit einem ASCII-Buchstaben, sind 1–40 Zeichen lang und enthalten danach nur ASCII-Buchstaben, Zahlen, `_` oder `-`. Reservierte Prototypnamen sind ausgeschlossen. Labels umfassen 1–60 UTF-16-Codeeinheiten, sind nicht leer und enthalten keine Steuer-/Formatzeichen. Farben sind genau sechsstellige sRGB-Hexwerte `#RRGGBB`, ohne Alpha, Farbnamen oder URLs. IDs, Labels und Farben müssen je Hilfekonfiguration eindeutig sein. `cardIds` ist eine nichtleere Liste existierender numerischer IDs; jede Karte darf höchstens einmal zugeordnet sein, auch innerhalb derselben Kategorie. Karten dürfen unmarkiert bleiben. Unbekannte Felder und widersprüchliche Zuordnungen werden beim Build zurückgewiesen.

Die Anwendung färbt ausschließlich Nummernmarkierungen. Schwarz oder Weiß als Nummerntext wird aus der relativen sRGB-Helligkeit so gewählt, dass mindestens 4,5:1 Kontrast entsteht. Die Legende nennt Kategorie und konkrete Kartenkennungen als Text; am Kartenbedienelement steht die Kategorie als Screenreader-Beschreibung. Die Anzahl oder Rolle der Gruppen ist nicht im Anwendungskern festgelegt.

Die Hilfe ist zunächst geschlossen und die Orientierung ausgeschaltet. Auf breiten Ansichten ab 1100 CSS-Pixeln gibt es einen zusätzlichen `?`-Button, sonst den Eintrag „Hilfe“ im bestehenden Menü. Das nicht modale Hilfefenster verdeckt höchstens einen Teil der Arbeitsfläche und sperrt die Werkzeugleiste nicht. Stufe 2 muss mit „Weitere Hilfe anzeigen“ ausdrücklich eingeschaltet werden; der dann fest erreichbare Button „Orientierung ausblenden“ führt zurück zum Denkimpuls. Schließen lässt eine bewusst eingeschaltete Nummernorientierung zunächst bestehen; erneutes Öffnen zeigt ihre Legende. Ein sichtbares Häkchen am breiten Hilfe-Button bzw. „✓ Orientierung an“ im Menü kennzeichnet diesen Zustand. Beide Auslöser beschreiben den Ein-/Aus-Zustand zusätzlich über `aria-describedby`. Import und Neubeginn schalten sie aus. Escape schließt die Hilfe und gibt den Fokus an den Auslöser zurück.

Hilfemetadaten gehören zur **Inhaltsversion**, nicht zu `Work`. Neue individuelle Hilfetexte, veränderte Kategorien, Zuordnungen, Bedeutungen oder Hilfefarben erfordern für zukünftige Mysterys eine neue Inhaltsversion: So verwenden Gruppen mit derselben Versionskennung dieselbe fachliche Unterstützung. Eine rein geometrische Änderung der Startablage kann bei unveränderten IDs und fachlichen Daten dieselbe Inhaltsversion behalten; sie wird als eigener Build/Quellstand identifiziert und verändert keine importierten Positionen. Die allgemeine methodische Standardhilfe ist eine Funktion des Anwendungskerns.

Der flüchtige Hilfezustand hat keinen Eintrag in History, `dirty`, PNG oder QR. Export erhält unverändert nur den fachlichen Arbeitsstand. Native Druck-CSS blendet das Hilfefenster und seine Zustandsmarkierung aus und setzt Nummernfarben neutral. Die integrierte mehrseitige Druckfunktion rendert unabhängig davon aus `Work` und den Inhaltsdaten: Sie übernimmt eigene Kartenfarben/Kategorien, aber weder den Hilfezustand noch temporäre Nummernhilfefarben. PNG-/QR-Schema und Inhaltsversionen bleiben durch diese Integration unverändert. Eine tatsächliche Safari-Druckabnahme wird damit nicht behauptet.

## Zustandsmodell

`Work` enthält `schema`, `mystery`, `version`, `cards`, `edges`, `categories` sowie bei Schema 2 `team`. `schema` bezeichnet das universelle Speicherformat; `version` bezeichnet ausschließlich die konkrete Mystery-Inhaltsversion. Für beide Schemas sind identische Mystery-ID, Inhaltsversion und Kartenmenge erforderlich. Eine andere Inhaltsversion wird nicht durch einen Formatwechsel kompatibel. Kartentexte, Gruppenmetadaten und Bilder werden nicht in den Speichercode dupliziert.

Schema 1 enthält keinen Teamnamen und bleibt einschließlich Binärhülle und QR-Kodierung bytekompatibel. Schema 2 verlangt einen nichtleeren Teamnamen mit höchstens 80 UTF-16-Codeeinheiten ohne C0-/C1-Steuerzeichen. Der Modellhelfer entfernt äußeren Leerraum und kann einen leeren Wert weiterhin als teamlose Schema-1-Darstellung abbilden; das erhält die technische Legacy-Kompatibilität. Schema 1 mit Teamfeld und Schema 2 ohne gültiges Teamfeld werden abgelehnt. Ältere Leser erkennen Format 2 als nicht unterstützt, statt die Teamangabe stillschweigend zu verlieren.

Die Schüleroberfläche verlangt unabhängig davon einen gültigen, nichtleeren Namen beim Beginn und bei einer Namensänderung. Eine zentrale Prüfung vor allen Schülerexporten verlangt ihn auch nach einem teamlosen Legacy-Import oder Rückgängig. Der Import selbst bleibt unverändert möglich. Die Namensnachfrage verändert den Arbeitsstand erst nach gültiger Übernahme und setzt dann den angefragten Export mit diesem vollständigen neuen Zustand fort. Abbruch verwirft die Exportabsicht und bietet kein vorheriges Sicherungsbild an. Es gibt keine erfundenen Ersatznamen.

Karten sind `{id, x, y, color}`. Die Reihenfolge im Array bestimmt die Überlagerung. Verbindungen sind `{id, from, to, direction, label}`; Richtung 0 = ohne, 1 = von `from` nach `to`, 2 = umgekehrt. Sechs festgelegte neutrale Farbtöne einschließlich Weiß; sechs frei benennbare Kategorien. Beschriftungen werden als Text dargestellt, nie als HTML.

Vor der Komprimierung wird folgende kompakte UTF-8-JSON-Struktur verwendet:

```text
[1, mysteryId, mysteryVersion,
 [[cardId, x, y, colorIndex], ...],
 [[edgeId, fromId, toId, direction, label], ...],
 [categoryName0, ..., categoryName5]]

[2, mysteryId, mysteryVersion,
 [[cardId, x, y, colorIndex], ...],
 [[edgeId, fromId, toId, direction, label], ...],
 [categoryName0, ..., categoryName5],
 team]
```

Schema 1 hat genau sechs, Schema 2 genau sieben Arrayelemente. Die Schema-Nummer muss mit der Version der Binärhülle übereinstimmen.

Koordinaten bleiben als JSON-Zahlen ohne verlustbehaftete Komprimierung erhalten. Die Bedienung setzt neue Positionen auf 0,01 Arbeitsflächeneinheiten. Der Serializer verändert vorhandene Positionen nicht.

## Binärhülle

| Offset | Länge    | Inhalt                                 |
| ------ | -------- | -------------------------------------- |
| 0      | 4        | `4d 42 53 01` (MBS1) oder `4d 42 53 02` (MBS2), entsprechend `schema` |
| 4      | 4        | unkomprimierte UTF-8-Länge, Big Endian |
| 8      | 32       | SHA-256 der unkomprimierten JSON-Bytes |
| 40     | variabel | Zlib/Deflate-Komprimierung, Stufe 9    |

Limits: fertige PNG einschließlich aller Zustandsdaten maximal 30.000.000 Bytes; komprimierter Zustandsblock maximal 500.000 Bytes; dekomprimierter Zustand maximal 1.000.000 Bytes. Die Dekomprimierung erhält einen vorab begrenzten Ausgabepuffer. Zustandsprüfung: exakte Kartenmenge, eindeutige IDs, endliche Koordinaten ±100.000, Farben 0–5, bis 300 eindeutige Verbindungen ohne Selbstverknüpfung, maximal 500 Zeichen pro Beschriftung, 40 Zeichen pro Kategoriename. Unbekannte Felder werden nicht übernommen.

SHA-256 und PNG-CRC erkennen Beschädigung und nicht konsistent nachgezogene Änderungen. **Keine kryptografische Authentizität:** Wer absichtlich Daten umschreibt und sämtliche Prüfsummen neu berechnet, kann eine formal gültige Sicherung herstellen. Ohne Geheimnis oder externe Vertrauensinstanz kann eine rein lokale Anwendung keine Urheberschaft nachweisen. Semantisch ungültige Daten werden auch mit gültigen Prüfsummen zurückgewiesen.

## Original-PNG

Vor `IEND` wird genau ein privater ancillary/safe-to-copy-Chunk `mySt` eingefügt. Sein Inhalt ist die Binärhülle. Der PNG-Parser prüft Signatur, Chunkgrenzen, Typbezeichnungen, CRC sämtlicher Chunks, IHDR/IDAT/IEND und genau einen Sicherungsblock. Ein vorhandener eigener Block wird beim erneuten Einbetten ersetzt. Kein Rest hinter IEND ist zulässig. Der Import parst den Zustand ohne ein großflächiges Bitmap zu dekodieren.

Die endgültige Größe wird vor der Ausgabe geprüft. Beim Ersetzen eines bestehenden `mySt`-Blocks zählt dessen entfernte Größe nicht erneut mit. Überschreitet das große Exportbild einschließlich Zustandsblock die Grenze, wird der bestehende kleinere Export versucht. Scheitert auch dieser, wird keine Download-/Teilen-Datei angeboten; der geöffnete Zustand bleibt erhalten.

Der Dateiaustausch ist atomar auf Anwendungsebene: Lesen, Integritätsprüfung, Inhalts- und Schemaabgleich, vollständige Modellprüfung; erst dann den geöffneten Zustand ersetzen. Abbrechen invalidiert die laufende Leseoperation. Es gibt kein localStorage, IndexedDB, Service Worker, automatisches Speichern oder Netzwerk-Upload.

## QR

`MB1:` für Schema/MBS1 beziehungsweise `MB2:` für Schema/MBS2, jeweils gefolgt von Base64url der identischen Binärhülle ohne `=`-Padding. Präfix und Binärversion müssen übereinstimmen. Höchstens **500 ASCII-Zeichen einschließlich Präfix**, Fehlerkorrektur M, Ruhezone vier Module. Die Ausgabe verwendet ein ganzzahliges Raster mit mindestens vier Bildpunkten pro Modul; der Code wird danach nicht skaliert. Darüber wird **kein** Code erzeugt. Der Grenze liegt eine bewusst begrenzte Symboldichte zugrunde, keine Zusage für jede Kamera oder Druckgröße. Der gesamte Zustand einschließlich vorhandener Teamangabe wird kodiert; keine URL, kein Verweis und keine gekürzte Sicherung.

PNG-Export reserviert einen eigenen unteren Bereich für Hinweise und QR. Auf kleinen Ausgaben müssen Codegröße, Druckqualität und Entfernung praktisch geprüft werden. Wenn der Code zu dicht oder nicht lesbar ist, bleibt die Originaldatei maßgeblich.

Oberhalb der Karten stehen Mystery-Titel links und Teamangabe rechts in einer gemeinsamen Kopfzeile. Beide erhalten getrennte Bereiche und umbrechen bei Bedarf. Die sichtbaren Kartenkennungen verwenden dieselben Inhaltsmetadaten wie Board, Lesefenster und Verbindungsreferenzen.

## Export und Speicherbudget

- Groß: 4961 × 3508 Pixel, A3-Seitenverhältnis (etwa 300 dpi bei passender Druckskalierung).
- Klein: 2480 × 1754 Pixel, etwa 150 dpi.
- PNG enthält keine verbindliche Drucker-DPI-Einstellung; im Druckdialog A3 quer und passende Skalierung wählen.
- Das große RGBA-Canvas allein benötigt 69.612.752 Bytes (rund 66,4 MiB); Kodierung, PNG und Browserkopien benötigen zusätzlich Speicher. Der kleinere Puffer benötigt 17.399.680 Bytes (rund 16,6 MiB).
- Bilder werden anhand ihrer intrinsischen Breite/Höhe proportional und zentriert in den vorgesehenen Bereich eingepasst. SVG-Board und Canvas-Export verwenden dieselbe Geometrie; auch SVG-Bilder ohne `viewBox` werden nicht gestreckt.
- Die Bitmapgröße ist fest und hängt niemals von Arbeitsflächenabständen oder Bildschirmzoom ab. Exportlayout wird aus Inhalt, Zustand und Zielgröße neu berechnet. Alle Kartentexte und Bilder werden gezeichnet.
- Bei abfangbarem Fehler des großen Exports wird der kleine versucht; dieser ist zusätzlich direkt über Menü → „Kleineres Sicherungsbild“ wählbar, ohne zuerst ein großes Canvas anzulegen. Ein vom Betriebssystem beendeter Browserprozess ist nicht abfangbar. Deshalb muss die kleinere Größe vorab auf speicherarmen iPads getestet werden.
- Sehr weit auseinandergezogene oder stark überlagerte Karten und dichte Verbindungsbeschriftungen bleiben auch im Export entsprechend klein bzw. überlagert. Keine automatische inhaltliche Umsortierung. Für lesbaren Druck großer Boards werden später Seitenaufteilung und ein eigener Druckmaßstab gebraucht.

Gemeinsame Geometrie und ein separater Renderer bilden die Grundlage für spätere Seitenkacheln. Das erste Format bleibt PNG. Es sind keine PDF-/SCORM-Ausgaben vorgetäuscht.

## Bedienmodell

Eine Pointer-Geste beginnt als Kandidat für Antippen, Kartenziehen oder Flächenziehen. Erst ab acht Bildschirmpixeln wird gezogen. Zwei beteiligte Finger wechseln in Pinch/Pan und verwerfen die unbestätigte Kartenverschiebung. Bis alle Finger losgelassen sind, entsteht daraus kein neuer Klick oder Einzel-Finger-Zug. Pointer-Cancel verwirft die Vorschau. Im Verbindungsmodus erzeugt nur ein bewusstes Antippen eine Zielauswahl; Ziehen verbindet nicht.

Die Kartenansicht ist SVG; das Lesefenster ist normales HTML mit eigener Schriftgröße. Dadurch bleiben Lesegröße und Dialogbedienung unabhängig vom Boardzoom. Zahlen werden beim Herauszoomen begrenzt gegenskaliert. Im Export wird eine feste, vollständig innerhalb der Exportgrenzen liegende Nummernmarkierung gezeichnet.

React Flow wurde für diesen abgegrenzten Prototyp nicht eingebunden: Es wären zusätzliche Überschreibungen für die Zwei-Karten-Auswahl und das Rücksetzen schon begonnener Kartengesten nötig gewesen. Die kleine eigene Zustandsmaschine hat keine Anschlusspunkte und lässt sich gezielt per Pointer-/Touch-Test prüfen. Die tatsächliche Safari-Gestenerkennung bleibt eine eigene Abnahme.

## Historie und Hinweis beim Verlassen

Rückgängig und Wiederholen bewegen vollständige `Work`-Momentaufnahmen zwischen Vergangenheit und Zukunft. Gemeinsam bleiben höchstens 40 Bearbeitungsschritte erhalten. Eine tatsächliche neue Bearbeitung verwirft die Zukunft; eine unveränderte Übernahme tut das nicht. Beide Historien werden beim Laden oder Verlassen eines Arbeitsstands gelöscht und gehören nicht zum PNG-Speicherformat.

`dirty` bedeutet: Der geöffnete Zustand unterscheidet sich vom zuletzt geladenen bzw. gestarteten Ausgangsstand. Vollständiges Rückgängig bis zu diesem Stand setzt den Hinweis zurück; Wiederholen aktiviert ihn wieder. Die Erzeugung einer PNG, ein Download-Klick und selbst ein aufgelöstes `navigator.share()`-Promise belegen keine dauerhafte Dateiablage und setzen den Hinweis daher nicht zurück. Es gibt keinen automatisch bestätigten Sicherungsstatus.

Die native `beforeunload`-Warnung bleibt eine Browserhilfe. iPadOS kann eine Seite im Hintergrund beenden, ohne dieses Ereignis auszulösen. Deshalb die Originaldatei vor dem Schließen tatsächlich in „Dateien“ prüfen; es wird weiterhin nichts automatisch gespeichert.
