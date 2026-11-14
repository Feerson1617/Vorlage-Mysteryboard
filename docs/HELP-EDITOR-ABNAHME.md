# Grafischer Hilfe-Editor – technische Abnahme

Prüftag: 14.11.2026. Ausgangscommit: `5a6899a7a67465c932c340c60ccde56e989586b4`. Separater Branch: `feat/mysteryboard-author-help-editor`. Der vollständige Commit der Lieferung steht im Projekt-ZIP in `PROJECT-VERSION.json` sowie im Abnahmepaket. Keine Übernahme in `main`, keine Veränderung der eingefrorenen Boden-RC2, kein Pages-Deployment.

## Ergebnis und Funktionsumfang

Der vorhandene Lehrkräfteeditor hat einen eigenen Arbeitsschritt **Hilfen für Lernende**, erreichbar über **Hilfetext festlegen**. Er bietet fünf Denkimpulse, frei bearbeitbaren Hilfetext, die beiden Gruppenvorlagen „Ursachen und Wirkungen“ und „Nutzungskonflikte“, eigene Gruppen, eine kleine Palette und eine Liste aller Karten mit Nummer, Titel, Auswahlfeld und farbiger Nummernvorschau. Keine Karte wird anhand ihrer Nummer, Position oder Pflicht-/Vertiefungsgruppe automatisch zugeordnet. Unmarkierte Karten und unterschiedlich große Gruppen sind ausdrücklich erlaubt.

Die Schüler-Vorschau verwendet die tatsächliche gemeinsame `App`, `LearningHelp` und den unveränderten `Board`-Kern. Sie zeigt zuerst den Denkimpuls. Die Lehrkraft kann die zweite Stufe aktivieren, Legende/Nummern vergleichen und Karten/Verbindungen ausprobieren. Der gesamte Vorschau-Arbeitsstand liegt ausschließlich in einer eigenen Komponenteninstanz und wird beim Schließen verworfen. Bewegungen und Pfeile aus der Vorschau gelangen nicht in die veröffentlichte Aufgabe.

**Technisch prüfbare Lieferung; reale Schulfreigabe offen.** Die Ausführung auf tatsächlichen verwalteten iPads, Safari/itslearning und ggf. Canva wurde hier nicht durchgeführt. Die dokumentierten Chromium-Tests und der simulierte SCORM-Player ersetzen diese Prüfung nicht.

## Entscheidungen und Schutz vor Datenverlust

- Die bestehende Struktur `help.method` / `help.categories` und Dokumentformat 3 bleiben unverändert. Beide JSON-Schemata, der Importvalidator, PNG-/QR-Codec, History und Pointerlogik sind gegenüber der Basis unverändert.
- Unfertige Gruppen werden ausschließlich im lokalen Hilfeformular bearbeitet. Fehlende Namen, doppelte Namen/Farben, leere Gruppen, falsche Referenzen oder mehr als sechs Gruppen können nicht übernommen werden. Fehlermeldungen stehen am Feld; eine Zusammenfassung wird angekündigt, die erste fehlerhafte Stelle erhält Fokus. Die Eingaben bleiben erhalten.
- Aktive Gruppen brauchen je mindestens eine Karte. Eine nicht benötigte Gruppe kann entfernt werden. Beim Entfernen einer bereits belegten Gruppe fragt eine kurze Inline-Abfrage nach; erst danach verlieren ihre Karten diese Markierung.
- Beim Vorlagenwechsel bleiben die lokalen Fassungen der eigenen und vorbereiteten Gruppen während der Bearbeitung abrufbar. Bei vorhandenen Zuordnungen oder veränderten Gruppen erklärt eine Inline-Abfrage den Wechsel. Die endgültige Übernahme speichert genau die gewählte Gruppierung. Die lokale Wechselhistorie ist kein zusätzliches Dateiformat.
- Die zweite Stufe kann ausgeschaltet werden. Eine sichtbare Erklärung beschreibt, dass die Markierungen erst beim Übernehmen aus dieser neuen Fassung entfallen; bis dahin sind sie wieder einschaltbar. Vorherige Dateien behalten ihren vollständigen Inhalt.
- Während dieses Arbeitsschritts sind Entwurf-Download und Import gesperrt. Dadurch wird kein scheinbar gesicherter Stand ohne die noch offenen Hilfeänderungen angeboten. „Abbrechen“ verwirft veränderte Eingaben erst nach Bestätigung. Die vorhandene Verlassenswarnung berücksichtigt auch den geöffneten Hilfeeditor; mobile Browser garantieren diese Warnung nicht.
- Inhaltsänderungen werden über `reviseDraft` übernommen und erhöhen wie bisher die Patch-Version. Bloßes Öffnen und unverändertes Übernehmen erhöht die Fassung nicht. Kartenlöschungen passen IDs und Hilfereferenzen gemeinsam an; neue Karten bleiben unmarkiert.
- Die Palette enthält die vorgegebenen Farben Blau `#2166ac`, Orange `#f5a623`, Grün `#287c43` und fünf weitere Farben. Die tatsächliche Nummerntextfarbe wird mit derselben Funktion wie im Board gewählt. Alle acht Kombinationen erreichen rechnerisch mindestens 4,5:1 Kontrast. Namen und Kartennummern ergänzen die Farbe. Bereits gültig importierte Farben außerhalb der Palette bleiben als Auswahl erhalten. Auch individuelle Schreibweisen, Farb-Großschreibung und gültige Leerzeichen in importierten Texten werden beim unveränderten Übernehmen erhalten; die Eingabeprüfung verwendet dieselben Eindeutigkeitsregeln wie das vorhandene Format.

