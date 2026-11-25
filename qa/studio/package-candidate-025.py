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
print_quality = version in ("0.2.7", "0.2.8", "0.2.9", "0.3.0")
compact_cards = version in ("0.2.6", "0.2.7", "0.2.8", "0.2.9", "0.3.0")
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
if version in ("0.2.8", "0.2.9", "0.3.0"):
    proof = evidence / "levels-028"
    for engine in ("Chromium", "WebKit"):
        results=json.loads((proof / (engine+"-028.json")).read_text())
        assert results["passed"] and len(results["levels"])==4 and results["moves"]>=100
    teacher = json.loads((proof / "Studio-028.json").read_text())
    assert teacher["installed"] and teacher["populatedLevelImport"]["afterDrop"] == 62
    for engine in ("Chromium", "WebKit"):
        limits = json.loads((proof / f"{engine}-Speichergrenzen.json").read_text())
        assert len(limits["scenarios"]) >= 10
    assert json.loads((proof / "Chromium-Prozessabbruch.json").read_text())["restored"]
    memory = json.loads((proof / "Speichermessung-028.json").read_text())
    assert memory["cases"][0]["taskDecodes"] > memory["cases"][1]["taskDecodes"] == 1
    report = out / f"Pruefbericht-{version}.md"
    before, after = memory["cases"]
    lines = [
        f"# MysteryBoard Studio {version} · Technische Abnahme", "",
        f"Code `{commit}` · Actions-Lauf {os.environ['GITHUB_RUN_ID']} · Apple Silicon.", "",
        "## Autorenablauf und Dateiauswahl", "",
        "In der gebauten Oberfläche von 0.2.7 ließ sich der Fehler nach dem Abbruch des anfänglichen Importdialogs reproduzieren. Zwei Dateifelder teilten eine React-Referenz. Beim Entfernen eines Feldes verlor die Schaltfläche ihr Ziel. Studio verwendet nun einen auf Unterrichtsmaterial begrenzten nativen Dateidialog. Das Testprotokoll erfasst den Klick, die sichtbare macOS-Dateiauswahl, Abbruch, erneute Auswahl und Import einer DOCX. Ein beschädigtes PNG löste einen sichtbaren Fehler aus. In einem bereits belegten Niveau wurden 60 Karten per Drag-and-drop um zwei erweitert. Die drei anderen Entwürfe blieben beim Dateivergleich identisch.", "",
        "Die Beispielsammlung vereint Fördern, ESA, MSA und AHR mit zwei, drei, vier und fünf Karten. Die Lehrkraft kann jedes Niveau gestalten, Hilfen und Bearbeitungsfreigaben ändern und einzelne Niveaus exportieren. Beim gemeinsamen Export durchläuft jedes Niveau die Veröffentlichungsprüfung. Im Player wird genau eine Aufgabendatei abgerufen. Die automatisierten Modellprüfungen decken Sammlungen mit 1, 2, 4 und 12 Niveaus sowie ausgeblendete Inhalte ab.", "",
        "## Schülerarbeit und Wiederherstellung", "",
        "| Engine | Beendete Kartenbewegungen | Wiederherstellung bis zur sichtbaren Pinnwand (Millisekunden pro Niveau) | Externe Anfragen |",
        "|---|---:|---|---:|",
    ]
    for engine in ("Chromium", "WebKit"):
        r = json.loads((proof / f"{engine}-028.json").read_text())
        lines.append(f"| {engine} {r['engine']} | {r['moves']} | {', '.join(map(str,r['recoveryMs']))} | {len(r['external'])} |")
    lines.extend([
        "", "Jede Zeile umfasst den Schülerablauf in allen vier Niveaus. Der Vergleich erfolgte nach Reload der äußeren Seite und des inneren Frames, neben der letzten Kartenbewegung auch mit einem übernommenen Text, einem offenen Entwurf und Undo/Redo. Die ursprüngliche Gruppe und das Niveau erschienen ohne erneute Eingabe. Nach explizitem PNG-Export wurde jede Datei in einer neuen Sitzung geöffnet, erneut exportiert und ihr vollständiges Dokument unabhängig per Python dekodiert und verglichen. Die herunterladbaren vier Beispiel-PNGs stammen aus Chromium.", "",
        "Bei frischem Kontext zeigt die erweiterte Speicherung nur Gruppe, Niveau und Uhrzeit bis zur bewussten Auswahl. Zwei parallele gleichnamige Gruppen, Versions- und Aufgabenwechsel, abgelaufene und beschädigte Daten sowie gesperrte Speicherstufen sind in den Speichergrenzen-Protokollen erfasst. Weitere Reload-Prüfungen umfassten 30, 60 und 100 Karten. Chromium konnte nach einem erzwungenen Renderer-Abbruch und Neustart desselben Browserprofils den letzten bestätigten Positionsstand wieder öffnen. Der Sitzungsspeicher endet unter Umständen mit dem ursprünglichen Tab. Die freiwillig aktivierte lokale Datenbank ist auf drei Stunden seit der letzten Speicherung begrenzt, die Löschung erfolgt beim nächsten Zugriff. Ein Geräte-, Origin- oder Partitionswechsel kann eine PNG erfordern. SCORM nutzt nur LMSInitialize/LMSFinish.", "",
        "## Speicher und Ressourcen", "",
        f"Dieselbe Aufgabe mit {memory['taskBytes']} Bytes wurde bei fünf Öffnungs-/Schließzyklen des Fortsetzen-Dialogs in 0.2.7 {before['taskDecodes']} Mal und in {version} {after['taskDecodes']} Mal vollständig dekodiert. Chromium meldete nach expliziter Garbage Collection am Ende {before['heapAfter']} bzw. {after['heapAfter']} Bytes belegten JavaScript-Heap. Eine Messreihe belegt den vermiedenen Dekodieraufwand, die Heap-Werte variieren zwischen Läufen. Der Player lädt nur das gewählte Niveau. Er schreibt Arbeitsdaten ohne Kopien der Medien. Canvas-Flächen werden nach PNG-Export freigegeben, Objekt-URLs beim Schließen oder Ersetzen widerrufen. Die bestehende begrenzte Undo-Historie bleibt im Arbeitsspeicher.", "",
        "GPU-Speicher, Bilddecoder und Prozessspeicher auf Schul-iPads wurden nicht gemessen. Die Ursache der beobachteten itslearning-Neuladungen bleibt offen.", "",
        "## Reproduktion und Regression", "",
        f"{unit_count} Datentests, {browser_count} Chromium-Browsertests, vier RC2-Prüfungen und die native Importmatrix mit 17 Fällen. Die vollständigen Befehle einschließlich Referenz-Downloads, Build, Installation und Prüfung stehen in `.github/workflows/studio-macos-{version.replace('.', '')}.yml`. Die neuen Prüfungen verwenden die entpackte, aus der installierten App exportierte SCORM-Datei.", "",
        "```sh", "npm ci", "npm test", "npm run build", "npm run test:rc2", "npm run test:e2e", "npm run studio:make -- --platform=darwin --arch=arm64", "# Nach separater Installation STUDIO_EXEC auf das installierte Programm setzen", "node qa/studio/levels-028.mjs artifacts/levels-028", "node qa/studio/recovery-limits-028.mjs artifacts/levels-028", "node qa/studio/memory-028.mjs artifacts/levels-028 /pfad/zur/0.2.7/SCORM-30.zip", "npm run studio:test", "```", "",
        "## Einsatzgrenzen", "",
        "Maximal zwölf Niveaus, 20 MB je bearbeitbarem Einzelprojekt, 60 MB je Sammlung und unter 10 MB für die Player-HTML. Der native Mac-Lauf prüft die tatsächlich erreichten Fenstergrößen. Die private Originalprüfung P01 der M2-Grafik, die Apple-Notarisierung und die praktische Prüfung auf einem verwalteten iPad in itslearning sind offen. Die separate Praxistest-Anleitung begleitet das Beispiel.",
    ])
    if version in ("0.2.9", "0.3.0"):
        ux = evidence / "ux-029"
        old = json.loads((ux/"Mac-vorher/Autoren-before.json").read_text())
        new = json.loads((ux/"Mac-nachher/Autoren-after.json").read_text())
        assert all(row["environment"] == "installierte Apple-Silicon-App" for row in (old,new))
        assert new["scenarios"]["B"]["levelSwitchActions"] == 1
        assert new["scenarios"]["A"]["settings"] == 0
        assert new["scenarios"]["B"]["count"] < old["scenarios"]["B"]["count"]
        lines.extend(["", "## Gemessene Lehrkräfteabläufe in den installierten Apps", "",
            "Gleiche DOCX und dieselbe ältere Beispielsammlung. Jede Eingabe, Auswahl und Bestätigung steht einzeln im JSON. Die Dialogzahl umfasst auch die Aufrufe der Dateiauswahl und des Speicherziels. Der Vergleich gibt diesen Dialogen reproduzierbare Dateipfade vor. Die echte macOS-Materialauswahl wurde zusätzlich separat geöffnet und bedient. Die Navigationstiefe zählt die Ebenen unterhalb der Pinnwand. Automatisierte Bedienung liefert keine Beobachtung einer unerfahrenen Person.", "",
            "| Ablauf | Bedienhandlungen vorher → nachher | Dialoge | Einstellungen | Maximale Tiefe |",
            "|---|---:|---:|---:|---:|"])
        for key, label in [("A","Neues Mystery und Import"),("B","Differenzierung und gemeinsame Voreinstellung"),("C","Hilfen, Bearbeitung, Starthilfe und Gestaltung")]:
            a,b=old["scenarios"][key],new["scenarios"][key]
            lines.append("| "+label+" | "+" | ".join(f"{a[k]} → {b[k]}" for k in ("count","dialogs","settings","maximumDepth"))+" |")
        lines.extend(["", "Der direkte Niveauwechsel benötigt vier → eine Bedienhandlung. Ein einfaches Mystery benötigt keine manuelle Speicher- oder Gestaltungseinstellung. Die individuelle Gestaltung erfordert das Öffnen der optionalen Gestaltungsgruppe.", "",
            "| Ziel-Inhaltsgröße | Erreichte Größe nachher | Pinnwand vorher (Pixel) | Pinnwand nachher (Pixel) |",
            "|---|---|---|---|"])
        contrast=min(s["exportDetail"]["contrast"] for s in new["screens"] if s["scene"]=="Einzelexport")
        assert contrast>=4.5
        previous=[v for v in old["screens"] if v["scene"]=="Pinnwand"]
        for a,b in zip(previous,[v for v in new["screens"] if v["scene"]=="Pinnwand"],strict=True):
            dim=lambda v: " × ".join(map(str,v))
            size=lambda v: dim([round(v["board"]["width"]),round(v["board"]["height"])])
            lines.append(f"| {dim(b['requested'])} | {dim(b['actual'])} {'(exakt)' if b['exact'] else '(Ziel nativ offen)'} | {size(a)} | {size(b)} |")
        lines.append(f"Bei der Sichtprüfung des ersten Entwurfs fiel die zu dunkle Formatangabe im primären SCORM-Button auf. Sie verwendet jetzt die helle Schriftfarbe des Buttons (gemessener Kontrast {contrast:.1f}:1). Die Hauptaktion der Niveauverwaltung steht unmittelbar bei der Auswahl und war in jedem geprüften Fenster ohne Scrollen erreichbar.")
        for folder,phase in [("Browser-vorher","before"),("Browser-nachher","after")]:
            display=json.loads((ux/folder/f"Autoren-{phase}.json").read_text())
            assert len(display["screens"])==16 and all(s["exact"] and not s["horizontalOverflow"] for s in display["screens"])
        lines.append("Zusätzlich wurde die gebaute Autorenoberfläche in Chromium bei allen vier exakten Inhaltsgrößen geprüft. Die Dateien unter Browser-vorher und Browser-nachher kennzeichnen diese Vergleichsprüfung.")
        for phase,expected in [("before",True),("after",False)]:
            rows=read(f"Messwerte-{phase}.json")
            assert len(rows)==6 and all(r["warnedAfterSave"]==expected and ((r["zoom"]!=r["restored"])==expected) for r in rows)
        lines.extend(["", "Chromium und WebKit prüften den gespeicherten Stand, eine reine Zoomänderung und einen offenen Textentwurf bei 768 × 1024, 1024 × 768 und 768 × 620. 0.2.8 warnte in allen sechs Fällen und stellte die vorherige Zoomstufe her. 0.2.9 stellte jeweils den letzten Zoom samt unveränderten Kartenpositionen wieder her. Die Warnung richtet sich nach der letzten bestätigten Revision. Bei temporärer Speicherung kann ein geschlossenes Browserfenster oder eine beendete Sitzung weiterhin eine Original-PNG erforderlich machen.", "",
            "Die vollständigen Quelldaten und Screenshots liegen im Verzeichnis UX. Der Vergleich prüft automatisierbare Bedienwege. Eine Beobachtung mit Lehrkräften und Lernenden sowie P01 und das verwaltete Schul-iPad bleiben offen."])
        lines.extend(["", "Die Vergleichsprüfung reproduzierte zusätzlich die Rückkehr der vorigen Gruppe nach dem Wechsel zur Startauswahl und den Verlust unbestätigter Änderungen beim Schließen der Niveauverwaltung. Die neue Version trennt den Gruppenstart vom Niveauwechsel und fragt bei ungesicherten Verwaltungsänderungen nach. Ergänzende Belastungsprüfungen halten den Datenbankabschluss gezielt zurück, löschen während des Schreibens und prüfen eingebettete Aufgaben mit 5, 20, 30, 60 und 100 Karten. Ein frei gewählter Denkimpuls, die Original-PNG und die bewusst freigegebene Starthilfe bleiben erreichbar. Die Auslieferung enthält keine persönlichen Dokumente.", ""])
        actual=read("Unabhaengige-SCORM-Pruefung.json")
        assert actual["scormSHA256"] == sha(proof/"Wasser-SCORM.zip") and len(actual["checks"])==6
        assert all(r["cardPositionsUnchanged"] and r["openCardRestored"] and not r["warnAfterCommit"] and r["warnForUncommittedGroupName"] and not r["external"] for r in actual["checks"])
        lines.extend(["", "Eine unabhängige Ausführung derselben ausgelieferten SCORM-ZIP prüfte die reine Verschiebung des sichtbaren Ausschnitts unmittelbar vor einem Reload, das erneute Öffnen der zuletzt gelesenen Karte und die Warnung bei einem noch nicht übernommenen Gruppennamen. Beide Engines prüften die Bedienelemente außerdem bei 1024 × 570 Pixeln. Mindestbreite und Mindesthöhe aller geprüften Werkzeuge betrugen je 44 CSS-Pixel."])
        for f in ux.glob("*/*"):
            if f.is_file() and f.suffix in (".png",".json"):
                members["UX/"+str(f.relative_to(ux))]=f
    if version == "0.3.0":
        exchange = evidence / "exchange-030"
        audit = json.loads((exchange / "Austausch-Pruefung.json").read_text())
        assert audit["installedAppleSilicon"] and len(audit["players"]) == 4 and not audit["external"]
        assert sha(exchange / "MysteryBoard-KI-Vorlage.mysteryboard") == sha(exchange / "MysteryBoard-KI-Vorlage.txt")
        for folder, phase in [("Vorher","before"),("Nachher","after")]:
            records = json.loads((exchange / folder / (phase+".json")).read_text())
            assert len(records)==4 and all(r["confirmation"]==(phase=="after") for r in records)
            members["KI/"+phase+".json"] = exchange/folder/(phase+".json")
            if phase=="after":
                assert all("Abweichende Inhaltsversion" in r["additional"] and "Fremde Aufgabe" in r["additional"] for r in records)
        assert len(audit["comparison"]["manual"]) > len(audit["comparison"]["exchange"])
        members["KI/Niveau-Dateiauswahl.png"] = proof/"Niveaudatei-macOS.png"
        for path in exchange.iterdir():
            if path.is_file() and (path.name.startswith(("KI-", "MysteryBoard-KI-", "Team Ufer")) or path.name=="Austausch-Pruefung.json"):
                if path.suffix==".zip":
                    with ZipFile(path) as z:
                        assert z.testzip() is None and "imsmanifest.xml" in z.namelist()
                if path.name.startswith("KI-") and path.suffix==".png" or path.name=="Austausch-Pruefung.json":
                    members["KI/"+path.name]=path
                else:
                    examples[path.name]=path
        lines.extend(["","## KI-Austausch und Schutz der Schülerarbeit","",
            "Die aus der DMG installierte ARM64-App exportierte beide bytegleichen Blankovorlagen. Die unabhängig in Python geschriebenen Beispiele wurden als JSON-Text und Datei übernommen, gespeichert und nach einem Neustart wieder geöffnet. Die vier ausgelieferten Niveaus und ihre Original-PNGs wurden im Schülerplayer geprüft. Die privaten Beispielverbindungen fehlen in allen entpackten SCORM-Einträgen.","",
            "In Chromium und WebKit ersetzte 0.2.9 den neueren Stand sofort. In der neuen Version wurden Verwerfen, Bestätigen, eine identische PNG und anschließendes Neuladen mit den gespeicherten Daten abgeglichen. Die Einzelprotokolle liegen unter KI.","",
            f"Bei gleichem Ausgangsmaterial ergaben sich für vier inhaltlich identische Niveau-Ausgaben {len(audit['comparison']['manual'])} Bedienhandlungen bei manueller Konfiguration und {len(audit['comparison']['exchange'])} beim Import der vorkonfigurierten Datei. Gemessen wurden Klicks auf Schaltflächen und übernommene Feldwerte bis einschließlich Schließen des Exportdialogs. Beide Durchläufe verwenden vorgegebene native Dateipfade. Der Vergleich prüfte alle publizierten Inhaltsfelder, ausgenommen intern erzeugte Identitäten und Revisionsnummern. Die Erstellung im externen Chat und eine fachliche Inhaltsprüfung haben keine gemessene Dauer.","",
            "Es wurde kein externer KI-Anbieter getestet. Die fachliche Kontrolle verbleibt bei der Lehrkraft."])
    report.write_text("\n".join(lines)+"\n")
    members[report.name] = report
    examples[report.name] = report
    for name in ("Wasser.mysteryboard", "Wasser-SCORM.zip", "SCHUL-IPAD-028.md"):
        examples[name] = proof / name
    for png in proof.glob("Gruppe*.png"):
        examples[png.name] = png
    assert len(list(proof.glob("Gruppe*.png"))) == 4
    for pattern in ("*-028.json", "*-Speichergrenzen.json", "*-Prozessabbruch.json", "*-Niveauauswahl.png",
                    "*-Export.png", "*-Wiederhergestellt.png", "*-028.png", "Dateiauswahl-macOS.png", "SCHUL-IPAD-028.md"):
        for f in proof.glob(pattern):
            members["028-"+f.name] = f
archive(review, members, ZIP_DEFLATED)
manifest = out / "SHA256SUMS.txt"
manifest.write_text("".join(f"{sha(p)}  {p.name}\n" for p in (dmg, install, review, *examples.values())))
print(manifest.read_text(), end="")
