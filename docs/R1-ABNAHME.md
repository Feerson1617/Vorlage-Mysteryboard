# MysteryBoard R1 – Ereigniskorrektur und Abnahme

10. November 2026. Basis: `545ece1fd723b953e4b36456d37bd6210a5ac916`, Branch `feat/mysteryboard-prototype`. Dies ist ein lokaler Korrekturstand; kein neuer Commit, Pull Request, Merge oder Veröffentlichung wurde ausgeführt. Die Rohprotokolle verwenden UTC-Zeitstempel.

## Ergebnis und Prüfgrenzen

Die Auswahl wird beim gültigen `pointerup` genau einmal ausgelöst. Ein nachfolgender nativer Klick wird für die Board-Geste nicht zur Aktivierung benötigt. Die Gegenproben prüfen verspätete Klicks auf den neu erschienenen Löschknopf, doppelte alte Klicks, neue bewusste Button-Tipps, Tastatur, Gestenabbruch und Mehrfingerfolgen.

| Nachweis | Stand |
| --- | --- |
| Chromium 156.0.8078.79, zwei neue Produktions-HTMLs | Zehn native Referenztipps und zehn zusätzliche Tipps ohne `click` korrekt. |
| Automatischer Vergleich ohne `click` | Unveränderte Git-Artefakte `2518a53`: 10/10; `545ece1`: 0/10; R1-Korrektur: 10/10. |
| WebKit 26.5 | **Offen.** Keine passende Engine/Playwright-Installation vorhanden; kein unabhängiger Kompatibilitätsnachweis. |
| WebKit 27.2 | **Offen.** Offizieller Download von Revision 2388 scheitert mit HTTP 403 „Domain forbidden“; Startversuch bestätigt fehlende Browserdatei. Kein erfolgreicher Engine-Lauf. |
| Original `Touch-Vergleich.cjs` und `Trace-WebKit-*.json` | **Offen.** Der hochgeladene Restauftrag verweist auf `MysteryBoard-Abnahme-545ece1.zip`; dieses Paket lag hier nicht vor. Pfad/Link wurde angefragt. Der eigene Vergleich ersetzt keinen Lauf des Originalskripts. |
| Schul-iPad / Canva | Nicht geprüft. Keine schulische oder Host-Freigabe. |

Die im Restauftrag berichteten WebKit-Werte 10/10 beziehungsweise 0/10 sind externe Vorbefunde und werden hier nicht als eigene Messung ausgegeben. Der Test ohne `click` isoliert den bekannten Fehlermechanismus; er ersetzt keine WebKit- oder Geräteprüfung.

Der abschließende Lauf von `npm run check` besteht vollständig: **31/31 Datentests, Typprüfung und beide Produktionsbuilds, 43/43 Chromium-Browsertests**. Darin sind alle bisherigen 33 Browsertests und zehn neue R1-Prüfungen enthalten. Keine übersprungenen, fehlgeschlagenen oder erst nach Wiederholung erfolgreichen Browsertests. Laufzeit des Browserteils: rund 1,9 Minuten; Node 24.22.1, Playwright 1.65.0. Die detaillierten Einzelergebnisse stehen in `test-evidence/r1/results.json`, das vollständige Terminalprotokoll in `test-evidence/r1/check.txt`.

## Ursache und Änderung

In `545ece1` legte `pointerup` lediglich ein Antippziel in einem Ref ab. Erst der spätere SVG-`click` öffnete den Dialog. Fehlt dieses Ereignis, bleibt die Auswahl wirkungslos. Die frühere sofortige Aktivierung hatte wiederum einen nativen Folge-Klick in einen neu erschienenen Dialog durchgereicht.

Die korrigierte Ereignisfolge:

1. `pointerdown` hält Karte bzw. Verbindung fest. Sichtbare Label-Layer und breite Linien-Trefferflächen bleiben unverändert.
2. `pointerup` beendet die Geste und öffnet bei einem gültigen Tipp den passenden Dialog unmittelbar. Start- und Endziel müssen übereinstimmen, die Bewegung muss unter 8 CSS-Pixeln liegen. Der Endabstand wird auch ohne vorausgegangenes `pointermove` geprüft. Mehrfinger-Gesten bleiben bis zum Loslassen aller beteiligten Finger verbraucht; Abbruch/Capture-Verlust aktiviert nichts.
3. Ein Capture-Listener vor den Dialog-Handlern verwirft Pointer-Klicks der bereits verbrauchten Board-Geste. Eine neue bewusste Aktion außerhalb des Boards wird durch ihre eigene Down-/Up-Folge am passenden Element zugelassen und genau einmal verbraucht. Vorhandene Pointer-IDs werden abgeglichen; klassische MouseEvents werden anhand der Elementfolge zugeordnet.
4. Tastatur- und programmatische Nicht-Pointer-Aktivierungen (`detail: 0` ohne Pointer-Typ), darunter die bestehende Dateiauswahl, bleiben möglich. Listener werden beim Aushängen des Boards entfernt.

