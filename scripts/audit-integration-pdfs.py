"""Audit actual Chromium PDFs using Poppler and inspect their rasterized images.

Usage: python3 scripts/audit-integration-pdfs.py PDF_DIRECTORY OUTPUT_DIRECTORY
Requires Poppler and Pillow only for QA, never for the student application.
"""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import sys
from PIL import Image, ImageChops

source = Path(sys.argv[1]).resolve()
output = Path(sys.argv[2]).resolve()
output.mkdir(parents=True, exist_ok=True)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def raster(pdf, page):
    stem = output / f"{pdf.stem}-page-{page}"
    subprocess.run(["pdftoppm", "-f", str(page), "-l", str(page), "-singlefile", "-scale-to", "1600", "-png", str(pdf), str(stem)], check=True, capture_output=True)
    result = stem.with_suffix(".png")
    assert result.is_file()
    return result

files = []
images = []
for pdf in sorted(source.rglob("*.pdf")):
    metadata = subprocess.check_output(["pdfinfo", str(pdf)], text=True)
    pages = int(re.search(r"^Pages:\s+(\d+)", metadata, re.M)[1])
    assert pages > 1
    files.append({"file": str(pdf.relative_to(source)), "bytes": pdf.stat().st_size, "sha256": sha(pdf), "pages": pages, "pdfinfo": metadata})
    text = subprocess.check_output(["pdftotext", "-raw", str(pdf), "-"], text=True)
    parts = [part for part in text.split("\f") if part.strip()]
    assert len(parts) == pages
    if pdf.stem.startswith("medien-langtext-"):
        found = 0
        for number, textpage in enumerate(parts, 1):
            if "Bilddetails" not in textpage:
                continue
            assert "Legende:" in textpage and "Messfläche" in textpage
            png = raster(pdf, number)
            img = Image.open(png).convert("RGB")
            diff = ImageChops.difference(img, Image.new("RGB", img.size, (33, 102, 172)))
            channels = [band.point(lambda v: 255 if v <= 4 else 0) for band in diff.split()]
            mask = ImageChops.multiply(ImageChops.multiply(channels[0], channels[1]), channels[2])
            box = mask.getbbox()
            assert box is not None, f"Missing blue circle in {pdf} page {number}"
            width, height = box[2]-box[0], box[3]-box[1]
            assert min(width, height) > 30
            assert abs(width-height) <= 2, f"Distorted circle: {width}x{height}"
            images.append({"pdf": str(pdf.relative_to(source)), "pdfSha256": sha(pdf), "page": number, "raster": png.name, "rasterSha256": sha(png), "circleWidthPx": width, "circleHeightPx": height, "circleUndistorted": True, "legendPresent": True})
            found += 1
        assert found == 3, (pdf, found)
        for number in sorted({1, 2, pages}):
            raster(pdf, number)
    elif pdf.stem in {"gruppe-320x700-a4", "MysteryBoard-Druck-220"}:
        relations = next((i for i, part in enumerate(parts, 1) if "Vollständige Beziehungen" in part), pages)
        for number in sorted({1, 2, relations, pages}):
            raster(pdf, number)
assert len(images) == 6, "Expected 3 media pages in both A4 and A3"
report = {"files": files, "totalPdfPages": sum(f["pages"] for f in files), "mediaImages": images, "method": "Poppler reads and rasterizes actual PDF bytes; Pillow checks the circle geometry. This does not inspect only the HTML preview."}
(output/"pdf-audit.json").write_text(json.dumps(report, indent=2, ensure_ascii=False)+"\n")
print(json.dumps({"pdfFiles": len(files), "totalPages": report["totalPdfPages"], "undistortedMediaImages": len(images)}, indent=2))
