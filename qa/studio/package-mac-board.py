"""Package only the verified app DMG and the acceptance evidence."""
from pathlib import Path
import hashlib
import json
import os
import re
import shutil
import sys
import tempfile
import zipfile

source, delivery = (Path(value).resolve() for value in sys.argv[1:])
delivery.mkdir(parents=True, exist_ok=True)
base = "39ff7853293b49c4aba180b49cf5331e26df96e7"
commit = os.environ["GITHUB_SHA"]
workflow = f'{os.environ["GITHUB_SERVER_URL"]}/{os.environ["GITHUB_REPOSITORY"]}/actions/runs/{os.environ["GITHUB_RUN_ID"]}'
prefix = "MysteryBoard-Studio-0.2.1"
dmg_name = prefix + "-Mac-Apple-Silicon.dmg"

def find(name):
    path, = source.rglob(name)
    return path

def sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()

native = json.loads(find("Mac-Pinnwand-Tests.json").read_text())
student = json.loads(find("Mac-Starthilfe-SCORM.json").read_text())
existing = json.loads(find("native-macos.json").read_text())
assert native["passed"] and student["passed"] and existing["passed"]
assert student["actualStudio020PngRestoredInNewPlayer"]
assert native["sourceCommit"] == commit == existing["sourceCommit"]
assert native["electron"]["version"] == existing["appVersion"] == "0.2.1"
assert native["electron"]["isPackaged"] and native["arch"] == "arm64"
motions = sum(m["kind"] == "stress" for p in native["projects"] for m in p["motions"])
assert motions >= 100 and [p["cards"] for p in native["projects"]] == [5, 12, 20, 60]
for project in native["projects"]:
    for motion in project["motions"]:
        assert motion["expected"] == motion["actual"]
logs = [find(f"Chromium-{part}.log") for part in range(1, 5)]
counts = [int(re.findall(r"(\d+) passed", p.read_text())[-1]) for p in logs]
assert sum(counts) == 272, counts
data_count = int(re.search(r"Tests\s+(\d+) passed", find("Daten.log").read_text())[1])
assert data_count >= 181
assert re.search(r"\b4 passed", find("RC2.log").read_text())
checks = len(existing["checks"])
dmg = find(dmg_name)
with dmg.open("rb") as stream:
    stream.seek(-512, 2)
    assert stream.read(4) == b"koly"

