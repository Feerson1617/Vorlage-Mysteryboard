# MysteryBoard – Hilfeeditor: finale Optimierung und Weitergabe

Prüfdatum: 14.11.2026. Repository: Feerson1617/Vorlage-Mysteryboard. Ausgangscommit: `d7b41c20a8d773248f71f858ce18f5ce1b5c51d8`. Neuer Branch: `feat/mysteryboard-help-editor-final`. Den genauen Liefercommit enthalten `QUELLSTAND.json` im Abnahmepaket und `PROJECT-VERSION.json` in der Projektvorlage. Keine Veröffentlichung, kein Merge und keine schulische Gerätefreigabe.

## Fehlerursache und Änderungen

Die bisherige Hilfe-Vorschau verwendete die vollständige gemeinsame App samt Sicherungsfunktion. Der Fehler wurde am unveränderten Ausgangsartefakt selbst reproduziert: Eine echte PNG-Datei von 739.342 Bytes wurde aus der Vorschau heruntergeladen. Originalartefakt und Reproduktionsdatei sind per SHA-256 im Nachweis referenziert.

`src/App.tsx` erhält die ausdrückliche Betriebsart `mode="preview"`. Dort sind Datei-Eingabe, Sicherung, Import, Teamänderung, Druck/PDF und Start-/Lehrkräftewechsel nicht erreichbar. Auch Import-, Scan-, Sicherungs- und Druckhandler sind gesperrt. Die Vorschau zeigt Hilfe direkt in der schlanken Leiste, auch bei schmaler Ansicht. Kartenlesen, Bewegung, Verbindungen, Übersicht, Pinch und beide Hilfestufen bleiben dieselben Funktionen des gemeinsamen Players. Beim Schließen wird die App ausgehängt: lokaler Arbeitsstand, History und Hilfeaktivierung gehen verloren. Die normale Schüler-Betriebsart bleibt voreingestellt und behält ihre Werkzeuge. Der temporäre Vorschauzustand erzeugt keine zusätzliche Verlassen-Warnung; der geöffnete Lehrkraftentwurf wird weiterhin geschützt.

`src/components/AuthorEditor.tsx`: Der Einstieg heißt **Hilfen bearbeiten**, darunter **Denkimpuls und farbige Kartennummern**. Die Kurzangabe zählt den tatsächlich übernommenen Denkimpuls, Farbgruppen und eindeutigen Kartenreferenzen. Nach einer Hilfeänderung erinnert ein Status an das bewusste Herunterladen über **Entwurf sichern**. Ein bloß erzeugter Download gilt weiterhin nicht als dauerhafte Ablage.

`src/components/HelpEditor.tsx`, `src/core/help-authoring.ts`, `src/style.css`: Suche nach exakter Kartennummer (auch V-Nummer) oder Teil des Kartentitels, einschließlich sichtbarer Trefferzahl und Zurücksetzen. Die Suche filtert nur die Anzeige. Einzelzuordnung bleibt Standard. Erst **Mehrere Karten gemeinsam zuordnen** öffnet Gruppenwahl und Markierfelder. Die sichtbare Anzahl benennt auch ausgewählte, durch die Suche ausgeblendete Karten. Eine bewusste Sammelzuordnung entfernt vorherige Gruppenmitgliedschaften und fügt jede gewählte Karte genau einmal hinzu. Andere Karten bleiben unverändert. Schließen verwirft nur die temporäre Auswahl, keine übernommenen Zuordnungen. Gelöschte Zielgruppen können nicht versehentlich verwendet werden.

Die fünf Denkimpulse, zwei Gruppierungsvorlagen, Prüfung gleichlautender Gruppennamen, freiwillige zunächst ausgeblendete Hilfe, reine Nummernfärbung sowie die Regeln gegen Musterlösungen und automatische fachliche Zuordnung bleiben erhalten. Datenmodell, Dokumentformat 3, PNG-/QR-Verfahren, IDs, History, Export und Board-Ereignisbehandlung wurden nicht verändert.

## Bedienung und Sichtprüfung

Ein bestehender Entwurf führt mit **Hilfen bearbeiten → Denkimpuls/Gruppen/Kartenauswahl → Vorschau → Hilfe übernehmen → Entwurf sichern → Datei herunterladen** zu einer erneut bearbeitbaren Datei. Die Schülerversion wird gesondert erzeugt. Die Vorschau bietet ausdrücklich keine Dateifunktionen.

12 und 60 Karten wurden jeweils bei 1024 × 768, 768 × 1024, 600 × 800 und 320 × 700 CSS-Pixeln durch den vollständigen Autoren-/SCORM-/PNG-Kreislauf geführt. Die neuen Tests prüfen horizontale Überläufe und nutzen echte Touch-Schaltflächen. Screenshots wurden zusätzlich visuell kontrolliert: lesbare Labels, sichtbarer Filterzähler, erreichbare Standardaktionen und vollständige Nummernzuordnung in der Übersicht. Bei 768 Pixeln Breite ist die gefilterte Hilfeeditor-Seite im neutralen 60-Karten-Beispiel 2.174 CSS-Pixel hoch (Suche „1“). Das ist eine Messung der gefilterten Ansicht; die ungefilterte Gesamtliste bleibt vorhanden. Bei 320 Pixeln bleiben Formulare einspaltig und scrollbar. Keine allgemeine Zusage zur Lesbarkeit jeder beliebigen fachlichen Medienvorlage.

