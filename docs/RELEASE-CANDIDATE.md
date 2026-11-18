# MysteryBoard Universal – Release Candidate und Weitergabe

Stand: 14.11.2026. Release-Kennung: **Universal-2026-11-14-RC**. Repository: Feerson1617/Vorlage-Mysteryboard. Ausgangscommit: `ae0f4cba54522752474bc474ac43a6b878b38751`. Neuer Branch: `feat/mysteryboard-universal-release-candidate`. Die genaue Liefer-Commit-ID steht in `QUELLSTAND.json` beziehungsweise `PROJECT-VERSION.json` und im äußeren Liefermanifest. Es wird kein Release-Tag angelegt.

## Ergebnis und Grenzen

Die Lieferung ist ein technisch überprüfter Release Candidate für die abschließende Praxisprüfung. Sie ist keine automatische Schulfreigabe. Eine tatsächliche Übertragung durch eine fremde KI wurde hier nicht ausgeführt und bleibt ausdrücklich offen. Die KI-Papierprobe enthält dafür das vollständige Original, den kopierbaren Auftrag, eine kontrollierte digitale Referenz und einen konkreten Prüfablauf.

Die Abnahme verwendet reale Chromium-Browseraktionen an den tatsächlichen HTML-/SCORM-Dateien und erneut an der verpackten Lieferung. Die separat ausführbaren Prüfskripte importieren keinen Anwendungscode. Sie wurden dennoch von derselben erstellenden KI geschrieben: keine unabhängige menschliche Zertifizierung oder vorgetäuschte Fremd-KI-Abnahme.

## 1. Unveränderten Ausgangsstand zuerst erneut abgenommen

Vor jeder Anwendungsanpassung wurden aus `ae0f4cb` HTML und SCORM neu erzeugt und die vollständigen vorhandenen Prüfungen erneut ausgeführt: **107 Datentests, 169 Chromium-Browsertests und vier RC2-Prüfungen bestanden**. Danach wurde ein neues eigenständig ausführbares Ausgangs-Abnahmepaket gebaut, auf ZIP-CRC/Prüfsummen geprüft, entpackt und dessen mitgelieferter Browserprüfer nach eigenem `npm ci` ausgeführt: bestanden. Das entpackte Paket verwendete die tatsächlich enthaltene HTML und SCORM, nicht die Entwicklungsseite. Beide Inhalte waren bytegleich zu den neu gebauten Ausgangsartefakten.

Protokolle, Paketprüfsumme und Ergebnis stehen unter `pruefnachweise/baseline/`. Erst danach wurde der neue Branch erstellt. Die vorherige Lieferung und ihr Branch bleiben erhalten.

## 2. Kleine, belegte Bedienungsanpassungen

Der reale Browserbefund `baseline/UX-BEFUND.json` dokumentiert den bisherigen Exportnamen mit englischer interner Rolle und UUID sowie den fehlenden ausdrücklichen Hinweis auf den KI-Dateiweg. Entwurf/Schülerversion und bewusster Download waren funktional bereits korrekt. Es wurde kein zusätzlicher Arbeitsweg und keine neue Werkzeugleiste entwickelt.

- `src/UniversalApp.tsx`: Eine kurze Einstiegsorientierung erklärt eigene Karten, vorhandene Aufgaben und KI-Dateien. Alle Wege verwenden weiterhin denselben Import, denselben Editor und das vorhandene Format. „LMS“ wird dort verständlich als Lernplattform bezeichnet. Exportnamen nennen nun **Entwurf**, **Aufgabe** oder **Arbeitsstand**, den sichtbaren Mystery-Titel und die Inhaltsversion. Technische IDs und Integritätsprüfung bleiben im Dateiinhalt unverändert.
- `src/components/HelpEditor.tsx`: Die Zuordnungsanweisung verwendet wie die übrigen Hilfe-Anweisungen die Mehrzahl „ihr“.

Mehr Anwendungsänderungen wurden nicht vorgenommen. Board-/Touch-Ereignisse, Pinch, Kartenziehen, Arbeitsflächenverschieben, Beziehungen, Undo/Redo, Print/PDF, PNG-/QR-Verfahren, Datenmodell und Speicherformat sind unverändert. Die bestehende Schüler-Vorschau behält ihre bereits korrigierte Betriebsart ohne Datei-/Team-/Druckaktionen. Keine automatische Speicherung, keine Bewertung und keine Musterlösung wurden ergänzt.

## 3. Dokumentation für die unmittelbare Nutzung