## Bedienprüfung und Vereinfachung

Die neuen Beschriftungen sind kurze Funktionsnamen. „Karte hinzufügen“ ersetzt „+ Karte hinzufügen“. **Schülerversion erstellen** führt direkt zum bestehenden Dateidialog; die bisherige zusätzliche Bestätigungsstufe entfällt. Der PNG-Aufgabenexport bleibt über **Aufgabe als PNG** verfügbar. Die Datei wird weiterhin bewusst heruntergeladen; eine erzeugte Datei bestätigt keine dauerhafte Ablage. Die bisherigen Tests wurden an diese tatsächlichen Beschriftungen und den kürzeren Ablauf angepasst, ohne Zustandsvergleiche oder Funktionsassertions zu entfernen.

Die automatisierte Erstbedienung erhielt nach dem Öffnen eines vorhandenen Mysterys nur die sichtbaren UI-Funktionsnamen. Bei 320 × 700 Pixeln führte sie diese **14 Bedienhandlungen** aus:

1. Hilfetext festlegen.
2. Einen Denkimpuls wählen.
3. Den Text individuell ändern.
4. Kartennummern als Hilfe markieren einschalten.
5. Ursachen und Wirkungen wählen.
6. Karte 1 einer Gruppe zuordnen.
7. Karte 2 einer anderen Gruppe zuordnen.
8. Karte 3 der dritten Gruppe zuordnen.
9. Hilfe aus Schülersicht ansehen.
10. Weitere Hilfe anzeigen.
11. Zurück zu den Hilfen.
12. Hilfe übernehmen.
13. Schülerversion erstellen.
14. Datei herunterladen.

Der Prüfaufbau (Datei öffnen und Lehrkräftemodus aktivieren) ist nicht in diesen 14 Handlungen enthalten. Ohne Vorschau wären es elf. Zusätzliche Karten, andere Namen/Farben und Fehlerkorrekturen erfordern entsprechend weitere Eingaben. Die tatsächlichen Aktionsnamen und Maße aller sichtbaren Buttons/Auswahlfelder stehen im maschinenlesbaren Bedienprotokoll. Es gab keinen horizontalen Seitenüberlauf; alle geprüften interaktiven Buttons und Auswahlfelder waren mindestens 48 × 48 Pixel groß. Checkboxen haben ein zusammenhängendes beschriftetes Touchziel. Dies ist ein **automatisiert modellierter Erstbedienungsweg**, keine empirische Nutzerstudie mit unbekannten Lehrkräften.

Erkannte vermeidbare Schritte wurden entfernt: der technische Methodentext im allgemeinen Eingabebereich ist durch den klar auffindbaren Hilfe-Arbeitsschritt ersetzt; nach dem Schülerversion-Erstellen ist kein weiterer Export-Auswahlschritt nötig. Ein zusätzlicher Dialog wird nur für die echte Schüler-Vorschau oder den Dateidownload verwendet. Vorlagenwechsel und Gruppenlöschung werden bei Bedarf direkt im Formular bestätigt.

