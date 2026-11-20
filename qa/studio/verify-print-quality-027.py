"""Verify actual 0.2.6 and 0.2.7 PDFs with PyMuPDF and render evidence pages."""
from pathlib import Path
import hashlib
import json
import re
import sys
import unicodedata
import fitz

out = Path(sys.argv[1])


def compact(text):
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", text))


def spans(page):
    return (
        span
        for block in page.get_text("dict")["blocks"]
        for line in block.get("lines", [])
        for span in line["spans"]
    )


def screenshot(page, name):
    page.get_pixmap(matrix=fitz.Matrix(1.35, 1.35), alpha=False).save(out / name)


audit = json.loads((out / "Druckvergleich-DOM.json").read_text())
evidence = {}
for paper, tests in audit.items():
    label = paper.upper()
    prior_path = out / f"Vorher-{label}.pdf"
    path = out / f"Nachher-{label}.pdf"
    with fitz.open(prior_path) as before, fitz.open(path) as after:
        assert len(before) == tests["before"]["pageCount"]
        assert len(after) == tests["after"]["pageCount"]
        expected_size = (841.89, 595.28) if paper == "a4" else (1190.55, 841.89)
        assert all(
            abs(page.rect.width - expected_size[0]) < 1 and
            abs(page.rect.height - expected_size[1]) < 1
            for page in after
        )
        exact = 0
        for entry in tests["after"]["entries"]:
            expected = compact(entry["text"])
            if not expected:
                continue
            x0, y0, x1, y1 = [value * 0.75 for value in entry["bounds"]]
            page = after[entry["page"] - 1]
            box = fitz.Rect(x0 - 0.6, y0 - 0.6, x1 + 0.6, y1 + 0.6)
            assert page.rect.contains(box), (paper, entry["page"], box)
            visible = compact(page.get_text(clip=box))
            assert visible == expected, (paper, entry["page"], entry.get("cardText"), expected[:80], visible[:80], len(expected), len(visible))
            exact += 1

        tile_indexes = [i for i, section in enumerate(tests["after"]["sections"]) if section == "overview-detail"]
        detail = [i for i, section in enumerate(tests["after"]["sections"]) if section == "cards"]
        images = [i for i, section in enumerate(tests["after"]["sections"]) if section == "images"]
        assert len(images) == 3 and all(after[i].get_image_info() for i in images)
        size_in_tiles = []
        for index in tile_indexes:
            words = [
                span["size"] for span in spans(after[index])
                if re.search(r"\b(?:Befund|Ergänzung|Beobachtung|Pegelstand)\b", span["text"])
                and 95 < span["bbox"][1] < after[index].rect.height - 25
            ]
            assert words and max(words) >= 8, (paper, index + 1, words)
            size_in_tiles.extend(words)
        assert after[0].get_text().find("Auszug") != -1
        old_small = min(span["size"] for span in spans(before[0]) if "Befund" in span["text"])
        assert min(size_in_tiles) > old_small * 2
        screenshot(before[0], f"Vorher-{label}-Uebersicht.png")
        screenshot(after[0], f"Nachher-{label}-Uebersicht.png")
        screenshot(after[tile_indexes[0]], f"Nachher-{label}-Ausschnitt.png")
        screenshot(before[1], f"Vorher-{label}-Umbruch.png")
        screenshot(after[detail[0]], f"Nachher-{label}-Volltext.png")
        evidence[paper] = {
            "beforePages": len(before),
            "afterPages": len(after),
            "tiles": len(tile_indexes),
            "images": len(images),
            "exactRegions": exact,
            "beforeWordSplits": tests["wordSplits"],
            "oldSampleFontPt": round(old_small, 2),
            "newTileSampleMinPt": round(min(size_in_tiles), 2),
            "sha256Before": hashlib.sha256(prior_path.read_bytes()).hexdigest(),
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        }
(out / "PDF-Pruefung-027.json").write_text(json.dumps(evidence, indent=2) + "\n")
print(json.dumps(evidence, indent=2))