`START-HIER.md` umfasst 599 Wörter; die ergänzende druckbare Fassung hat **zwei A4-Seiten**. Sie erklärt ohne Programmierung: Software öffnen, selbst Karten erstellen, vorhandene/KI-Dateien bearbeiten, Entwurf versus Schülerversion, bewusstes Herunterladen, einmaliges universelles SCORM-Paket in der Kursressource und portable Original-PNGs. Die Aufgaben-Datei allein wird ausdrücklich vom Programm unterschieden. Bereits verteilte Dateien ändern sich nicht automatisch.

`KI-PROMPT-ZUM-KOPIEREN.md` enthält einen vollständigen Übertragungsauftrag mit Originalvergleich, Rückfragen statt Erfinden, Trennung von Original/Fachkorrektur, Nummern-/Pflicht-/V-Metadaten, rechtmäßig eingebetteten Medien, Quellen, editierbaren Tabellen, Validator, Aufgabe und erneut bearbeitbarem Entwurf. Keine neue integrierte KI, OCR oder API-Anbindung.

Die umfangreichen KI-/Lehrkräfteanleitungen und Schemata bleiben erhalten. README führt direkt zu den kurzen Einstiegen und den ausführlichen Unterlagen.

## 4. Kontrollierte Papierprobe und tatsächliche Bearbeitung

`papierprobe/Papieroriginal.pdf` ist eine sechsseitige A4-Vorlage: Deckblatt mit gehaltvoller Leitfrage und zehn Informationskarten, neun Pflichtkarten und V10. Thema: ein fiktiver Parkteich mit Fischbeobachtungen, Wetter, Sauerstoff-/Temperaturdaten, einer strukturierten Tabelle, einem Diagramm und Quellen. Alle Ortsbeobachtungen und Messwerte sind ausdrücklich synthetisch; Datenlücken werden benannt. Es gibt keine vorgezeichnete Lösungskette.

Die eigene Grafik, ihre SVG-/PNG-Originale, Originaltexte in `original-karten.json`, Referenz-Inhalt und erwartete Struktur liegen vollständig vor. Ein zusätzlicher Datentest vergleicht jeden Kartentext, jede Quelle, alle Tabellenzellen, Pflicht-/V-Zuordnung und die tatsächlichen Bildbytes zwischen Originalfeldern und digitaler Referenz. Die Erzeugung verwendet das vorhandene gemeinsame Format und dessen Validatoren. Der optionale Generator `scripts/create-paper-fixture.mjs` dokumentiert die Herkunft; er ist kein OCR-Test.

Die fachliche Quelle USGS Water Science School, „Dissolved Oxygen and Water“, wurde tatsächlich gelesen; die URL und der Abruf am 14.11.2026 sind im Original angegeben. Verwendet werden eigene deutsche Zusammenfassungen, keine fremden Bilder. Eigene Texte/Tabellen/Diagramme stehen für diese Testvorlage unter CC0 1.0. Das Beispiel ist keine bereits fachlich abgenommene Unterrichtseinheit.

Bei der Sichtprüfung wurde eine Überlagerung von Einheit und Y-Achsenbeschriftung im neu erstellten Testdiagramm entdeckt. Diese Testgrafik wurde korrigiert; Original, digitale Referenz und Prüfsummen wurden gemeinsam neu erzeugt, der Originalvergleich erneut ausgeführt und der gesamte Blackbox-Lauf mit der korrigierten Grafik wiederholt. Keine Änderung des Anwendungs-Exports war erforderlich.

Die echten Browserläufe öffnen alle zehn Karten einschließlich Quellen, Tabelle und Diagramm. Die vorhandene Bildvergrößerung wird verwendet; bei Vergrößerung 4 ist die projizierte Diagrammbeschriftung in allen geprüften Ansichten mindestens 14 CSS-Pixel groß. Danach: Karte hinzufügen/löschen, Text ändern, Diagramm ersetzen, Hilfen mit Einzel-/Mehrfachzuordnung bearbeiten, Entwurf herunterladen, in neuer Sitzung öffnen und neue Aufgabe erzeugen. Diese Aufgabe wird in der tatsächlichen universellen SCORM-Anwendung mit Team/Hilfe/Touch/Pinch/Verbindung bearbeitet, als echte Original-PNG heruntergeladen und frisch vollständig restauriert. Anschließend wird die alte PNG wieder geöffnet und inhaltlich vollständig gegen die ursprüngliche Fassung verglichen.

Der externe KI-Arbeitsweg bleibt **offen**. `FREMD-KI-PRUEFANLEITUNG.md` beschreibt, welche Dateien tatsächlich an eine fremde KI zu geben und welche Originalfelder danach zu vergleichen sind. Eine kontrolliert erzeugte Referenz beweist keine erfolgreiche Fremd-KI-Übertragung.

## 5. Vollständige technische Regression

