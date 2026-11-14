# Hilfeeditor: gezielte Abschlussprüfung und eigenständiges Abnahmepaket

Ausgangscommit: `9aa16fd41f3ce9e5e35015bb1f4c7fe0911f8e89`. Branch: `feat/mysteryboard-author-help-editor`. Prüftag: 14.11.2026. Der endgültige Quellcommit wird im Paket in `QUELLSTAND.json` und im Projektpaket in `PROJECT-VERSION.json` angegeben. Kein Merge, kein Force-Push und kein Release-Tag-Wechsel.

## Befund und minimale Korrektur

Der Browser reproduzierte einen tatsächlichen Fehler: Drei aktive Hilfegruppen mit den Namen `Ursachen`, ` Ursachen ` und `ursachen` konnten im Stand 9aa16fd übernommen und veröffentlicht werden. Ursache war der Vergleich der unveränderten Zeichenfolgen in der bestehenden Formatprüfung. Der Reproduktionstest scheiterte erwartungsgemäß an der fehlenden Fehlermeldung. Screenshot und Protokoll sind enthalten.

Die neue redaktionelle Prüfung vergleicht Gruppennamen nach Unicode-NFC-Normalisierung, Entfernen äußerer Leerzeichen, Zusammenfassen innerer Leerzeichen und deutscher Kleinschreibung. Offensichtlich gleichlautende aktive Gruppen werden vor der Übernahme, der Schüler-Vorschau und der Veröffentlichung abgefangen. Die Felder erhalten verständliche Hinweise; alle Eingaben bleiben erhalten. Die Aufgabe lässt sich nach eindeutiger Umbenennung normal sichern.

Die Prüfung wird außerdem beim Aufgaben-PNG und beim CLI-Erstellen/Build verwendet. Sie schreibt keine Namen, Farben oder Kartenzuordnungen automatisch um. Import und Wiederherstellung historischer Dateien bleiben unverändert: Ein bisher technisch gültiges Dokument bleibt lesbar und vollständig sicherbar. Soll daraus eine neue Schülerversion entstehen, müssen mehrdeutige Gruppennamen zuvor im Lehrkräftemodus präzisiert werden. Dies trennt rückwärtskompatible Formatgültigkeit von der redaktionellen Prüfung neu bereitgestellter Aufgaben. Bestehende Tests für den verlustfreien Import individueller Schreibweisen bleiben erhalten.

Betroffen sind nur `src/core/help-authoring.ts`, dessen Verwendung in `HelpEditor.tsx`, die Veröffentlichung in `core/authoring.ts` und die entsprechende CLI-Ausgabeprüfung in `scripts/mystery-tools.mjs`. Datenmodell, Schemata, PNG-/QR-Speicherung, History, Pointerlogik und Architektur wurden nicht verändert. Es wurden keine neuen Funktionen der Unterrichtsanwendung ergänzt.

## Weitere tatsächliche Prüfungen

Alle fünf Denkimpulse wurden im Browser ausgewählt, anschließend individuell verändert, über einen anderen Vorlagentext hinweg wieder als eigener Text aufgerufen und als Entwurf heruntergeladen. Nach dem Schließen wurde jeder Entwurf in einem neuen Browserkontext geöffnet und der vollständige Text verglichen. Dabei wurde kein weiterer Fehler reproduziert; die bestehende Textbearbeitung blieb unverändert.

Die Systeme „Ursachen und Wirkungen“, „Nutzungskonflikte“, eigene Gruppen und ausgeschaltete Nummernhilfe wurden geprüft. Beim Ausschalten und Wiedereinschalten innerhalb der Bearbeitung bleiben die lokalen Zuordnungen erhalten. Nach bewusstem Übernehmen ohne farbige Hilfe enthält die neue Fassung keine Nummern-Gruppen; die zuvor exportierte Datei bleibt vollständig erhalten. Belegte Gruppen werden erst nach Bestätigung entfernt. Die vorhandenen Karten-/Gruppen-Revisionstests prüfen Hinzufügen, Löschen, Neunummerierung und die Anpassung sämtlicher tatsächlicher Kartenreferenzen.

Die echte Schüler-Vorschau verwendet weiterhin dieselben Komponenten. Der Browser erstellte dort eine Verbindung; die veröffentlichte Aufgabe enthielt trotzdem keine Lösungspfeile oder Vorschau-Arbeitsstände. Temporäre Hilfen änderten weder Kartenpositionen noch Kartenfarben, eigene Kategorien oder History. Die Original-PNG war mit ein- und ausgeschalteter Orientierung byteidentisch.

Zusätzlich wurden Hilfeeditor und Schülerhilfe ausdrücklich bei **1024×768, 768×1024, 600×800 und 320×700 CSS-Pixeln** per Touch ausgeführt. Alle drei Legendenzeilen waren auch im kleinen, scrollbaren Hilfefenster erreichbar. Screenshots jeder Ansicht sind enthalten. Der bereits vorhandene automatisierte Erstbedienungsweg wurde ebenfalls erneut ausgeführt: 14 Handlungen vom vorhandenen Mystery bis zum Download, einschließlich Schüler-Vorschau. Dies ist eine Simulation anhand der sichtbaren Bedienelemente, keine empirische Nutzerstudie mit Lehrkräften.

## Farben