## Reproduzierbare Prüfungen

Die vollständigen Befehle und Ergebnisse liegen unter `pruefnachweise/final/` (aktuelle Zusammenfassung zusätzlich direkt unter `pruefnachweise/`). Die Quellvorlage enthält alle Tests. Bisherige Assertions wurden nicht entfernt; bestehende Einstieg-Selektoren wurden der ausdrücklich verlangten Beschriftung angepasst.

```sh
npm ci --cache /tmp/mysteryboard-npm-cache
CLASSROOM_SCORM=1 npm run check
npm run test:rc2
PLAYWRIGHT_BROWSERS_PATH=/workspace/mysteryboard-browsers node docs/test-evidence/help-editor/final/webkit-probe.mjs
node qa/help-review/pruefen.mjs PFAD_ZUM_ABNAHMEORDNER
python3 scripts/validate-scorm.py artifacts/MysteryBoard-Universal-SCORM-1.2.zip artifacts/MysteryBoard-Universal.html MysteryBoard-Universal-v3
python3 scripts/package-project.py AUSGABE/MysteryBoard-Universal-Projektvorlage.zip
python3 scripts/package-help-review.py AUSGABE/MysteryBoard-Hilfeeditor-Final-Abnahmepaket.zip
```

Der WebKit-Aufruf ist mit dem tatsächlich verwendeten vollständigen JavaScript in `webkit-probe.mjs` dokumentiert; `webkit.txt` enthält die Startdiagnose. Die temporären Pfade sind lediglich Beispiele für die Cloud-Prüfung und werden für die normale Anwendung nicht benötigt.

| Prüfung | Ergebnis |
|---|---|
| Datentests | 107/107 bestanden |
| Produktionsbuilds / TypeScript / Offline-Ressourcen / HTML-Größe | bestanden |
| Vollständige Chromium-Suite | 169/169 bestanden, keine ausgelassenen Tests (12,2 Minuten) |
| Neue vollständige 12-/60-Karten-Kreisläufe | 8/8 bestanden, alle vier Ansichten |
| Eingefrorene RC2: HTML/SCORM, Quer-/Hochformat | abschließender vollständiger Lauf 4/4 bestanden |
| Separater Blackbox-Prüfer | bestanden, 10 protokollierte Prüfabschnitte, 13 Screenshots, echte A4/A3-PDFs |
| SCORM-1.2-Manifest, ZIP-CRC, lokale Referenzen, App-Bytevergleich | bestanden |
| WebKit 26.5 / 27.2 | offen, tatsächliche Startdiagnose beigefügt |

Ein erster paralleler RC2-Lauf bestand 3/4 Fälle; die Undo-Wirkung nach einer simulierten Bewegung war beim Zustandsvergleich nicht sichtbar. Gezielte Wiederholung 1/1 und anschließender vollständiger RC2-Lauf 4/4 bestanden ohne Änderung der eingefrorenen Anwendung oder ihrer Tests. Das erste Log und JSON sind erhalten. Beim erweiterten Blackbox-Prüfer wurde zusätzlich die CDP-Eingabe nach touchEnd über zwei Browser-Frames synchronisiert; alle inhaltlichen Assertions bleiben bestehen. Vollständige Einordnung: `VERSUCHSPROTOKOLL.md`.

| Aktuelles Artefakt | Bytes | SHA-256 |
|---|---:|---|
| MysteryBoard-Universal.html | 818147 | `57bc035ce569fdfa84b07dd6a25c2fa47698819f5fefeb795e2d4420fccf9184` |
| MysteryBoard-Universal-SCORM-1.2.zip | 268174 | `ad11f72e71aca3e020e78f57b3e5adf9d24a5b130f22538bcfddf6fe16dae303` |
| MysteryBoard-klein.html | 822814 | `84bf3cdfbd43bbf5dad4d219df1f55d76d0d886af87c41ef0dde351d8956bf8a` |
| MysteryBoard-umfangreich.html | 855700 | `8c830081433b220c192db42167ac2ec136fcf9d7b3c6ae71bde9d8bd5c9af6c9` |

Die acht zusätzlichen Playwright-Fälle prüfen jeweils: bestehenden Entwurf öffnen, Hilfetext und Gruppennamen ändern, Einzelzuordnung, Nummern-/Titelsuche/Nulltreffer, Sammelzuordnung mit versteckter Auswahl, echte Vorschau mit Bewegung/Verbindung/Pinch, fehlende Dateiaktionen, null Downloads aus Vorschau, frisches Remount ohne Änderungen, unveränderte Startdaten, bewusster Entwurfsdownload, neue Sitzung, neutraler Aufgabenexport, neue Inhaltsrevision, echte SCORM-ZIP, Team/Hilfe/Touch/Pinch, Original-PNG und vollständige Wiederherstellung trotz zuvor geöffneter neuer Revision.

