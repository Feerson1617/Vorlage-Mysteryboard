"""Package a tested Mac build and neutral evidence. This script has no release step."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
from zipfile import ZipFile, ZIP_DEFLATED, ZIP_STORED

evidence, out = (Path(arg) for arg in sys.argv[1:3])
out.mkdir(parents=True, exist_ok=True)
version = sys.argv[3] if len(sys.argv) > 3 else "0.2.5"
print_quality = version == "0.2.7"
compact_cards = version in ("0.2.6", "0.2.7")
prefix = f"MysteryBoard-Studio-{version}"
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
assert chromium["passed"] and chromium["app"] == {"version": version, "packaged": True}
assert chromium["native"] and chromium["platform"] == "darwin"
counts = [5, 12, 20, 30, 60, 100] if compact_cards else [5, 12, 20, 60, 100]
edits = [2, 10, 16, 24, 48, 80] if compact_cards else [2, 10, 16, 48, 80]
assert [row["count"] for row in chromium["cases"]] == counts
assert [row["edits"] for row in chromium["cases"]] == edits
assert webkit["passed"] and webkit["cases"][0]["edits"] == 2
assert chromium["overlapResolved"] or webkit["overlapResolved"]
compact_report = ""
compact_assets = []
if compact_cards:
    assert webkit["native"] and webkit["platform"] == "darwin"
    assert [row["count"] for row in webkit["cases"]] == counts
    assert [row["edits"] for row in webkit["cases"]] == edits
    assert chromium["overlapResolved"] and webkit["overlapResolved"]
if version == "0.2.6":
    png_hash = sha(find("Arbeitsstand-30.png"))
    comparison_reports = []
    for name, proof in [("Chromium", chromium), ("WebKit", webkit)]:
        comparison = proof["comparison"]
        assert comparison["cardsWithExcerpt"] == 23
        assert comparison["overlappingPairs"][0] > comparison["overlappingPairs"][1] == 0
        assert comparison["tallest"][0] > comparison["tallest"][1]
        metrics = f"Vergleich-30-{name}.json"
        record = read(metrics)
        assert record["backupSha256"] == png_hash
        assert record["after"]["positions"] == record["before"]["positions"]
        count = comparison["overlappingPairs"][0]
        comparison_reports.append(f"{name} {count} → 0")
        compact_assets.extend([metrics, *comparison["screenshots"]])
    pdf = "Vollstaendige-Kartentexte-A4.pdf"
    pdf_proof = read("PDF-Pruefung.json")
    assert pdf_proof["sha256"] == sha(find(pdf))
    assert pdf_proof["pages"] > 1 and len(pdf_proof["endMarkers"]) == 23
    compact_assets.extend([pdf, "PDF-Pruefung.json"])
    compact_report = (
        "Die Vorher-Nachher-Screenshots zeigen 30 Karten mit identischen Positionen und "
        "derselben Original-PNG in 0.2.5 und 0.2.6. Überlappende Kartenpaare "
        f"gingen von {', '.join(comparison_reports)} zurück. "
        "Die volle Textlänge und Absatzfolge wurde für alle 24 bearbeiteten Karten in der "
        f"Druckvorschau abgeglichen. Die Endmarken der 23 langen Texte sind im A4-PDF "
        f"mit {pdf_proof['pages']} Seiten nachgewiesen.\n\n"
    )
if print_quality:
    pdf_proof = read("PDF-Pruefung-027.json")
    assert set(pdf_proof) == {"a4", "a3"}
    assert set(chromium["printComparison"]) == {"a4", "a3"}
    assert any(proof["beforeWordSplits"] > 0 for proof in pdf_proof.values())
    compact_assets.extend(["Druckvergleich-DOM.json", "PDF-Pruefung-027.json"])
    rows = []
    for paper, proof in pdf_proof.items():
        label = paper.upper()
        assert proof["exactRegions"] >= 66 and proof["images"] == 3
        assert proof["tiles"] > 0
        assert proof["newTileSampleMinPt"] > 2 * proof["oldSampleFontPt"]
        for phase, digest in [("Vorher", proof["sha256Before"]), ("Nachher", proof["sha256"])]:
            name = f"{phase}-{label}.pdf"
            assert sha(find(name)) == digest
            compact_assets.append(name)
        compact_assets.extend([
            f"Vorher-{label}-Uebersicht.png", f"Nachher-{label}-Uebersicht.png",
            f"Nachher-{label}-Ausschnitt.png", f"Vorher-{label}-Umbruch.png",
            f"Nachher-{label}-Volltext.png",
        ])
        rows.append(f"- {label} mit {proof['tiles']} vergrößerten Ausschnitten und {proof['exactRegions']} zeichengetreu geprüften PDF-Textbereichen.")
    compact_report = (
        "Die beiden Ausgaben verwenden dieselbe Original-PNG mit 30 Karten und 24 bearbeiteten Texten. "
        "Die Druckübersicht nutzt die kompakten Karten und vergrößerte Ausschnitte. "
        "Der unabhängige PDF-Vergleich prüfte Kartentexte, Überschriften, Tabellen, Quellen und Beziehungen.\n\n"
        + "\n".join(rows) + "\n\n"
    )
browser_count = sum(
    int(re.findall(r"(\d+) passed", find(f"Chromium-{i}.log").read_text())[-1])
    for i in range(1, 5)
)
assert browser_count >= 272
data = re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", find("Daten.log").read_text())
unit_count = int(re.search(r"Tests\s+(\d+) passed", data)[1])
assert unit_count >= (207 if print_quality else 204 if compact_cards else 200)
assert "4 passed" in find("RC2.log").read_text()
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
    f"# MysteryBoard Studio {version} · Testkandidat für Apple Silicon\n\n"
    f"Commit `{commit}`. GitHub-Actions-Lauf {os.environ['GITHUB_RUN_ID']}.\n\n"
    f"{unit_count} Daten- und {browser_count} Chromium-Regressionsprüfungen bestanden. "
    "Vier Prüfungen der eingefrorenen Boden-RC2 und 17 neutrale Importfälle bestanden. "
    "Die DMG wurde verifiziert, kopiert und die installierte ARM64-App gestartet. "
    "Die Schüleraufgaben aus dieser App bestanden die Text- und Original-PNG-Rundreise in Chromium "
    f"für die Kartenzahlen {', '.join(map(str, counts))}. "
    + ("WebKit prüfte dieselben exportierten Aufgabengrößen und die PNG-Wiederherstellung.\n\n"
       if compact_cards else "WebKit prüfte die exportierte Aufgabe im Querformat.\n\n")
    + compact_report +
    "Die tatsächlichen und angeforderten Fenstermaße stehen in der Sichtprüfung. "
    "Jede nicht exakt erreichte Größe bleibt ungeprüft. Die App ist ad hoc signiert. "
    "Apple-Notarisierung und der Einsatz auf verwalteten Geräten sind offen.\n\n"
    "**Die Gesamtfreigabe setzt den nativen P01-Originalnachweis aus 0.2.4 voraus.** "
    "Dieses Paket enthält ausschließlich einen Testkandidaten und neutrale Beispiele.\n"
)
installation = out / "Installation.txt"
installation.write_text(
    f"MysteryBoard Studio {version}, Apple Silicon, Testkandidat\n\n"
    "DMG öffnen und MysteryBoard Studio in den Programme-Ordner kopieren. "
    "Auf verwalteten Macs die Freigabe mit der Administration klären.\n"
)
dmg_sum = out / "DMG-SHA256.txt"
dmg_sum.write_text(f"{sha(dmg)}  {dmg_name}\n")
install = out / (f"{prefix}-Mac-Apple-Silicon-Installationspaket.zip" if print_quality else
                 f"{prefix}-Mac-Apple-Silicon-Testkandidat-Installationspaket.zip")
archive(install, {p.name: p for p in (dmg, docs, installation, dmg_sum)}, ZIP_STORED)

examples = {}
for name in ("Textkarten.mysteryboard", "Textkarten-SCORM.zip", "Team Text_Erklärungen zur Messreihe.png"):
    dst = out / name
    shutil.copyfile(find(name), dst)
    examples[name] = dst
with ZipFile(examples["Textkarten-SCORM.zip"]) as scorm:
    assert scorm.testzip() is None and "imsmanifest.xml" in scorm.namelist()
assert sha(examples["Team Text_Erklärungen zur Messreihe.png"]) == chromium["cases"][0]["sha256"]

review = out / (f"{prefix}-Sichtpruefung.zip" if print_quality else f"{prefix}-Testkandidat-Sichtpruefung.zip")
members = {docs.name: docs}
for name in (
    "Chromium.json", "WebKit.json", "Freigabe.png", "Schuelerkarte-768.png",
    "Schuelerkarte-1024.png", "native-macos.json", "Mac-Pinnwand-Tests.json",
    "Mac-Starthilfe-SCORM.json", f"Fenster-{version}.json", "Matrix.json", "Daten.log", "RC2.log",
    *compact_assets,
    *(f"Chromium-{i}.log" for i in range(1, 5)),
):
    members[name] = find(name)
for screenshot in evidence.rglob(f"{version}-Fenster-*.png"):
    members[screenshot.name] = screenshot
archive(review, members, ZIP_DEFLATED)
manifest = out / "SHA256SUMS.txt"
manifest.write_text("".join(f"{sha(p)}  {p.name}\n" for p in (dmg, install, review, *examples.values())))
print(manifest.read_text(), end="")