Die acht angebotenen Nummernfarben bleiben unverändert. Die vorhandenen Kontrasttests prüfen alle tatsächlichen Kombinationen mit schwarzer/weißer Nummernschrift auf mindestens 4,5:1. Eine zusätzliche rechnerische sRGB/D65-Prüfung ergab für das ähnlichste Farbpaar einen CIE76-Abstand von rund 24,44. Das ist ein numerischer Vergleich für normales Farbsehen, keine Garantie für Farbsehschwächen oder eine menschliche Erkennungsstudie. Darum bleiben Gruppenbezeichnungen, konkrete Kartennummern in der Legende und die zugänglichen Beschriftungen unverzichtbar. Es wurde kein Kontrastfehler reproduziert; die Palette wurde nicht kosmetisch umgestaltet.

## Eigenständiger Prüfcode ohne Anwendungsmodule

Das Abnahmepaket enthält nun `browserpruefung/pruefen.mjs`, eine minimale eigene Paketdatei und ein Lockfile. Dieser Playwright-Code arbeitet ausschließlich mit den tatsächlich enthaltenen Dateien. Er importiert weder MysteryBoard-Quellen noch dessen PNG-/Dokumentcodec. Die Original-PNG wird zusätzlich separat mit Node-zlib und SHA-256 gelesen. Die SCORM-ZIP wird tatsächlich extrahiert; ihre App muss byteidentisch zur HTML sein. Der lokale Prüfserver bindet nur an 127.0.0.1 und wird nach dem Lauf beendet.

Der vollständige Lauf beginnt mit dem vorhandenen Lehrkraftentwurf, ändert den Denkimpuls, erstellt drei farbige Gruppen, ordnet nur ausgewählte Karten zu, lädt den Entwurf herunter und schließt die Sitzung. In einer neuen Sitzung werden alle Hilfen überprüft und eine neutrale Schülerversion heruntergeladen. Diese wird in der tatsächlichen SCORM-Anwendung mit eigenem Team geöffnet. Beide Hilfestufen, Nummernfarben und Legende werden geprüft und deaktiviert. Anschließend folgen Touch/Pinch, beschriftete Verbindungen, eigene Farbe/Kategorie und Undo/Redo. Echte A4-/A3-PDF-Dateien werden mit Chromiums PDF-Backend erzeugt und ihre Papierabmessungen geprüft. Eine Original-PNG wird in einer neuen SCORM-Sitzung vollständig wiederhergestellt und weiterbearbeitet. Schließlich wird das ursprüngliche Mystery erneut redaktionell geändert, eine neue Inhaltsfassung erzeugt und die alte Schülerarbeit anschließend unvermischt geöffnet.

Alle Work-/Inhaltsvergleiche sind tatsächliche Vergleiche heruntergeladener Dateien. Im simulierten LMS sind ausschließlich `LMSInitialize` und `LMSFinish` zulässig; Aufrufe mit Schülerdaten lassen den Lauf scheitern. Die Kontexte sind nach dem Laden offline; externe HTTP(S)-Anfragen führen ebenfalls zum Fehler. Ergebnisse, Screenshots, echte Arbeitsdateien und PDFs werden im entpackten Paket abgelegt.

## Reproduzierbare Befehle

Im vollständigen Quellprojekt:

```sh
npm ci
npx tsc --noEmit
CLASSROOM_SCORM=1 npm run check
npm run test:rc2
```

Im vollständig entpackten Abnahmepaket:

```sh
cd browserpruefung
npm ci
npx playwright install chromium
npm test
```

Ein bereits verfügbarer System-Chromium wird automatisch verwendet; `CHROMIUM_PATH` ist optional. Node/npm werden nur für die technische Prüfung benötigt. Die Anwendung bleibt ohne zusätzliche Installation im unterstützten Browser nutzbar. **Abschluss: 105/105 Datentests, 161/161 Chromium-Browsertests und 4/4 separate RC2-Tests bestanden. Kein Test war übersprungen oder instabil.** Die vollständigen Ergebnisse der aktuellen Suite stehen unter `pruefnachweise/abschluss/`. Frühere Berichte sind als Historie kenntlich und ersetzen diesen Abschlussnachweis nicht.

## Lieferung und Grenzen

`MysteryBoard-Hilfeeditor-Abnahmepaket.zip` enthält physisch die Universal-HTML, die SCORM-ZIP, Entwurf, daraus erzeugte Aufgabe, Konflikt-Aufgabe, eigene Gruppen, eine Aufgabe ohne farbige Hilfe, echte Schüler-PNG, Revision, beide Schüler-Hilfestufen als Screenshots, den aktuellen unabhängigen Prüfauftrag, Protokolle, SHA-256 und Quellcommit. Die vollständige Projektvorlage wird separat geliefert. Beide ZIPs werden frisch entpackt und geprüft; der vollständige Neubau aus der Projektvorlage und der tatsächliche Browserlauf aus dem Abnahmepaket werden im abschließenden Liefernachweis dokumentiert.

WebKit 26.5/27.2, reale Safari-/Schul-iPad-/itslearning-/Canva-Prüfungen und der native Safari-Systemdruckdialog bleiben offen. Die Cloud erlaubt die Prüfung der unveränderten HTML über einen lokalen HTTP-Server und danach offline; direkte `file://`-Navigation und der sichtbare Systemdruckdialog sind administrativ gesperrt. Es wurde keine Richtlinie umgangen. Native Chromium-PDF-Bytes sind kein Nachweis des Safari-Druckdialogs. Eine tatsächliche Farbsehschwäche- oder Lehrkräfte-Nutzerstudie wurde nicht durchgeführt.

Die technische Prüflieferung bedeutet keine schulische Freigabe. Boden-RC2, `main`, bestehende Release-Tags und die anderen geschützten Entwicklungsbranches bleiben erhalten. Es gibt weiterhin keine automatische Bewertung und keine automatische Speicherung oder Übertragung von Schülerarbeitsständen.