Die vorhandenen Tests decken insbesondere ab: fehlerhafte/gleichlautende Gruppen, leere Zuordnungen, alle fünf Denkimpulse, alte Dokumente und PNGs, Bilder/Tabelle, Versions- und Inhaltsisolation, A4/A3 und PDF-Bytes, R1/R1b (pointerup ohne click, verspäteter click, keine unbewusste Löschung, Pinch/Abbruch/Mehrfinger), 220-Verbindungen-Belastungstest, Undo/Redo, PNG-Grenze/Rückfall, 12-/60-Karten-Restore, Offline und HTML unter 10.000.000 Bytes.

Der separate Blackbox-Prüfer unter `browserpruefung/` importiert keinen Anwendungscode. Er startet einen lokalen HTTP-Server, extrahiert die tatsächlich gelieferte SCORM-ZIP, prüft deren App auf Bytegleichheit zur HTML und schaltet die Browserkontexte anschließend offline. Seine Original-PNG-Auswertung verwendet separat Node-zlib und SHA-256. Er kontrolliert leere Local-/SessionStorage sowie keine Netzwerkanfragen nach dem Laden. Die simulierte LMS-API erhält nur Initialize/Finish, keine Teamnamen, Arbeitsdaten oder Bewertungen. Dieser automatisierte Lauf ist keine unabhängige menschliche Begutachtung.

## Lieferumfang und kalter Neuaufbau

`MysteryBoard-Hilfeeditor-Final-Abnahmepaket.zip` enthält die aktuelle Universal-HTML und die echte SCORM-ZIP, vollständige 12-/60-Karten-Entwürfe und Aufgaben, echte Schüler-PNGs, Revisionen, Screenshots, A4-/A3-PDFs, alle aktuellen Logs, Prüfsummen und den selbstständig ausführbaren Blackbox-Prüfer samt eigenem Paket-Lock. `START-HIER.md` erklärt die grafische Prüfung.

`MysteryBoard-Universal-Projektvorlage.zip` enthält vollständigen Quellcode, gemeinsames Dateiformat, maschinenlesbare Schemas, KI-/Lehrkräfteanleitung, Beispieldateien, Validatoren, Builds, Tests, SCORM-Verpackung und die unveränderte manuelle GitHub-Workflowdatei. Die KI-Anleitung verlangt Originalvergleich und Rückfrage bei unlesbaren Zahlen/Texten; es wird keine OCR-/KI-Schnittstelle oder Serverfunktion ergänzt. Ein weiteres Mystery benötigt eine gültige Inhaltsdatei und Buildkonfiguration, keine neue Oberfläche.

Der tatsächliche ausgelieferte Projekt-ZIP wird in einen neuen Ordner ohne node_modules entpackt, sein vollständiges Hashmanifest geprüft, `npm ci`, `npm run build` und `npm run package:universal` ausgeführt und die erzeugte HTML sowie SCORM-ZIP byteweise mit den ausgelieferten Dateien verglichen. Auch die tatsächliche finale Abnahme-ZIP wird neu entpackt und der mitgelieferte Browserprüfer nach eigenem `npm ci` ausgeführt. Die kalten Nachweise und äußeren ZIP-Prüfsummen werden neben den endgültigen ZIPs ausgeliefert, damit die bereits geprüften Archive nachträglich nicht verändert werden müssen.

## Geschützte Stände und offene Praxisabnahme

Die beiden eingefrorenen Boden-HTMLs bleiben unverändert: SHA-256 `21dd6ad5c813ba5bd12ca521f03602a195ccea44ee70769119280e4ca088fd5f`, jeweils 459.542 Bytes. RC2-SCORM bleibt `42ac3d51e2e34431efe9b0ca9b0f4e84085d9b651e4fac6747d843bf6091c3a0`. Main, vorhandener Hilfeeditor-Branch und Unterrichtstags werden vor/nach dem ausdrücklich erlaubten Push verglichen. Nur der neue Feature-Branch wird gepusht.

WebKit 26.5 fehlt. WebKit 27.2/revision 2388 ist vorhanden, startet aber nicht: libgtk-4, libgraphene, libharfbuzz-icu, libmanette, libhyphen und libGLESv2 fehlen. Beide Engine-Prüfungen bleiben offen. Keine Erfolgsmeldung oder Safari-Freigabe daraus ableiten.

Reale Safari-/Schul-iPad-/itslearning-/Canva-Prüfungen, native Safari-Druckdialoge sowie eine Lehrkräfte-Nutzerstudie und Farbsehfähigkeitsprüfung bleiben erforderlich. Chromium-PDF-Bytes bestätigen A4/A3-Ausgabe, keine native Safari-Druckfunktion. Direkter file://-Start und sichtbarer Systemdruck sind in dieser Cloud administrativ gesperrt; geprüft wurde über lokalen HTTP-Start und anschließenden Offline-Betrieb. Es wurde keine Richtlinie umgangen. Der Nutzerdownload im Chat lässt sich serverseitig nicht nachweisen; die physisch vorhandenen ZIPs wurden selbst ausgepackt und geprüft. Keine öffentliche Veröffentlichung und kein automatisches Speichern.
