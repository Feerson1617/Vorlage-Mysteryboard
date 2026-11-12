# Prüf- und Sicherungsbefehle dieser Runde

12. November 2026, Europe/Berlin; die Rohprotokolle verwenden UTC. Bestehende Cloud-Umgebung und dasselbe Git-Repository. Keine neue Installation, keine neue Laufzeitabhängigkeit, keine Veröffentlichung.

## Phase A – unveränderte Unterrichtsversion

Arbeitsverzeichnis `/workspace/Vorlage-Mysteryboard`:

```sh
git status --short
git log -3 --oneline
git ls-remote --heads --tags origin
gh pr list --repo Feerson1617/Vorlage-Mysteryboard --state open --json number,title,headRefName,baseRefName,url
gh api repos/Feerson1617/Vorlage-Mysteryboard/pages
git tag -a unterricht-2026-11-13-rc1 240d5fcfcac7e5924efe169493c9f7525ba5ed74 -m 'Frozen classroom candidate for 13 November 2026; source 240d5fc; publication and managed-iPad acceptance remain pending'
git push origin refs/tags/unterricht-2026-11-13-rc1
set -o pipefail
npm run check 2>&1 | tee /workspace/mysteryboard-nov13-evidence/phase-a-check.txt
```

Branch/HEAD und tatsächlicher Remote-Branch: `feat/mysteryboard-prototype`, `240d5fcfcac7e5924efe169493c9f7525ba5ed74`. Checkout sauber. Tag-Push erfolgreich, Remote-Tag und Zielcommit geprüft. `main`: `1fa1fff81e5e19b7031130c8d034a77d9e1ace61`. Beide API-Abfragen scheiterten mit `Forbidden`; vorhandene PRs und Pages-Einstellungen daher nicht als bekannt ausgegeben.

`npm run check`: Exitcode 0, **50 Datentests und 96 Chromiumtests**, keine ausgelassenen, instabilen oder fehlgeschlagenen Tests. Alle drei frisch erzeugten Produktions-HTMLs stimmen bytegenau mit dem eingefrorenen Commit überein.

Zusätzlicher gezielter Produktionsdateitest, jeweils mit `--source-commit 240d5fcfcac7e5924efe169493c9f7525ba5ed74 --html-dir artifacts`:

```sh
node scripts/work-compatibility.mjs --engine chromium --executable /usr/bin/chromium --html-dir artifacts --source-commit 240d5fcfcac7e5924efe169493c9f7525ba5ed74 --port 5177 --output /workspace/mysteryboard-nov13-evidence/stable-work-chromium
node scripts/work-compatibility.mjs --engine chromium --executable /usr/bin/chromium --html-dir artifacts --source-commit 240d5fcfcac7e5924efe169493c9f7525ba5ed74 --port 5177 --output /workspace/mysteryboard-nov13-evidence/stable-work-chromium-serial
```

Der erste parallele Lauf hatte beim kleinen Mystery einen 15-Sekunden-Timeout beim nativen Beginnen-Tipp, die anderen zwei Varianten bestanden. Rohfehler und Ressourcenbefund sind aufbewahrt. Der unveränderte serielle Wiederholungslauf besteht für alle drei HTMLs. Eine konkrete Ursache des ersten Timeouts ist nicht bewiesen. Skript, HTMLs und Timeouts wurden dafür nicht geändert.

Beide angeforderten WebKit-Versionen wurden mit demselben Skript und `--engine webkit --expected-version 26.5` bzw. `27.2`, eigenen Ausgabeordnern und getrennten Ports versucht. Beide scheiterten vor Browserstart mit fehlender `webkit-2388/pw_run.sh`; keine tatsächliche WebKit-Version ausgeführt. Exakte Aufruf-/Fehlerbelege stehen in den `stable-work-webkit-*`-Protokollen und `stable-focused-acceptance-summary.json`.

## Phasen B/C – getrennte Vorbereitung und Entwicklung

```sh
git worktree add -b feat/mysteryboard-print-pdf /workspace/Mysteryboard-print 240d5fcfcac7e5924efe169493c9f7525ba5ed74
```

Der neue Worktree gehört zum bestehenden Repository. Die vorhandenen `node_modules` wurden lokal wiederverwendet; kein neues Paket installiert. Die fachlichen Inhalte und alle bisherigen Tests blieben byteidentisch. Vergleich: `source-scope.json`.