## Tatsächlich ausgeführte Browsernachweise

Die neu gebaute Universal-HTML und die aus der tatsächlichen Universal-SCORM-ZIP extrahierten Dateien wurden verwendet. Nach dem Laden wurden die Browserkontexte offline geschaltet.

- Grafisch zwölf Karten mit neun Pflicht- und drei Vertiefungskarten und drei Bildern erstellt; Denkimpuls gewählt/geändert; vier Karten bewusst ungleich auf drei Gruppen verteilt, andere unmarkiert; Namen/Farbe verändert.
- Die tatsächliche Schüler-Vorschau zeigte korrekte Nummernfarben und die Legende „Karten 1, 3“. Eine Verbindung wurde ausschließlich in der Vorschau erstellt. Die anschließend exportierte Aufgabe enthielt weiterhin keine Pfeile.
- Entwurf heruntergeladen, Browserkontext geschlossen, in einem frischen Kontext geöffnet. Hilfetext, Namen, Farben und tatsächliche Kartenreferenzen verglichen. Schülerversion heruntergeladen.
- Das zweite Gruppensystem wurde ebenfalls von Hand zugeordnet: Gruppen mit zwei, einer und einer Karte. Ein neutrales Aufgabenbeispiel für jede Vorlage wird mitgeliefert.
- In der aus der ZIP entnommenen SCORM-Anwendung: eigenes Team, tatsächliche Pinch- und Kartenziehfolgen, zwei beschriftete Beziehungen, eigene Farbe/Kategorie; Stufe 1/2 aufgerufen und wieder ausgeschaltet. Arbeitsstände und Undo-Erreichbarkeit blieben beim Hilfewechsel unverändert. Die Original-PNG war mit aktiver und deaktivierter Nummernorientierung **byteidentisch**.
- Original-PNG in neuer SCORM-Sitzung vollständig wiederhergestellt, weiter verbunden und erneut bearbeitbar.
- Revision im SCORM-Lehrkräftemodus: neue Karte, Löschung einer markierten Karte, Gruppenname verändert, neue Fassung exportiert. Neue Legende überprüft; danach die alte Schüler-PNG bewusst geladen und vollständig mit ihrem ursprünglichen Inhalt und Arbeitsstand verglichen.
- Importierte individuelle Gruppen, Vorlagenwechsel/Beibehalten, Rückkehr zu eigenen Gruppen, leere Namen/Gruppen, doppelte Farben, Abbruch mit Beibehalten/Verwerfen, Entfernen belegter Gruppen und das Ausschalten der zweiten Stufe geprüft. Sechs eigene Gruppen angelegt und exportiert; die siebte Gruppe war gesperrt.
- Neue mysteriespezifische HTML- und SCORM-Ausgaben öffneten denselben Editor. Bestehende Hilfereferenzen blieben nach Textbearbeitung und Export erhalten.
- Tastaturöffnung und Fokus, sichtbare deutsche Beschriftungen, Hoch-/Querformat, schmale Einbettung und tatsächliche Screenshots geprüft.

Ein früher Test erzeugte die Drag-Geste als einzelnen Sprung direkt nach einer Ansichtsumstellung. Für eine belastbare Touchfolge wurden stattdessen vier Bewegungsereignisse und eine abgeschlossene Layoutphase verwendet. Die Pointerlogik der Anwendung wurde dafür nicht geändert. Ein Typfehler der neuen Testhilfe für einen verschachtelten Locator wurde im Testtyp korrigiert. Keine bestehende Funktionsprüfung wurde dafür abgeschwächt.

## Reproduzierbare Befehle und Protokolle

```sh
npm ci
npx tsc --noEmit
npx vitest run tests/help-authoring.test.ts
CLASSROOM_SCORM=1 npm run check
npm run test:rc2
npm run package:universal
```

