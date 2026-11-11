# MysteryBoard R1b – Korrektur- und Abnahmebericht

11. November 2026 (Europe/Berlin). Terminalprotokolle enthalten UTC-Zeiten.

## Ausgangsstand und Grenzen

Gearbeitet wurde auf dem **lokalen R1-Patch**, nicht ausschließlich auf dem alten GitHub-Stand. Der Branch bleibt `feat/mysteryboard-prototype`, Git-Basis ist `545ece1fd723b953e4b36456d37bd6210a5ac916`. Vor dem Eingriff stimmten `Board.tsx` und beide HTMLs bytegenau mit der letzten R1-Lieferung überein:

| Eingang | SHA-256 |
| --- | --- |
| `MysteryBoard-R1-545ece1.zip` | `695dd8e52b286dcf02fdbc0ddebb06a23941a0244752a00a117e7f59249b514c` |
| R1 `src/components/Board.tsx` | `a45e038eea587edfc21de213f4187864471b03da1d729af0af4f7cc6e9871b33` |
| R1 kleines HTML | `fd07c6e8eef52de43eb443a30da5832b2c8482678b6d15b335e38557459dc7e5` |
| R1 umfangreiches HTML | `e2639f956d0c413b03a7fce5afad44d0555ff0c196741e7a0ba8c8d4d3dbe95c` |

Die ursprüngliche R1-ZIP und deren entpackter Quellstand wurden für den Vergleich unverändert erhalten. R1b liegt als lokaler Arbeitsstand und separate Lieferung vor. **Kein neuer Commit, PR, Merge, Push oder Veröffentlichung.** Tor 3 wird hier nicht vorweggenommen.

## Reproduzierte Ursache

R1 erlaubte den Klick eines neuen Button-Tipps nur, wenn dessen Pointer-ID mit der Down-/Up-ID übereinstimmte. Ein `pointerdown/up` mit `touch:0` und ein anschließender `click` mit `mouse:1` wurden deshalb trotz neuem bewussten Tipp blockiert.

Vor der Quellcodeänderung wurden zwölf deterministische Replay-Fälle gegen die unveränderten R1-Produktions-HTMLs ausgeführt: jeweils Schließen, Verbindung löschen und Menü mit vier ID-/Typkombinationen. **Neun Fälle mit wechselnden IDs scheiterten erwartungsgemäß**, `defaultPrevented` war `true` und die gewollte Aktion blieb aus. Die **drei Kontrollfälle mit gleichen IDs bestanden**. Zusätzlich zur exakt berichteten Folge wurden `touch:17 → mouse:83` sowie `touch:17 → touch:83` geprüft; die Lösung ist nicht auf 0/1 zugeschnitten.

Der Replay läuft in Chromium und erzeugt synthetische Ereignisse (`isTrusted: false`). Er belegt den Fehlermechanismus und dessen Korrektur, **keinen echten WebKit-Lauf**. Die native Chromium-Touchprüfung ist separat protokolliert. In Ereignisprotokollen wird zwischen Zustand während des Dispatch und dem später abgefragten `dialogAfterSequence` unterschieden, da React Änderungen nach dem Ereignis übernehmen kann. `actions`/`actionCount`, tatsächlicher Dialogzustand und Verbindungsliste prüfen die gewollte Aktion.

Die im unabhängigen Auftrag beschriebenen 0/10 beziehen sich auf einen Abbruch beim ersten nicht schließbaren Dialog. Sie werden hier ausdrücklich nicht als zehn gescheiterte Kartenöffnungen interpretiert. Der ältere eigene Ohne-Klick-Vergleich gegen `545ece1` untersuchte einen anderen Fehlerpfad.

## Ereigniskorrektur

Nur `src/components/Board.tsx` wurde gegenüber R1 als Laufzeitquelle verändert, innerhalb der Ereignisbehandlung:

- Die vorhandene unmittelbare Board-Aktivierung bei `pointerup` bleibt erhalten.
- Eine vollständige neue Einfinger-/Mausfolge am selben noch vorhandenen Bedienelement erlaubt genau einen Klick. Der Klick darf eine andere ID und einen anderen Pointer-Typ tragen. Es gibt keine allgemeine Wartezeit und keine Ausnahme für bestimmte ID-Zahlen.
- Die bisherige dauerhafte `guarding`-Variable entfällt. Gespeichert werden die aktuellen Pointer, die Pointer der letzten Board-Geste und höchstens eine aktuelle Bediengeste. Der Klickschutz wirkt ausschließlich innerhalb des zugehörigen `<main>`, nicht auf fremde Dokumentelemente.
- Ohne vollständige neue Bediengeste bleibt der Folge-Klick der bereits verbrauchten Board-Aktion gesperrt. Erkennbar alte Pointer-Klicks der letzten Board-Geste können die Freigabe einer neuen gleichartigen Bediengeste nicht verbrauchen. IDs dienen hier lediglich zum Erkennen dieser bekannten alten Ereignisse, nicht als allgemeine Zulassungsbedingung.
- Bewegung ab 8 CSS-Pixeln, ein anderes Endziel, mehrere gleichzeitig aktive Pointer, Abbruch und Capture-Verlust verwerfen die vorgemerkte Bediengeste. Ein durch Neurendern ersetzter Button ist nicht derselbe gültige Empfänger. Normales implizites Capture-Ende nach `pointerup` darf den folgenden legitimen Klick erhalten.
- `touchcancel` verwirft ebenfalls eine ausstehende Auswahl bzw. Vorschau. Tastatur-/Assistenzaktivierung und die vorhandene programmatische Dateiauswahl bleiben möglich. Alle Listener werden beim Aushängen entfernt.

Eine zusätzliche kombinierte Gegenprobe zeigte während der Korrektur, dass Capture-Verlust nicht mit dem Anheben des Fingers gleichgesetzt werden darf: Ein zweiter Finger konnte sonst zu früh als Einfingertipp gelten. Die endgültige Erfassung hält den ersten Pointer bis Up/Cancel aktiv. Ein verspäteter Cancel eines bereits beendeten fremden Pointers darf umgekehrt keine neue gültige Bediengeste verwerfen. Der neue Test deckt beide Fälle ab; das erwartete Scheitern vor dieser Präzisierung ist in `capture-before.txt` erhalten.

Im anschließenden Zwischenlauf wurde außerdem eine falsche Startannahme des neuen Tests korrigiert: Karte 1 ist bereits grün. Die Gegenprobe verwendet deshalb Blau und prüft vor wie nach der verworfenen Aktion den unveränderten Zustand. Dieser reine Testfehler ist in `check-capture-test-fixture-error.txt` dokumentiert; `capture-after.txt` enthält den erfolgreichen gezielten Lauf. Keine bestehenden Prüfungen wurden dafür geändert oder entfernt.

Datenmodell, IDs, PNG/QR, Undo/Redo, Export, Inhaltsdaten, CSS/Layout, Dialog- und App-Komponente, Build-/Playwright-Konfiguration und Abhängigkeiten bleiben gegenüber R1 unverändert. Alle bestehenden Testdateien einschließlich `r1.spec.ts` bleiben byteidentisch. Der Nachweis steht in `test-evidence/r1b/source-scope.json`; der isolierte Quellcode-Diff R1 → R1b liegt daneben.

## Prüfungen

**Abschließendes Ergebnis: 31/31 Datentests, Typprüfung und beide Produktionsbuilds sowie 71/71 Chromium-Browsertests bestanden.** Alle bisherigen 43 Browsertests bleiben enthalten, ergänzt um 28 R1b-Tests. Im abschließenden Lauf: keine übersprungenen oder fehlgeschlagenen Tests und keine Playwright-Retries. Die vorhandenen Tests wurden weder entfernt noch deaktiviert. Node v24.22.1, Playwright 1.65.0, Chromium 156.0.8078.79; Browserlauf 156.9 Sekunden. In allen 28 neuen Tests und beiden frischen Importsitzungen: keine Browserkonsolenwarnung, kein Konsolenfehler und kein `pageerror`. Der Build prüft die Dateigröße; die Offline- und Sicherungsregressionen einschließlich QR, PNG-Grenzen, Bildproportionen und History bestehen.

Die neuen Tests stehen in `tests/browser/r1b.spec.ts` und umfassen:

1. Zwölf ID-Replay-Kombinationen mit Schließen, Löschen und Menü, Ereignisparametern, `defaultPrevented`, Aktionszahl und Zustand nach der Aktion.
2. Zehn native Ziel-/Schließen-Folgen über beide Produktions-HTMLs: Kartenkörper, Nummern und sichtbare Labels. Alle Schließen-Aktionen erfolgen mit `.tap()`, ohne Escape, Maus oder sonstige Ersatzbedienung. Dies ist das eigene Referenzset; das fehlende Originalskript wird dadurch nicht ersetzt.
3. Sechs 450-ms-Gegenproben: PointerEvent- und klassische MouseEvent-Klicks auf Schließen, Übernehmen und Löschen ohne neue Down-/Up-Folge bleiben wirkungslos. Der folgende bewusste Fingertipp funktioniert.
4. Button-Bewegung, versetztes Loslassen, anderes Endziel, Pointer-/Touch-Abbruch, Capture-Verlust, Mehrfingerfolgen, ersetzte Buttons sowie Begrenzung auf die Anwendung. Der nächste gültige Tipp muss jeweils wieder funktionieren.
5. Board-Touch-Abbruch und anschließender Tipp ohne `click`, genau eine Dialogöffnung. Maus, Enter/Leertaste aus der unveränderten R1-Suite sowie Escape und Fokus-Rückgabe werden bestätigt.
6. Beide Arbeitsabläufe mit 12/9 und 60/90: Beginn, unveränderter Original-PNG-Rundlauf, Kartenfarbe, Erstellen 1–3, gezieltes Bearbeiten/Löschen des sichtbaren 1–2-Labels, Undo/Redo, Menü, Sicherungsbild, Download, neue Sitzung, Dateiauswahl, Wiederherstellung, Weiterbearbeitung und erneute Sicherung. Vollständige Zustände werden verglichen; beide Sitzungen arbeiten nach dem HTML-Laden offline und dürfen keine zusätzliche HTTP(S)-Anfrage senden.
7. Acht überlagerte Kreuzungslabels des 220er-Boards einschließlich fingerbedientem Schließen, Bearbeiten, gezieltem Löschen und Rückgängig. Nur die ausgewählte Verbindung darf verschwinden.
8. Der unveränderte Original-Grenzstand `Start-ID-1000000.png` wird ohne Bearbeitung gesichert und vollständig wieder eingelesen. Die bestehenden Tests prüfen zusätzlich das weitere Erstellen/Löschen an der ID-Grenze.
9. Capture-Verlust mit weiterhin gehaltenem ersten Finger und neuem zweiten Finger erzeugt keine Buttonaktion; ein später eintreffender fremder Abbruch blockiert keinen nachfolgenden bewussten Tipp.

**Automatisierungsgrenze des Arbeitsablaufs:** Alle Boardziele, Farben, Toolbar-/Dialogbuttons und Downloadlinks werden mit nativen Touch-Eingaben bedient. Text wird nach Antippen mit `fill` eingegeben, der native Richtungs-Selektor mit `selectOption` gesetzt; die Dateiauswahl wird nach fingerbedientem Öffnen technisch befüllt. Damit werden insbesondere keine Schließen-/Löschen-/Übernehmen-Aktionen durch Maus oder Tastatur umgangen. Die Bedienung von Bildschirmtastatur und nativem Auswahlmenü auf einem echten iPad bleibt Teil der Geräteabnahme.

## Befehle und Protokolle

Arbeitsverzeichnis `/workspace/Vorlage-Mysteryboard`. Die Protokolle in `test-evidence/r1b/` enthalten die tatsächlichen Ausgaben; `results.json` listet die Einzelergebnisse, `event-traces.json` die angehängten Ereignisfolgen. Die ZIP enthält außerdem den vollständigen Playwright-HTML-Bericht und die PNG-Prüfartefakte. Browserkonsolenwarnungen/-fehler und `pageerror` werden in allen R1b-Tests und beiden frischen Importsitzungen gesammelt und geprüft. Node-Hinweise zu `NO_COLOR`/`FORCE_COLOR` und npm-Updates in Terminalprotokollen sind davon getrennt.