Im Print-Worktree:

```sh
node scripts/prepare-classroom-pages.mjs
git worktree add --orphan -b pages-unterricht-2026-11-13 /workspace/Mysteryboard-unterricht-pages
cp dist/unterricht-pages/index.html dist/unterricht-pages/.nojekyll dist/unterricht-pages/manifest.json /workspace/Mysteryboard-unterricht-pages/
git -C /workspace/Mysteryboard-unterricht-pages add index.html .nojekyll manifest.json
git -C /workspace/Mysteryboard-unterricht-pages commit -m 'Prepare frozen classroom Pages candidate for 2026-11-13 (not deployed)'
git bundle create /workspace/mysteryboard-nov13-evidence/pages-unterricht-2026-11-13.bundle refs/heads/pages-unterricht-2026-11-13
git bundle verify /workspace/mysteryboard-nov13-evidence/pages-unterricht-2026-11-13.bundle
```

Lokaler Pages-Commit `0a1536e1121e4cbb6f8501c120a9ae36af821346`, genau drei statische Dateien; index.html entspricht der eingefrorenen Boden-HTML. **Kein Push dieses Branches, keine Pages-Einstellung und kein Deployment.** Das Bundle bewahrt diese lokale Git-Referenz; es enthält keine neue Anwendung.

## Entwicklung und gezielte Fehlernachweise

```sh
npx tsc --noEmit
npm run build
node scripts/build.mjs --tests
PRINT_EXAMPLES_DIR=/workspace/mysteryboard-nov13-evidence/print-examples npx playwright test tests/browser/print.spec.ts
npx vitest run tests/build-notices.test.ts
npx vitest run tests/build-notices.test.ts tests/limits.test.ts
npx playwright test tests/browser/print-lifecycle.spec.ts
git diff --check
```

- Erster Produktionsdrucktest: Die Startseite blieb wegen ungültigem JavaScript leer. `node --check` auf dem extrahierten Modul zeigte hineingeschriebene Backticks aus Lizenzhinweisen. Der Build hatte das erste innere `</html>` im neuen Drucktemplate ersetzt. Kontrollierter Abbruch des Diagnoselaufs: ein unterbrochener Fall, acht noch nicht ausgeführt. Keine Tests entfernt; der korrigierte Lauf führt alle neun aus.
- Korrektur: Lizenzhinweise ausschließlich am äußeren Dokumentende ergänzen; zwei neue Regressionstests erhalten ausführbares JavaScript mit innerem Druck-HTML und prüfen fehlerhaften Dokumentabschluss. Eine TypeScript-Deklaration für die bestehende MJS-Buildschnittstelle hält den Test typisiert. Ein vorübergehender JS-Testdateiversuch wurde von der TS-Testauswahl nicht gefunden; die endgültige TS-Datei wird regulär ausgeführt.
- Ein erster Gesamtlauf stoppte bei **51/52** Datentests, weil die neue Abschlussvalidierung bei der bestehenden absichtlich ungültigen 10-MB-Datei die bisherige Größenmeldung überholte. Korrigiert durch frühe Rohgrößenprüfung plus weiterhin abschließende Endgrößenprüfung. Der bestehende Grenztest bleibt unverändert. Gezielte sechs Build-/Grenztests anschließend bestanden.
- Neun gezielte Drucktests vollständig bestanden: zwölf, achtzehn, sechzig Karten, 220 Verbindungen, fünf neutrale Karten, A3/Zoom, Extremtexte in A4/A3 und Legacy-Namenspflicht. Echte PDF-Erzeugung und PDF-Textprüfung mit den vorhandenen `pdfinfo`/`pdftotext`-Werkzeugen.
- Ein zusätzlicher Lebenszyklustest bestanden: durch klar bezeichnete zeitliche Fehlerinjektion A4/A3-Wechsel und Abbruch nachweislich während laufender Vorbereitung, erneute vollständige Vorschau, keine verwaisten Frames, unveränderte PNG/History/dirty. Keine Abschwächung der App oder ihrer Touchschutzregeln.
- Vermutete externe Fragmentnavigation wurde durch echte Verweistipps und Prüfung interner PDF-Ziele widerlegt; kein unnötiger Base-URL-Eingriff. Übersichtsbilder wurden mit dem vorhandenen `fitImage` auch für SVGs ohne `viewBox` proportional eingepasst. Linkunterstreichung bleibt auf lesbare Detailverweise beschränkt.