with tempfile.TemporaryDirectory() as temporary:
    root = Path(temporary) / prefix
    root.mkdir()
    report = root / "Pruefbericht"
    report.mkdir()
    for path in [
        find("Mac-Pinnwand-Tests.json"), find("Mac-Starthilfe-SCORM.json"),
        find("native-macos.json"), find("Autorenpinnwand-Pfeile.png"),
        find("Export-Starthilfen.png"), find("Schuelerplayer-Starthilfe.png"),
        find("Pfeil-waehrend-Ziehen.png"), find("Vorher-Nachher.log"),
        find("Starthilfe-SCORM.zip"), find("Schuelerarbeit-Original.png"),
        find("Autor-mit-Pfeilen.mysteryboard"),
        find("Daten.log"), find("RC2.log"), find("DMG.log"), find("Pinnwand.log"),
        find("Schuelerplayer.log"), find("Mac-Regression.log"), find("Signatur.log"),
        *logs,
    ]:
        shutil.copy2(path, report / path.name)
    shutil.copy2("qa/studio/evidence/board-before.json", report / "Vorher.json")
    shutil.copy2(dmg, root / dmg_name)
    (report / "ABNAHME.md").write_text(f"""# MysteryBoard Studio 0.2.1 für Apple Silicon

Ausgangscommit `{base}`. Getesteter Commit `{commit}`.
[GitHub-Actions-Lauf]({workflow})

## Kartenbewegung

Auf 0.2.0 blieb eine Karte trotz versetztem pointerup ohne pointermove bei [0, 0].
In dieser Reproduktion erwartete der Test [110,88, 58,84]. Das pointerup
berücksichtigte den gemessenen Abstand für die Tap-Erkennung, übernahm aber
ausschließlich zuvor gemeldete Bewegungen. Die Autorenpinnwand gab außerdem
bei Rendern neue Arbeitsobjekte zurück, was eine aktive Geste abbrechen konnte.
Reine Positionsänderungen erhöhten die Version der Schüleraufgabe.

0.2.1 berücksichtigt den gemessenen letzten Punkt bei der Autorenbewegung,
erhält gültige Gesten bei Rendern und übernimmt den Autorenzustand getrennt vom
Inhalt. Cancel und vorzeitiger Verlust des Pointer-Capture verwerfen die Geste.
Die installierte App bestand {motions} deterministische Bewegungen bei 5, 12,
20 und 60 Karten sowie langsame und schnelle Mausbewegungen, Rand, Zoom,
Fensteränderung und Neustart. Soll- und Ist-Koordinaten stehen im JSON-Protokoll.
Die ursprünglichen Inhaltsprüfsummen der Testprojekte blieben erhalten.

## Pfeile und Unterricht

Neue Verbindungen bleiben zunächst im Projekt. Die Freigabe als Starthilfe
ist pro Pfeil auswählbar. Im Exportdialog werden die mitgelieferten
Starthilfen angezeigt. Ausgeblendete Karten werden bei der Ausgabe samt ihren
Pfeilen herausgefiltert. Veröffentlichte Starthilfen erscheinen im Schülerplayer
und sind dort wie eigene Pfeile bearbeitbar und löschbar. Der SCORM-Test prüft
einen tatsächlichen Export, Richtungswechsel, Änderung, Löschen, Undo/Redo
und Wiederherstellung der PNG in einer neuen Sitzung.

Die neue Version liest bisherige Mystery-Dateien und Schülerarbeitsstände.
Eine echte Schüler-PNG aus der Abnahme von 0.2.0 wurde in einem neu erzeugten
Schülerplayer geöffnet und mit ihren ursprünglichen Koordinaten verglichen.
Alte Player oder Apps kennen die neue Starthilfe-Eigenschaft und die internen
Projektpfeile noch nicht. Für neue Aufgaben mit Starthilfen den mitgelieferten
aktuellen Schülerplayer exportieren. Änderungen am veröffentlichten Inhalt
erhöhen weiterhin die Inhaltsversion.

## Testnachweise

- `npm test` ergab {data_count} bestandene Datentests.
- `npm run build` bestätigte TypeScript und den HTML-Build.
- `npm run test:e2e -- --shard=N/4` ergab insgesamt {sum(counts)} bestandene Browserprüfungen mit Chrome for Testing 156.0.8078.80. Die Prüfungen verwenden die Chromium-Generation der App. Im Vorlauf verhielt sich die CDP-Touch-Simulation beim Viewport-Wechsel unter Chromium 158 anders.
- `npm run test:rc2` ergab 4 bestandene Prüfungen des eingefrorenen Unterrichtsstands.
- `npm run studio:make -- --platform=darwin --arch=arm64` erzeugte die DMG.
- `hdiutil verify`, Mount, Installation mit `ditto` und `codesign --verify --deep --strict` bestanden.
- `node qa/studio/mac-board-native.mjs` und `node qa/studio/mac-board-player.mjs` bestanden.
- `npm run studio:test` ergab {checks} bestehende native Prüfpunkte.

Der native Lauf lief auf einem macOS-ARM64-Runner mit installierter und
gestarteter App. Er nutzte automatisierte Maus- und Wheel-Eingaben und gezielt
eingespeiste Pointer-Ereignisse. Ein manueller Trackpad-Test auf einem physischen
Mac und ein echter itslearning-Kursstart bleiben offen. Die App ist ad hoc
signiert. Eine Apple-Notarisierung liegt nicht vor.
""", encoding="utf8")
    files = sorted(p for p in root.rglob("*") if p.is_file())
    (root / "SHA256SUMS.txt").write_text("".join(
        f"{sha(p)}  {p.relative_to(root).as_posix()}\n" for p in files
    ), encoding="utf8")
    complete = delivery / (prefix + "-Mac-Apple-Silicon-KOMPLETTPAKET.zip")
    review = delivery / (prefix + "-Sichtpruefung.zip")
    for archive, include in [(complete, lambda p: True), (review, lambda p: p.parent == report)]:
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=4) as package:
            for p in sorted(root.rglob("*")):
                if include(p) and p.is_file():
                    package.write(p, p.relative_to(root.parent).as_posix())
        with zipfile.ZipFile(archive) as package:
            assert package.testzip() is None
    meta = {"sourceCommit": commit, "baseCommit": base, "workflow": workflow,
            "files": [{"file": p.name, "bytes": p.stat().st_size, "sha256": sha(p)} for p in [complete, review, dmg]]}
    (delivery / "Downloads.json").write_text(json.dumps(meta, indent=2)+"\n", encoding="utf8")
