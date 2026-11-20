"""Package a tested Mac build and neutral evidence. This script has no release step."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
from zipfile import ZipFile, ZIP_DEFLATED, ZIP_STORED

evidence, out = (Path(arg) for arg in sys.argv[1:])
out.mkdir(parents=True, exist_ok=True)
prefix = "MysteryBoard-Studio-0.2.5"
commit = os.environ["GITHUB_SHA"]


def find(name):
    files = list(evidence.rglob(name))
    if len(files) != 1:
        raise SystemExit(f"Testkandidat gesperrt: {name} ({len(files)} Nachweise).")
    return files[0]


def read(name):
    return json.loads(find(name).read_text())


def sha(path):
    with path.open("rb") as data:
        return hashlib.file_digest(data, "sha256").hexdigest()


def archive(path, members, compression):
    with ZipFile(path, "w", compression) as bundle:
        for name, member in members.items():
            bundle.write(member, name)
    with ZipFile(path) as bundle:
        assert bundle.testzip() is None, path
        for name, member in members.items():
            with bundle.open(name) as entry:
                assert hashlib.file_digest(entry, "sha256").hexdigest() == sha(member), name


native = read("native-macos.json")
assert native["passed"] and native["arch"] == "arm64" and native["sourceCommit"] == commit
chromium = read("Chromium.json")
webkit = read("WebKit.json")
assert chromium["passed"] and chromium["app"] == {"version": "0.2.5", "packaged": True}
assert chromium["native"] and chromium["platform"] == "darwin"
assert [row["count"] for row in chromium["cases"]] == [5, 12, 20, 60, 100]
assert [row["edits"] for row in chromium["cases"]] == [2, 10, 16, 48, 80]
assert webkit["passed"] and webkit["cases"][0]["edits"] == 2
assert chromium["overlapResolved"] or webkit["overlapResolved"]
browser_count = sum(
    int(re.findall(r"(\d+) passed", find(f"Chromium-{i}.log").read_text())[-1])
    for i in range(1, 5)
)
assert browser_count >= 272
data = re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", find("Daten.log").read_text())
unit_count = int(re.search(r"Tests\s+(\d+) passed", data)[1])
assert unit_count >= 200 and "4 passed" in find("RC2.log").read_text()
assert read("Mac-Pinnwand-Tests.json")["passed"] and read("Mac-Starthilfe-SCORM.json")["passed"]
matrix = read("Matrix.json")["cases"]
assert len(matrix) == 17 and all(row["state"] != "fehlgeschlagen" for row in matrix.values())

dmg_name = f"{prefix}-Mac-Apple-Silicon.dmg"
dmg = out / dmg_name
source_dmg = find(dmg_name)
shutil.copyfile(source_dmg, dmg)
assert sha(dmg) == sha(source_dmg)
docs = out / "Kurzbericht.md"
docs.write_text(
    f"# MysteryBoard Studio 0.2.5 · Testkandidat für Apple Silicon\n\n"
    f"Commit `{commit}`. GitHub-Actions-Lauf {os.environ['GITHUB_RUN_ID']}.\n\n"
    f"{unit_count} Daten- und {browser_count} Chromium-Regressionsprüfungen bestanden. "
    "Vier Prüfungen der eingefrorenen Boden-RC2 und 17 neutrale Importfälle bestanden. "
    "Die DMG wurde verifiziert, kopiert und die installierte ARM64-App gestartet. "
    "Die Schüleraufgaben aus dieser App bestanden die Text- und Original-PNG-Rundreise in Chromium "
    "bei 5, 12, 20, 60 und 100 Karten. WebKit prüfte die exportierte Aufgabe im Querformat.\n\n"
    "Die tatsächlichen und angeforderten Fenstermaße stehen in der Sichtprüfung. "
    "Jede nicht exakt erreichte Größe bleibt ungeprüft. Die App ist ad hoc signiert. "
    "Apple-Notarisierung und der Einsatz auf verwalteten Geräten sind offen.\n\n"
    "**Die Gesamtfreigabe setzt den nativen P01-Originalnachweis aus 0.2.4 voraus.** "
    "Dieses Paket enthält ausschließlich einen Testkandidaten und neutrale Beispiele.\n"
)
installation = out / "Installation.txt"
installation.write_text(
    "MysteryBoard Studio 0.2.5, Apple Silicon, Testkandidat\n\n"
    "DMG öffnen und MysteryBoard Studio in den Programme-Ordner kopieren. "
    "Auf verwalteten Macs die Freigabe mit der Administration klären.\n"
)
dmg_sum = out / "DMG-SHA256.txt"
dmg_sum.write_text(f"{sha(dmg)}  {dmg_name}\n")
install = out / f"{prefix}-Mac-Apple-Silicon-Testkandidat-Installationspaket.zip"
archive(install, {p.name: p for p in (dmg, docs, installation, dmg_sum)}, ZIP_STORED)

examples = {}
for name in ("Textkarten.mysteryboard", "Textkarten-SCORM.zip", "Team Text_Erklärungen zur Messreihe.png"):
    dst = out / name
    shutil.copyfile(find(name), dst)
    examples[name] = dst
with ZipFile(examples["Textkarten-SCORM.zip"]) as scorm:
    assert scorm.testzip() is None and "imsmanifest.xml" in scorm.namelist()
assert sha(examples["Team Text_Erklärungen zur Messreihe.png"]) == chromium["cases"][0]["sha256"]

review = out / f"{prefix}-Testkandidat-Sichtpruefung.zip"
members = {docs.name: docs}
for name in (
    "Chromium.json", "WebKit.json", "Freigabe.png", "Schuelerkarte-768.png",
    "Schuelerkarte-1024.png", "native-macos.json", "Mac-Pinnwand-Tests.json",
    "Mac-Starthilfe-SCORM.json", "Fenster-0.2.5.json", "Matrix.json", "Daten.log", "RC2.log",
    *(f"Chromium-{i}.log" for i in range(1, 5)),
):
    members[name] = find(name)
for screenshot in evidence.rglob("0.2.5-Fenster-*.png"):
    members[screenshot.name] = screenshot
archive(review, members, ZIP_DEFLATED)
manifest = out / "SHA256SUMS.txt"
manifest.write_text("".join(f"{sha(p)}  {p.name}\n" for p in (dmg, install, review, *examples.values())))
print(manifest.read_text(), end="")