## Phase E – endgültige vollständige Prüfung

```sh
set -o pipefail
PRINT_EXAMPLES_DIR=/workspace/mysteryboard-nov13-evidence/print-examples-final npm run check 2>&1 | tee /workspace/mysteryboard-nov13-evidence/phase-e-check.txt
```

Dieser Befehl führt `vitest run`, TypeScript, alle drei Produktions-Builds, beide Prüf-Builds und die komplette Chromium-Suite aus. Endgültiges Ergebnis, Browser-Version, Commit-/Build-Zuordnung und PDF-Prüfsummen stehen im Abschlussmanifest und Bericht. Frühere Fehlerprotokolle bleiben getrennt erhalten. Die visuellen Prüfungen verwenden zusätzlich tatsächlich aus den PDF-Dateien gerasterte Seiten (`fitz`), nicht ausschließlich die DOM-Vorschau. Kein echter Schul-iPad-/Canva-Test wird daraus abgeleitet.

Der vollständige Aufruf endete mit Exitcode 1: **52/52 Datentests, Build erfolgreich, 105/106 Browsertests**. Im unveränderten Fall „M1 220 Original-Verbindungen: sichtbare Kreuzungslabels (Touch)“ überschritt die Prüfung nach dem PNG-Import im frischen Browserkontext ihr vorhandenes 8-Sekunden-Limit. Der anschließend aufgenommene Screenshot des frischen Kontexts zeigt den geladenen 60-/220-Stand mit Teamangabe, deaktivierter History und ohne Dialog. Die konkrete Verzögerungsursache ist ohne Zeittrace nicht bewiesen; Ressourcenkonkurrenz wird nicht als festgestellte Ursache ausgegeben. Das parallel aufgenommene Exportfenster gehört zum ursprünglichen Kontext. Fehler, beide Screenshots und vollständiger HTML-Bericht sind in `phase-e-first-*` erhalten.

Ohne Änderungen an Anwendung, Tests oder Timeouts folgten:

```sh
npx playwright test tests/browser/review.spec.ts --grep 'M1 220 Original-Verbindungen' --workers=1 --repeat-each=2
node /workspace/mysteryboard-nov13-evidence/capture-print-ui.mjs
set -o pipefail
npx playwright test 2>&1 | tee /workspace/mysteryboard-nov13-evidence/phase-e-browser-final.txt
```

Gezielte Wiederholung: **4/4 bestanden**, zweimal Maus, zweimal Touch einschließlich vollständigem Export/Import und erneutem Export. Zusätzliche UI-Aufnahme: Chromium 156.0.8078.79, 1024 × 768, native Touch-Eingaben, nach Laden offline, fünf Boden-Druckseiten, null zusätzliche Netzwerkanfragen/JavaScriptfehler. Arbeitsfläche, Menü und Druckvorschau wurden visuell geprüft. Die Vorschau darf horizontal scrollen; der gedruckte Inhalt wurde getrennt auf echte Papiergrenzen geprüft. Kein realer Gruppenversuch oder systemeigener Druckdialog wurde dabei simuliert oder als durchgeführt ausgegeben.

Der erneute vollständige Browserlauf verwendet unverändert die bereits gebauten und geprüften HTMLs. Die acht tatsächlichen PDF-Beispiele stammen aus den erfolgreichen Druckfällen des vorherigen Gesamtlaufs; sie werden durch diesen Browserlauf nicht neu erzeugt. Ihr Inhalt und ihre Prüfsummen bleiben damit eindeutig zugeordnet. Sein endgültiges Ergebnis steht in `phase-e-results.json`.

Endgültiger unveränderter Browserlauf: **106/106 bestanden, Exitcode 0, 12,9 Minuten**, keine übersprungenen oder im Lauf wiederholten Fälle. Zusammen mit den 52 bereits bestandenen Datentests, TypeScript und fünf erfolgreichen Builds sind alle aktuellen Prüfungen bestanden. Der erste Gesamtaufruf mit Exitcode 1 bleibt unverändert dokumentiert.
