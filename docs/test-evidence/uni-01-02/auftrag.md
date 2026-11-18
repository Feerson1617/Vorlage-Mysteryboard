# MysteryBoard – gezielte Korrektur nach unabhängiger lokaler Funktionsprüfung

## Ausgangspunkt und Umfang

Arbeite mit dem vollständigen `source/`-Stand aus `MysteryBoard-Universelle-Vorlage-Boden-2.0.0.zip` oder seinem nachweislich identischen Nachfolger. Nicht zum alten Basiscommit 545ece1 oder zum reinen R1b-Paket zurückkehren. Die universelle Vorlage, die drei Produktionsvarianten, der generische Fünf-Karten-Test und der 220-Verbindungen-Test sind zu erhalten.

Die unabhängige lokale Prüfung hat zahlreiche echte Chromium-Bedienketten inklusive exakter PNG-Rundläufe bestätigt. Behebe ausschließlich die folgenden zwei Anforderungen. Keine fachlichen Kartenänderungen, kein neuer Editor, kein Backend, keine automatische Speicherung, keine automatische Bewertung. R1b-Ereignisbehandlung nicht ohne nachgewiesene Ursache verändern.

## UNI-01 – Verbindliche Teamzuordnung

### Reproduzieren

Boden-HTML → Namensfeld leer → Beginnen → Sichern → Download. Es entsteht eine formal gültige, aber nicht zuordenbare PNG. Dasselbe nach „Teamname ändern“ mit leerer oder nur aus Leerzeichen bestehender Eingabe.

### Anforderungen

- Beim Beginn einer neuen Schülerarbeit eine gültige Teambezeichnung oder Vornamen verlangen. Eine neutrale Gruppenbezeichnung reicht; keine Nachnamen verlangen.
- Eine verständliche Inline-Meldung/Fokussierung am bestehenden Eingabefeld verwenden. Keine neue Benutzerverwaltung.
- Eine zentrale Prüfung vor sämtlichen Schülerexporten: normaler Export, kleiner Export aus dem Menü, erneuter Export nach Import und nach Undo/Redo. Keine namenlose PNG als fertiges Schülerprodukt anbieten.
- Gültige teamlose Altsicherungen unverändert importieren können. Nicht rückwirkend das Legacy-Datenformat ungültig machen. Nach dem Import darf die Arbeit weitergehen; vor einem neuen Export muss eine Teamangabe nachgetragen werden.
- Abbruch der Namensabfrage darf weder den geöffneten Arbeitsstand löschen noch einen veralteten Export bereitstellen.
- Namen ändern weiterhin ermöglichen. Leerraum, Umlautnamen und Maximallänge prüfen. Bei ungültiger Änderung vorhandene gültige Teamangabe und Arbeitsstand erhalten.
- Leeres Team durch Undo oder Legacy-Import darf die zentrale Exportprüfung nicht umgehen.
- Keine stillen erfundenen Gruppennamen einsetzen. Die Namen bleiben ausschließlich im laufenden Zustand und in bewusst erzeugten Sicherungen.

### Tests

Vorher reproduzierende Tests für leeren Start und namenlosen Export ergänzen. Anschließend prüfen: leer/Whitespace, normaler Gruppenname, Änderung, Löschung, Undo, kompatibler teamloser Import, beide Exportgrößen, Abbruch und erfolgreiche Namensnachtragung. Die erzeugte PNG muss sichtbar den Namen tragen und nach einem frischen Import denselben vollständigen Zustand herstellen.

## UNI-02 – Teamangabe rechts oben, ohne zusätzliche dauerhafte Namenszeile

### Reproduzieren

1024×768 und 768×1024 CSS-px, Team „Emma, Leon und Mia“. Aktuell steht die Angabe links unter „MysteryBoard“ in 124 px Breite und wird abgeschnitten. Unter 600 px wird eine eigene Namenszeile angelegt.

### Anforderungen

- In der Arbeitsansicht die Teambezeichnung rechts im vorhandenen oberen Bereich platzieren, kompakt und gut lesbar.
- Kurze übliche Angaben wie „Emma, Leon und Mia“ oder „Team Marschboden“ sollen auf beiden iPad-Referenzgrößen vollständig sichtbar sein. Keine zusätzliche dauerhafte Namenszeile und kein fest geöffnetes Eingabefeld.
- Ein Screenshot muss die Gruppe sinnvoll identifizierbar machen. Ein nur per Maus-Hover erreichbarer vollständiger Name genügt auf iPads nicht als alleinige Lösung.
- Für sehr schmale Ansichten einen sinnvollen kompakten Aufbau wählen, ohne Funktionen unzugänglich zu machen oder horizontales Scrollen auszulösen. Vorhandenes Menü nutzen statt neue Bedienflächen zu erfinden. Typische iPad-Formate haben Priorität.
- Der PNG-Export ist bereits korrekt: voller Titel links, Name rechts in derselben Kopfzone, lange Angaben umbrechend. Dieses Verhalten erhalten. Lange Teamangaben niemals still in den Sicherungsdaten oder im Export kürzen.
- Weiterhin ausreichende Touch-Zielgrößen und eine möglichst große Arbeitsfläche.

### Tests

Sichtprüfungen und Screenshots bei 768×1024 und 1024×768 sowie responsive Grenzwerte 320,480,600,601,640. Übliche kurze Namen, mehrere Vornamen und 80-Zeichen-Grenzfall getrennt prüfen. Nicht bloß vorhandenen Text im DOM testen, sondern tatsächliche sichtbare Position, Abschneiden, Werkzeugerreichbarkeit und Kopfhöhe.

## Erhaltene Funktionen und Abgabe

Sämtliche existierenden Tests erneut ausführen und gezielt erweitern. Wenn eine bisherige Prüfung ausdrücklich namenlose neue Schülerexporte als Erfolg erwartet, diese Anforderungsprüfung begründet aktualisieren; Tests für teamlose Legacy-Importe bleiben bestehen. Keine Assertions oder Tests pauschal entfernen.

Drei frisch gebaute Produktions-HTMLs liefern; generisches Fünf-Karten-Beispiel und Belastungstest ebenfalls prüfen. R1b-Touch-Kette, V-Nummern, Team-PNG-Rundlauf und bestehende ID-/PNG-Grenzen dürfen nicht regressieren. Die Lehrkraft-/Schülerkarteninhalte bleiben unverändert.

Abgabe: minimaler Diff, beide reproduzierten Vorher-Befunde und Nachher-Ergebnisse, sichtbare Screenshots, aktuelle HTML-Dateien mit SHA-256/Bytegrößen, vollständige Testprotokolle und dokumentierte Grenzen. Noch keine behauptete Safari-/iPad-/Canva-Freigabe ohne tatsächliche Prüfung. Kein eigenständiger Merge oder Veröffentlichung.

## Hinweis zur lokalen Prüfung

Ein unmittelbar nach einem Touch-Pan ignorierter schneller Toolbar-Tipp trat im Prüf-Chromium 144 auch auf einer Minimal-Kontrollseite OHNE MysteryBoard auf. Daraus keine weitere Ereignis-Neuentwicklung ableiten. Auf echten Zielgeräten im nächsten Praxistest mitprüfen. Ebenso benötigen dicht überlagerte, stark verkleinerte Labels gegebenenfalls Zoom; ein Subpixel-Grenztreffer ist nicht automatisch der alte M1-Fehler.