| Prüfung | Tatsächliches Ergebnis |
|---|---|
| Erneute Ausgangssuite vor Anpassungen | 107 Daten / 169 Chromium / 4 RC2 bestanden |
| Neu verpackter, entpackter Ausgangsstand | separat ausgeführter Browserprüfer bestanden |
| Aktuelle Datentests | 108/108 bestanden; nach Grafikkorrektur nochmals vollständig ausgeführt |
| TypeScript, Produktionsbuilds, Offline-Ressourcen, HTML-Größe | bestanden |
| Aktuelle vollständige Chromium-Suite | 173/173 bestanden, keine ausgelassenen Fälle, Laufzeit 13,4 Minuten |
| Vier neue vollständige Papier-Kreisläufe | 4/4 bestanden, alle geforderten Ansichten, einschließlich erreichbarer vergrößerter Beschriftungen |
| Aktuelle eingefrorene RC2-Prüfung | 4/4 bestanden |
| Separater Blackbox-Lauf: Hilfe / korrigierte Papierprobe | beide bestanden; Hilfe mit 12/60 Karten, Papier bei allen vier Ansichten |
| Neue Inhaltsdatei, Aufgabe und Lehrkraftentwurf über CLI | alle drei validiert, inklusive echter Bilddecoder |
| Universal-SCORM ZIP/XML/Bytevergleich | bestanden |
| START-HIER-Druckumfang | zwei A4-Seiten |
| Fremd-KI / reale Schulgeräte / WebKit | offen, keine simulierte Freigabe |


Alle bisherigen Tests bleiben bestehen; keine Assertion wurde abgeschwächt. Vier zusätzliche komplette Browserfälle führen die neue Papierprobe bei **1024 × 768, 768 × 1024, 600 × 800 und 320 × 700 CSS-Pixeln** durch den beschriebenen Kreis. Die bisherigen acht kompletten 12-/60-Karten-Hilfekreisläufe bleiben erhalten.

Bestätigte Prüfumfänge: 5/12/18/60 Karten, numerische Startablage, Pflicht-/V-Metadaten, kurze/lange Texte, Medienproportionen, bestehende Bildvergrößerung, editierbare Tabellen, fünf Denkimpulse und beide Gruppierungsvorlagen, eigene Kategorien, Suche/Mehrfachzuordnung, Vorlagenwechsel und Fehlerhinweise, temporäre Vorschau, Entwurf/Aufgabe, native Chromium-Touch-Eingaben, Pan/Pinch/Abbruch/Mehrfinger, 220-Verbindungen-Kreuzungen, verzögerte Klicks/R1/R1b, Undo/Redo, Original-PNG mit Grenzfall/Rückfall, vollständiger Restore, A4/A3, tatsächliche PDFs, manipulierte Dokumente, alte Dateiversionen, neue Inhaltsrevisionen, Offline und HTML unter 10.000.000 Bytes.

Vollständige Befehle für die Quellvorlage:

```sh
npm ci
CLASSROOM_SCORM=1 npm run check
npm run test:rc2
npm run validate:mystery -- examples/ki-papierprobe/inhalt.json
npm run validate:mystery -- examples/ki-papierprobe/Parkteich-Aufgabe-v1.mysteryboard
npm run validate:mystery -- examples/ki-papierprobe/Parkteich-Lehrkraftentwurf-v1.mysteryboard
npm run package:universal
node qa/release-candidate/pruefen.mjs PFAD_ZUM_ENTPACKTEN_ABNAHMEPAKET
python3 scripts/package-project.py AUSGABE/MysteryBoard-Universal-Projektvorlage.zip
python3 scripts/package-release-candidate.py AUSGABE/MysteryBoard-ReleaseCandidate-Abnahme.zip
```

Node.js 24/npm, Python 3 und Chromium sind für den technischen Neuaufbau erforderlich und dokumentiert. Falls kein System-Chromium verfügbar ist: `npx playwright install chromium`; unter Linux sind passende Browser-Systembibliotheken erforderlich. Die fertige App braucht weder Node/Python noch kostenpflichtige Software.

Der Blackbox-Prüfer startet lokale Server auf freien Ports, extrahiert die tatsächlich gelieferte SCORM-ZIP, prüft deren HTML auf Bytegleichheit und setzt Kontexte danach offline. Er prüft leere Local-/SessionStorage, keine von der App ausgelösten Laufzeit-Netzwerkanfragen und ausschließlich Initialize/Finish an der simulierten LMS-API. Keine Teamnamen, Schülerantworten, Spielstände oder Bewertungen werden an ein LMS übertragen. Ein gewöhnlicher lokaler Favicon-GET des Browsers ohne Parameter wird nicht als App-Datenübertragung gezählt. Die PNG wird unabhängig vom Anwendungscode mit Node-zlib und SHA-256 ausgewertet.

## 6. Reproduzierbarkeit und Lieferpakete