Die Entscheidung verwendet keine pauschale Wartefrist, kein Overlay und keine Browserkennung. Es gibt keinen vorgemerkten Board-Tipp mehr, den ein späterer Klick nach einer abgebrochenen Geste auslösen könnte.

## Geänderte Dateien

| Datei | Zweck |
| --- | --- |
| `src/components/Board.tsx` | Ausschließlich Pointer-/Klickbehandlung und unmittelbare Gestenprüfung. |
| `tests/browser/r1.spec.ts` | Zehn zusätzliche Browserprüfungen; Ereignisfolgen und Dialogöffnungen werden aufgezeichnet. |
| `scripts/r1-reference.mjs` | Eigener reproduzierbarer Zehn-Tipp-Vergleich, auch mit einem ausdrücklich gewählten passenden Playwright-Modul/Engine. |
| `artifacts/MysteryBoard-klein.html`, `artifacts/MysteryBoard-umfangreich.html` | Aus dem korrigierten Quellcode mit unverändertem Buildprozess neu erzeugt. |
| `docs/R1-ABNAHME.md`, `docs/test-evidence/r1/` | Bericht, Messergebnisse und Protokolle. |

Datenmodell, ID-Vergabe, PNG/QR, History, Export, Layout, CSS, Dialogkomponente, App-Komponente, Inhalte, Abhängigkeiten, Buildkonfiguration und sämtliche vorhandenen Testdateien wurden nicht verändert. Die früheren 31 Daten- und 33 Browserprüfungen bleiben vollständig erhalten.

## Neue Prüfungen und Ereignisfolgen

Je HTML werden Karte 1, Nummer 12, Label 1–2, die letzte Karte (12/60) und erneut Nummer 1 geprüft: fünf Tipps pro HTML, zehn pro Modus. Da das Originalskript fehlt, ist dies ein ausdrücklich selbst definiertes Referenzset.

- Ohne `click`: Es werden ausschließlich `pointerdown` und `pointerup` dispatcht. Nur die Capture-Buchhaltung wird für synthetische Pointer-IDs nachgebildet; es wird kein Klick erzeugt. Der gleiche Fall scheitert am Ausgangsstand und besteht nach der Korrektur.
- Nativ: Chromium erzeugt echte Touch-/Pointer-Ereignisse. Die vollständige Reihenfolge einschließlich `touchend`, möglichem `click`, Ereignisklasse, Pointer-ID und `isTrusted` ist protokolliert. Genau eine `showModal`-Ausführung pro Tipp wird geprüft.
- Verspäteter Klick: Ein Label wird geometrisch unter den späteren Löschknopf verschoben. Nach der Dialogöffnung werden nach 350 ms alte PointerEvent- und MouseEvent-Klicks eingespielt. Beide sowie ein weiterer alter Klick bleiben wirkungslos. Der unmittelbar folgende bewusste Button-Tipp löscht genau die gewünschte Verbindung. Die 350 ms gehören ausschließlich zum Test.
- Neue Aktion während altem Klick: Ein alter Pointer-Klick zwischen Down und Up sowie nach Up einer neuen Button-Geste wird verworfen. Der eigene Klick der neuen Geste bleibt wirksam. Drei schnelle weitere Tipps werden jeweils einmal geöffnet.
- Negativfälle: Kartenzug, Pan, Pinch, dritter Finger bei versetztem Loslassen, `pointercancel`, Capture-Verlust und weit versetztes `pointerup` ohne Move-Ereignis öffnen keinen Dialog. Kartenbewegung und Pan funktionieren weiterhin. Mehrfinger-Verbindungswahl und ihr Abbruch erzeugen keine zweite Auswahl.
- Tastatur/Fokus: Maus, Enter und Leertaste auf Karten/Verbindungen, Tastaturschließen und Rückgabe des Fokus sowie die programmgesteuerte Datei-Auswahl bestehen.
- Offline: Beide Produktions-HTMLs werden nach dem ersten Laden vom Netz getrennt. Referenztipps, vollständiger PNG-Export und Wiederherstellung funktionieren ohne weitere HTTP(S)-Anfrage. Der exportierte Zustand wird mit dem ursprünglichen 12/60-Stand verglichen.

Die unveränderten Regressionen prüfen zusätzlich M1 (1–3 erstellen, sichtbares 1–2-Label gezielt ändern/löschen), freie unbeschriftete Linien, mehrere Kreuzungen des originalen 220-Verbindungen-Boards mit Maus und Touch, den erhaltenen Schutz vor unbeabsichtigtem Löschen, 12/10- und 60/90-Rückübernahme im neuen Kontext sowie sämtliche bisherigen Sicherungs-, History-, Größen- und Darstellungsprüfungen.

