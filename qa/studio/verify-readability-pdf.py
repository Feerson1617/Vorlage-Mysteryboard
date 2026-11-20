"""Check the actual PDF independently of the application and its print DOM."""
import hashlib
import json
from pathlib import Path
import sys
import unicodedata

import fitz

folder = Path(sys.argv[1])
path = folder / "Vollstaendige-Kartentexte-A4.pdf"
with fitz.open(path) as pdf:
    page_count = len(pdf)
    assert page_count > 1
    assert all(abs(page.rect.width - 841.89) < 1 and abs(page.rect.height - 595.28) < 1 for page in pdf)
    text = "".join(page.get_text() for page in pdf)

flat = "".join(c for c in unicodedata.normalize("NFKC", text) if not c.isspace())
ids = [id for id in range(1, 31) if id % 5 and id != 4]
for id in ids:
    assert f"Endbeleg{id:02d}vollständig." in flat, id
assert "EinkurzerBefund." in flat
assert "UnveränderlicheQuelle" in flat
assert "BeobachtungenzurVersickerungundzumHochwasser" in flat
result = {
    "pages": page_count,
    "endMarkers": ids,
    "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
}
(folder / "PDF-Pruefung.json").write_text(json.dumps(result, indent=2) + "\n")
print(result)