Die Projektvorlage enthält sämtliche Quellen, Editor/Hilfeeditor, lokal registrierte Inhalts-/Dokumentenschemata, CLI/Validierung/Build/SCORM-Routine, ausführliche und kurze Anleitungen, KI-Prompt, Original-/Referenzbeispiele und alle automatisierten Tests. Installierte Abhängigkeiten, Git-Verzeichnis, regenerierbare Test-HTMLs sowie frühere generierte Screenshots/Prüf-PDFs werden nicht verpackt. Aktuelle vollständige Nachweise sind enthalten; historische Textprotokolle bleiben als Kontext erhalten. Das hält die Weitergabe kompakt, ohne Quellen oder Tests zu entfernen. Keine Zugangsdaten oder lokalen Cloud-Pfade werden mitgegeben; das fertige Paket wird darauf gescannt.

Nach der endgültigen Verpackung wird die tatsächliche Projekt-ZIP in einen neuen Ordner ohne node_modules und ohne Git-Verknüpfung entpackt. Dort werden Abhängigkeiten installiert, die neue Papier-Inhaltsdatei validiert, eine neue importierbare Aufgabe erzeugt, Universal-HTML und SCORM gebaut und technisch geprüft. Neu erzeugte Dokument-/Produktionsbytes werden mit den mitgelieferten Referenzen verglichen. Ein Dateizugriffs-Trace kontrolliert, dass nicht auf die ursprünglichen Projektordner zurückgegriffen wurde.

Auch die endgültige Abnahme-ZIP wird vollständig neu entpackt. Ihre Browserprüfer erhalten ein eigenes frisches npm ci und verwenden die tatsächlich enthaltenen Dateien. Äußere ZIPs werden nach der Prüfung nicht mehr verändert. Die abschließenden kalten Protokolle und äußeren ZIP-Prüfsummen stehen deshalb separat neben den ZIPs im Liefermanifest und ergänzten Prüfbericht.

Lieferungen: `MysteryBoard-Universal-Projektvorlage.zip`, `MysteryBoard-Universal-SCORM-1.2.zip`, `MysteryBoard-Universal.html` und `MysteryBoard-ReleaseCandidate-Abnahme.zip`. Das Abnahmepaket enthält vollständigen Entwurf/Aufgabe, echte alte/neue Schüler-PNGs, zweite Inhaltsfassung, Papieroriginal und KI-Prompt, PDFs/Screenshots, Logs/Prüfsummen und eigenständig ausführbare Blackbox-Skripte.

## Aktuelle Artefakte

| Datei | Bytes | SHA-256 |
|---|---:|---|
| MysteryBoard-Universal.html | 818650 | `46cf0aef945ce8398f4ee2b99f71a2f5e67d4ccd2feb0950a06c77b9222dc921` |
| MysteryBoard-Universal-SCORM-1.2.zip | 268377 | `f17b3e8deaa8e51d49f0a2b83a6ba360d58ecd598c733cd5f07f6221477b9c63` |
| MysteryBoard-klein.html | 823317 | `3681e3a08b98daf624432914e658370db9ccdd5cc478edb3bf3d3ec58394748a` |
| MysteryBoard-umfangreich.html | 856203 | `bb168bc07e60767d939b2bfbf6239d9abcf99b60004acfad44cec9ae8c3232df` |

## 7. Geschützte Stände und notwendige Freigaben

Main, bestehende Release-Tags und Boden-RC2 bleiben unverändert. Die beiden eingefrorenen Boden-HTMLs behalten SHA-256 `21dd6ad5c813ba5bd12ca521f03602a195ccea44ee70769119280e4ca088fd5f` bei jeweils 459.542 Bytes; Boden-RC2-SCORM bleibt `42ac3d51e2e34431efe9b0ca9b0f4e84085d9b651e4fac6747d843bf6091c3a0`. Kein Merge und keine Pages-/Canva-/sonstige öffentliche Veröffentlichung. Der Git-Remote-Stand wird vor und nach dem alleinigen Feature-Branch-Push verglichen.

Weiterhin offen: WebKit 26.5 (nicht vorhanden), WebKit 27.2 (Start durch fehlende Hostbibliotheken blockiert), echte Safari-/verwaltete Schul-iPad-/itslearning-/Canva-Prüfungen, nativer Safari-Druckdialog, menschliche fachliche Abnahme und tatsächlicher Fremd-KI-Test. Chromium-Touch ist eine technische Emulation; Chromium-PDF ist kein Safari-Systemdrucknachweis. Eine Lehrkräfte-Nutzerstudie wurde nicht durchgeführt. Die Cloud sperrt direkte file://-Navigation und sichtbare Systemdruckdialoge; geprüft wird unveränderte HTML über lokalen HTTP-Start und anschließend offline. Keine Richtlinie wird umgangen und keine schulische Freigabe behauptet.