## Befehle und Protokolle

Arbeitsverzeichnis: `/workspace/Vorlage-Mysteryboard`. `npm run check` führt `npm test`, `npm run build` und `npm run test:e2e` aus. Der bestehende Browserbefehl baut dabei auch die getrennte 220er-Prüffassung. Die endgültigen Testzahlen stehen in `test-evidence/r1/results.json`; sämtliche Terminalausgaben und Ereignisfolgen werden mitgeliefert.

Der erste Baseline-Lauf enthielt bereits die beiden neuen Ohne-Klick-Fälle, aber noch nicht die später ergänzten acht Gegenproben. Beide Fälle scheiterten erwartungsgemäß am ersten Tipp auf `545ece1` und bestanden unmittelbar nach der Ereigniskorrektur. Der vollständige gezielte Lauf mit allen zehn neuen Fällen bestand anschließend ebenfalls (19,4 Sekunden). Die Dokumentationskopien der Terminalprotokolle entfernen ausschließlich ANSI-Farbcodes und Leerraum am Zeilenende; die ZIP-Lieferung enthält zusätzlich unveränderte Rohprotokolle und den vollständigen Playwright-HTML-Bericht.

```sh
# Vor der Änderung: erwartetes Scheitern ohne click auf beiden alten HTMLs.
set -o pipefail
npx playwright test tests/browser/r1.spec.ts 2>&1 | tee /tmp/mysteryboard-r1-baseline.log

# Nach der Korrektur: Typprüfung/Build und gezielte neue Browserprüfungen.
npm run build
npx tsc --noEmit
npx playwright test tests/browser/r1.spec.ts 2>&1 | tee /tmp/mysteryboard-r1-targeted.log

# Vollständiger abschließender Lauf.
npm run check 2>&1 | tee /tmp/mysteryboard-r1-check.log

# Versuchte zusätzliche Engine-Installation und tatsächlicher Startversuch.
PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright npx playwright install webkit
MB_ENGINE=webkit PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright \
  node scripts/r1-reference.mjs \
  http://127.0.0.1:5175/Vorlage-Mysteryboard/artifacts/MysteryBoard-klein.html \
  http://127.0.0.1:5175/Vorlage-Mysteryboard/artifacts/MysteryBoard-umfangreich.html

sha256sum artifacts/MysteryBoard-klein.html artifacts/MysteryBoard-umfangreich.html
wc -c artifacts/MysteryBoard-klein.html artifacts/MysteryBoard-umfangreich.html
git diff --check
```

Die beiden Vorversionen wurden byteidentisch mit `git show <Commit>:artifacts/<Datei>` nach `/workspace/r1-baselines/<Commit>/` kopiert. Für den eigenen Vergleich lief `python3 -m http.server 5175 --bind 127.0.0.1 --directory /workspace`. Die vollständigen Vergleichsbefehle stehen zusätzlich in `test-evidence/r1/reference-commands.sh`. `MB_EVENT_MODE=pointer-only` bezeichnet die mechanische Nachbildung ohne Klick, `native` echte Chromium-Tipps. Mit `MB_PLAYWRIGHT_MODULE=/pfad/zum/passenden/playwright/index.mjs` und `MB_ENGINE=webkit` kann derselbe Vergleich nach Bereitstellung einer passenden Engine wiederholt werden; ausgegeben wird deren tatsächliche Version.

## Produktionsdateien

| Datei | Bytes | SHA-256 |
| --- | ---: | --- |
| `MysteryBoard-klein.html` | 451262 | `fd07c6e8eef52de43eb443a30da5832b2c8482678b6d15b335e38557459dc7e5` |
| `MysteryBoard-umfangreich.html` | 484148 | `e2639f956d0c413b03a7fce5afad44d0555ff0c196741e7a0ba8c8d4d3dbe95c` |

Beide Dateien liegen unter 10.000.000 Bytes. Sie gehören zum mitgelieferten lokalen Patch auf Basis `545ece1`, nicht zu einem bereits veröffentlichten neuen Commit. Die Lieferung enthält Quellcode, Tests, Patch und ein Manifest zur eindeutigen Zuordnung.

Vor der endgültigen Browserfreigabe bleiben die Original-Reproduktion und die echten Läufe mit WebKit 26.5/27.2 offen. Die zusätzliche Canva-/Schul-iPad-Abnahme und alle im Restauftrag separat aufgeführten Erweiterungen bleiben eigenständige Folgeschritte. Es wurde keine solche Erweiterung begonnen.