`npm run check` führt sämtliche Datentests, Produktionsbuilds, Testbuilds einschließlich des spezifischen HTML-/SCORM-Beispiels und alle Chromium-Browsertests aus. Mit `CLASSROOM_SCORM=1` laufen die vollständigen Unterrichtsabläufe in der tatsächlichen ZIP-Hülle. Zusätzliche Ausgabevariablen `AUTHORING_EXAMPLES_DIR`, `PRINT_EXAMPLES_DIR` und `INTEGRATION_EXAMPLES_DIR` sammeln Nachweise, verändern aber keine Assertions. **Der abschließende Stand bestand mit 100/100 Datentests und 157/157 Chromium-Browsertests, ohne Fehler, übersprungene Tests oder instabile Wiederholungen. Die separate eingefrorene RC2-Prüfung bestand mit 4/4 Tests.** Details stehen in `RESULTS.json` und `full-check.txt` unter `docs/test-evidence/help-editor/`.

Die neuen Datentests prüfen Vorlagen ohne automatische Zuordnungen, Farbkontraste, lokale Fehler ohne Mutation, Referenz-/Doppelzuordnungsfehler, deaktivierte Hilfe und einen revisionsgeschützten Dokumentrundlauf nach Kartenlöschung. Die bisherigen Regressionen decken zusätzlich R1/R1b, 220 Verbindungen, MBS1/MBS2/MBX3, PNG-Grenzen, Offline-Verhalten, Teamnamen, Undo/Redo, Druck, Bilder und vollständige Wiederherstellung ab.

## Dateien und Lieferung

Neue Implementierung: `src/components/HelpEditor.tsx`, `src/core/help-authoring.ts`. Integration: `src/components/AuthorEditor.tsx`, ein optionaler Anfangszustand für die Hilfe in `src/App.tsx`, gezielte CSS-Regeln. Die allgemeine Schülerhilfe, der Board-Touchkern, Datenmodell und Speicherformate bleiben gleich. Die zusätzlichen Tests liegen unter `tests/help-authoring.test.ts` und `tests/browser/help-editor.spec.ts`.

Die aktualisierte Projektvorlage enthält alle Quellen, Schemata, Anleitungen, Beispiele und Tests. Maschinenlesbare Metadaten ordnen sie dem neuen Branch und Commit zu. Regenerierbare Test-HTMLs und installierte Abhängigkeiten sind nicht Teil des Quellpakets. Historische Dokumenttexte erhalten für die Weitergabe neutrale Pfadpräfixe; Quelldateien und Produktionsartefakte bleiben unverändert.

Das neue Abnahme-ZIP enthält die tatsächliche Universal-HTML/SCORM, Ursachen-/Konflikt-Beispiele, Entwurf, Schüler-PNG und Revision, aktuelle Prüfprotokolle, Screenshots, Anleitungen und vollständige SHA-256-Prüfsummen. Alle Archive werden geöffnet und auf CRC/Eintragsintegrität geprüft. Die HTML muss weiterhin strikt unter 10.000.000 Bytes liegen. Ein frischer Projekt-Neubau und der Remote-Stand werden im abschließenden Liefernachweis festgehalten.

## Weiterhin offene Grenzen

Es wurde kein echter Safari-/Schul-iPad-/itslearning-/Canva-Test ausgeführt. WebKit 26.5/27.2 ist hier nicht erfolgreich startfähig; die fehlenden Systembibliotheken wurden bereits in den vorherigen Nachweisen dokumentiert. Die verwaltete Cloud blockiert direkte `file://`-Navigation und den sichtbaren Systemdruckdialog. Deshalb wurden die unveränderten Einzeldateien lokal per HTTP geladen und danach offline getestet; PDF-Bytes stammen vom nativen Chromium-PDF-Backend, nicht von einer realen Safari-Druckabnahme. Keine dieser Einschränkungen wurde umgangen.

Der Lehrkräftemodus ist weiterhin kein geschützter Zugang. Keine automatische Speicherung, keine Bewertung und keine Übermittlung von Teamnamen oder Arbeitsständen an das LMS. Der API-Test protokolliert ausschließlich Initialisieren/Beenden. Reale Dateiablage und mobile Verlassenswarnungen bleiben vom Browser abhängig. Vor dem Unterricht sind die tatsächliche Kursbereitstellung, Medienlesbarkeit, Touch, Download und Wiederherstellung auf dem verwalteten Schul-iPad zu prüfen.
