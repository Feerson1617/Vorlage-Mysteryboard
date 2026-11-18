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
version = os.environ.get("STUDIO_PACKAGE_VERSION", "0.2.2")
base = {
    "0.2.2": "51e0ab7b113acf2262c5bcabe440ccf51345d7b1",
    "0.2.3": "e5cfa0dce1e96524955921ea130a6777a7c8136f",
}[version]
commit = os.environ.get("STUDIO_ACCEPTANCE_COMMIT", os.environ["GITHUB_SHA"])
run_id = os.environ.get("STUDIO_ACCEPTANCE_RUN_ID", os.environ["GITHUB_RUN_ID"])
workflow = f'{os.environ["GITHUB_SERVER_URL"]}/{os.environ["GITHUB_REPOSITORY"]}/actions/runs/{run_id}'
prefix = f"MysteryBoard-Studio-{version}"
dmg_name = prefix + "-Mac-Apple-Silicon.dmg"

def find(name):
    path, = source.rglob(name)
    return path

def sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()

def plain_log(path):
    return re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", path.read_text())

native = json.loads(find("Mac-Pinnwand-Tests.json").read_text())
student = json.loads(find("Mac-Starthilfe-SCORM.json").read_text())
existing = json.loads(find("native-macos.json").read_text())
assert native["passed"] and student["passed"] and existing["passed"]
assert student["actualStudio020PngRestoredInNewPlayer"] and student["actualStudio021PngRestoredInNewPlayer"]
assert student["confirmedTaskPngMatchesScorm"]
assert all(native["publication"][key] for key in (
    "blockedWithoutConfirmation", "newConfirmationAfterEdit",
    "saveWithoutConfirmation", "previewMatchesScorm", "hiddenCardsMatchRealExport",
))
stress_paths = [find(f"Schueler-Stress-{engine}.json") for engine in ("chromium", "webkit")]
stress = [json.loads(p.read_text()) for p in stress_paths]
assert len(stress[0]["cdpDrags"]) == 24
assert all(move["target"] == move["actual"] for move in stress[0]["cdpDrags"])
for result in stress:
    assert result["passed"] and len(result["motions"]) == 100 and result["externalRequests"] == []
    assert {move["count"] for move in result["motions"]} == {5, 12, 20, 60}
    assert {move["type"] for move in result["motions"]} == {"mouse", "touch"}
    assert all(move["target"] == move["actual"] for move in result["motions"])
before_file, = (p for p in source.rglob("release-only.json") if p.parent.name == "before")
after_file, = (p for p in source.rglob("release-only.json") if p.parent.name == "after")
before = json.loads(before_file.read_text())
after = json.loads(after_file.read_text())
assert all(m["before"] == m["actual"] != m["target"] for m in before["results"])
assert all(m["before"] != m["actual"] == m["target"] for m in after["results"])
assert native["sourceCommit"] == commit == existing["sourceCommit"]
assert native["electron"]["version"] == existing["appVersion"] == version
assert native["electron"]["isPackaged"] and native["arch"] == "arm64"
motions = sum(m["kind"] == "stress" for p in native["projects"] for m in p["motions"])
assert motions >= 100 and [p["cards"] for p in native["projects"]] == [5, 12, 20, 60]
for project in native["projects"]:
    for motion in project["motions"]:
        assert motion["expected"] == motion["actual"]
logs = [find(f"Chromium-{part}.log") for part in range(1, 5)]
counts = [int(re.findall(r"(\d+) passed", plain_log(p))[-1]) for p in logs]
assert sum(counts) == 272, counts
data_count = int(re.search(r"Tests\s+(\d+) passed", plain_log(find("Daten.log")))[1])
assert data_count >= (187 if version == "0.2.3" else 184)
assert re.search(r"\b4 passed", plain_log(find("RC2.log")))
checks = len(existing["checks"])
dmg = find(dmg_name)
with dmg.open("rb") as stream:
    stream.seek(-512, 2)
    assert stream.read(4) == b"koly"