```sh
# Vor der Korrektur: zwölf Replay-Fälle auf der damaligen unveränderten R1-HTML.
set -o pipefail
npx playwright test tests/browser/r1b.spec.ts --grep Replay 2>&1 | tee /workspace/mysteryboard-r1b-evidence/baseline-replay.txt

# Nach der ersten Korrektur: Build, zwölf Replay-Fälle und zehn R1-Fälle.
npm run build 2>&1 | tee /workspace/mysteryboard-r1b-evidence/build.txt
npx playwright test tests/browser/r1b.spec.ts tests/browser/r1.spec.ts 2>&1 | tee /workspace/mysteryboard-r1b-evidence/replay-and-r1.txt

# Erweiterte gezielte Prüfung.
npx tsc --noEmit
npm run build:review
npx playwright test tests/browser/r1b.spec.ts 2>&1 | tee /workspace/mysteryboard-r1b-evidence/targeted.txt

# Abschließender vollständiger Lauf: Daten, Typen, beide HTMLs, 220er-Build, alle Browserprüfungen.
# Der erste Gesamtlauf mit 70 Fällen steht in check-before-capture-review.txt.
# Die danach ergänzte Gegenprobe scheiterte zunächst am ersten Teilschritt:
npx playwright test tests/browser/r1b.spec.ts --grep 'Capture-Verlust beendet' 2>&1 | tee /workspace/mysteryboard-r1b-evidence/capture-before.txt
# Der erfolgreiche gezielte Nachlauf steht in capture-after.txt:
npx playwright test tests/browser/r1b.spec.ts --grep 'Capture-Verlust beendet' 2>&1 | tee /workspace/mysteryboard-r1b-evidence/capture-after.txt
# Nach der Präzisierung erneut vollständig geprüft:
npm run check 2>&1 | tee /workspace/mysteryboard-r1b-evidence/check.txt

sha256sum artifacts/MysteryBoard-klein.html artifacts/MysteryBoard-umfangreich.html
wc -c artifacts/MysteryBoard-klein.html artifacts/MysteryBoard-umfangreich.html
git diff --check
```

Zusätzliche Engine-Prüfung (gescheitert, nicht als Erfolg gewertet):

```sh
PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright npx playwright install webkit
PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright node --input-type=module - <<'JS'
import { webkit } from 'playwright';
try {
  const browser = await webkit.launch();
  console.log('Actual WebKit version:', browser.version());
  await browser.close();
} catch(error) {
  console.error(error.message);
  process.exitCode = 1;
}
JS

# Erst nach Bereitstellung einer passenden Engine ausführbar; hier NICHT erfolgreich gelaufen:
MB_ENGINE=webkit PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright \
  npx playwright test tests/browser/r1b.spec.ts
```

## Produktions-HTMLs

| Datei | Bytes | SHA-256 |
| --- | ---: | --- |
| `MysteryBoard-klein.html` | 452240 | `8860323ddd590fcd5b53e20faadbb3a59b86ac31863fd40adfde0e9c40e299aa` |
| `MysteryBoard-umfangreich.html` | 485126 | `86227c13eaef7b87495b4e438afbbc2ee2467b8b316102c53aaefbf172014190` |

Beide liegen unter **10.000.000 Bytes**. Der unveränderte Build erzeugt sie aus dem korrigierten Quellstand. Die Lieferung enthält ein Manifest mit Quellstand, Patch, Größen und SHA-256. Es gibt noch keine neue Commit-ID; die Dateien gehören zu R1b auf Basis `545ece1` plus lokalem R1-Patch. Die ältere GitHub-HTML `545ece1` ist nicht die korrigierte Lieferung.

## Offene Abnahmen und nächster Schritt

| Prüfung | Nachweis / Grenze |
| --- | --- |
| Chromium | Nativ geprüfte Produktions-HTMLs; Version und Einzelergebnisse in `results.json`. |
| WebKit 26.5 / Playwright 1.62.1 / Revision 2370 | Keine passende Engine installiert. Reale Kompatibilitätsprüfung **offen**. |
| WebKit 27.2 / Playwright 1.65.0 / Revision 2388 | Offizieller Download erneut HTTP 403 „Domain forbidden“; Startversuch meldet fehlende `pw_run.sh`. Reale Prüfung **offen**. |
| Unverändertes `Touch-Vergleich.cjs` | `MysteryBoard-Abnahme-545ece1.zip` samt Originalskript und WebKit-Traces wurde nicht mitgeliefert und ist im Arbeitsbereich nicht vorhanden. Originalprüfung **offen**, keine stillschweigende Änderung oder Ersatz-Erfolgsmeldung. |
| Canva / echter Schülerlink | Nicht ausgeführt; erst nach Freigabe. |
| Zwei verwaltete Schul-iPads | Nicht ausgeführt; Browser-Replay und Chromium-Touch ersetzen diese Abnahme nicht. |

Tor 1 ist bezüglich der fehlenden WebKit-Nachweise **vorläufig**. Als nächster abhängiger Schritt bleibt die gezielte unabhängige Work-Schlussprüfung des R1b-Ereignispfads gemäß Tor 2. Versionierung/PR benötigen die anschließende ausdrückliche Freigabe. Canva/Host, echte Schul-iPads und didaktischer Pilot folgen getrennt. **Keine schulische Freigabe.** Es wurden keine zusätzlichen Funktionen begonnen.