editor_report = ""
editor_paths = []
if version == "0.2.3":
    before_editor = json.loads(find("Editor-Vorher.json").read_text())
    after_editor = json.loads(find("Editor-Nachher.json").read_text())
    assert all(result["native"] and result["passed"] and result["arch"] == "arm64" for result in (before_editor, after_editor))
    assert before_editor["app"]["version"] == "0.2.2" and after_editor["app"]["version"] == version
    assert after_editor["proposals"] == 7 and after_editor["published"] == 5
    assert after_editor["external"] == [] and after_editor["legacy022ProjectAndPng"]
    assert after_editor["taskPngMatchesScorm"]
    before_sizes = {(case["n"], case["w"], case["h"]): case["boardHeight"] for case in before_editor["cases"]}
    assert len(before_sizes) == len(after_editor["cases"]) == 15
    gains = [case["boardHeight"] - before_sizes[(case["n"], case["w"], case["h"])] for case in after_editor["cases"] if case["w"] == 1280]
    assert len(gains) == 5 and min(gains) >= 50, gains
    assert all(case["visible"] == case["n"] for case in after_editor["cases"])
    editor_paths = [*source.rglob("Vorher-*.png"), *source.rglob("Nachher-*.png"), *source.rglob("Uebernommene-Bildkarte.*")]
    editor_paths += [find(name) for name in (
        "Editor-Nachher.json", "Editor-Vorher.json", "Fokus-31.png", "PDF-Bildkarte.png",
        "SCORM-Schueleransicht.png", "SCORM-Bildkarte.png", "Schueler-Vorschau.png",
        "Editor.log", "Editor-Vorher.log", "Gestaltete-Aufgabe-SCORM.zip",
    )]
    editor_report = f"""
## Lehrkräfteeditor und PDF-Import

Der Vergleich auf dem Mac-Runner verwendet dieselben Projekte mit 5, 12, 20, 31
und 60 Karten bei 1280 × 820, 1000 × 720 und 800 × 620. Im breiten Fenster
gewinnt die Pinnwand mindestens {min(gains):.0f} CSS-Pixel Höhe. Alle Karten passten
bei der Übersicht in den sichtbaren Bereich. Zoom und Fokus änderten keine Daten.

Der native Test importierte drei neutrale PDFs mit Raster, Vektorgrafik,
Textkarten samt eingebettetem Foto, mehreren Seiten und einem Aufgabenabschnitt.
Er prüfte sichtbare Lehrkraftfarben, Rücksetzen der Farbe, das bestätigte und
abgebrochene Löschen, Texte, Positionen, Projekt-Wiederöffnung, die native
Vorschau und die tatsächlich aus Studio exportierte SCORM-Aufgabe. Die
Lernenden-Markierung lässt sich entfernen und legt dann die Lehrkraftfarbe
wieder frei. Private Pfeile blieben außerhalb der Schüleraufgabe. Das
hochgeladene Original-PDF wurde separat im Cloud-Arbeitsbereich geprüft.

Befehle und Nachweise stehen in Editor.log, Editor-Vorher.log und den beiden
Editor-JSON-Protokollen. Das Beispiel-SCORM und Screenshots liegen bei.
"""

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
        find("Native-Schuelervorschau.png"), find("Schuelerbewegung-chromium.png"),
        find("Schuelerbewegung-webkit.png"), find("Studenten-Chromium.log"),
        find("Studenten-WebKit.log"), *stress_paths, *logs, *editor_paths,
    ]:
        shutil.copy2(path, report / path.name)
    shutil.copy2(before_file, report / "Schueler-vorher.json")
    shutil.copy2(after_file, report / "Schueler-nachher.json")
    shutil.copy2(dmg, root / dmg_name)
    (root / "INSTALLATION.md").write_text(f"""# MysteryBoard Studio {version} installieren

1. Die DMG öffnen und MysteryBoard Studio in den Ordner Programme ziehen.
2. MysteryBoard Studio aus Programme starten.
3. Beim Aktualisieren bestehende bearbeitbare Projekte behalten. Ein älterer
   SCORM-Export enthält weiterhin seinen ursprünglichen Schülerplayer. Für die
   korrigierte Fassung das Mystery in {version} öffnen, erneut als SCORM exportieren
   und die ZIP in itslearning austauschen.

Die App ist ad hoc signiert. Eine Apple-Notarisierung liegt nicht vor.
Die zuständige Administration entscheidet über die Freigabe auf verwalteten Macs.
""", encoding="utf8")
    sample = before["results"][0]
    fixed = after["results"][0]
    (report / "ABNAHME.md").write_text(f"""# MysteryBoard Studio {version} für Apple Silicon

Ausgangscommit `{base}`. Getesteter Commit `{commit}`.
[GitHub-Actions-Lauf]({workflow})

## Schülerbewegung

Das ausgelieferte SCORM aus 0.2.1 zeigte bei Maus und Touch denselben Fehler.
Beim versetzten pointerup ohne pointermove erwartete der Test für die erste
Karte den Zielpunkt {sample["target"]}, erhielt aber {sample["actual"]}.
Mit dem tatsächlichen SCORM aus der installierten Version {version} stimmen Soll und Ist
überein. Für den ersten Mauslauf ergibt sich {fixed["actual"]}. Die übrigen
Messwerte stehen in Schueler-vorher.json und Schueler-nachher.json.

Eine valide Geste verwendet die Freigabekoordinaten. Der History-Reducer
übernimmt ausschließlich die Positionsänderung und schützt neuere Änderungen
an derselben Karte. Laden, Undo und Redo wechseln die Sitzung einer Geste.
Bloße Renderänderungen oder kompatible Bearbeitungen lassen Bewegungen zu.
Abbrüche und ein vorzeitiger Capture-Verlust speichern keine Teilbewegung.
Die vorhandene Click-Unterdrückung bleibt Teil der Ereignisbehandlung.
Der bisherige Webplayer der Universalvorlage behält sein geprüftes
Gestenverhalten. Die Änderung betrifft den von Studio exportierten Player.

Chromium {stress[0]["version"]} und WebKit {stress[1]["version"]} bestanden
jeweils 100 deterministische Bewegungen mit 5, 12, 20 und 60 Karten. Die
JSON-Protokolle dokumentieren Soll und Ist pro Schritt. Dazu kamen langsame
und schnelle Mausbewegungen, Schwellwert, Zoom, Abbruch, Zustandswechsel,
Pfeil-Geometrie sowie PNG-Sicherung und Weiterarbeit in einer neuen Sitzung.
Chromium prüft zusätzlich 24 aufeinanderfolgende echte Browser-Touchsequenzen
auf 60 Karten und den Zwei-Finger-Zoom über CDP. WebKit erhält für den Zoom zwei
simulierte Pointer. Beide Testarten verwenden den exportierten Schülerplayer.

## Exportkontrolle

Die Übersicht verwendet die Schüleraufgabe aus publishDraft. Sie enthält die
sichtbaren Starthilfen mit Richtung und Beschriftung. Die bestätigte
Inhaltsprüfsumme gilt für einen Exportdialog und für dessen aktuellen
Aufgabenzustand. Ohne Bestätigung sind SCORM und Aufgaben-PNG gesperrt.
Bearbeitbare Projekte lassen sich jederzeit sichern. Die native Vorschau,
SCORM und das eingebettete Aufgaben-PNG enthielten dieselbe Aufgabe. Eine
separate Testaufgabe bestätigte die Filterung ausgeblendeter Karten und die
Trennung interner Lehrkräftepfeile. Nach Bearbeiten einer Starthilfe verlangt
der Export eine neue Bestätigung.

Echte Schüler-PNGs aus 0.2.0 und 0.2.1 wurden in den neu exportierten
Playern wiederhergestellt. Bereits exportierte SCORM-ZIPs behalten ihren
bisherigen Player. Zum Aktualisieren sind ein neuer Export und der Austausch
in itslearning erforderlich. Das Dateiformat und SCORM 1.2 bleiben erhalten.

{editor_report}
## Testnachweise

- `npm test` ergab {data_count} bestandene Datentests.
- `npm run build` bestätigte TypeScript und den HTML-Build.
- `npm run test:e2e -- --shard=N/4` ergab {sum(counts)} bestandene Browserprüfungen mit Chrome for Testing 156.0.8078.80.
- `npm run test:rc2` ergab vier bestandene Prüfungen des eingefrorenen Unterrichtsstands.
- `npm run studio:make -- --platform=darwin --arch=arm64` erzeugte die DMG.
- DMG-Verifikation mit hdiutil, Einhängen, Kopieren und Prüfen der Signatur bestanden.
- `node qa/studio/mac-board-native.mjs` prüfte die installierte App, die Exportkontrolle und {motions} deterministische Autorenbewegungen.
- `node qa/studio/mac-board-player.mjs` prüfte Vorschau-Exportgleichheit, SCORM und PNG-Rundlauf.
- `node qa/studio/student-release.mjs` und `node qa/studio/student-stability.mjs` lieferten die Bewegungsnachweise.
- `npm run studio:test` ergab {checks} bestehende native Prüfpunkte für Import, OCR, Druck und weitere Studio-Funktionen.

Ein früherer Lauf hat eine intermittierende Abweichung im Drehungstest gezeigt.
Auch 0.2.1 zeigte beim gleichen Test die Abweichung von 31 CSS-Pixeln. Die
Messung zeigte einen Griffpunkt aus der alten Pinnwandansicht. Der Test wartet
jetzt nach „Übersicht“ auf den neu gezeichneten Stand. Die Soll-Koordinaten und
die Toleranz bleiben identisch. Der A4-Extremtexttest wurde nach einem
Ladeabbruch im Vite-Testserver nochmals ausgeführt.

Die Eingaben auf dem macOS-ARM64-Runner waren automatisiert. Ein manueller
Trackpad-Test, ein verwaltetes Schul-iPad und ein echter itslearning-Kursstart
wurden nicht geprüft. Das Paket ist ad hoc signiert. Eine Apple-Notarisierung
liegt nicht vor.
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
