"""Optional second DOCX parser check, independent of Mammoth/application code.
Requires the free python-docx package; this is a build/review tool only.
"""
from pathlib import Path
import hashlib
import json
import sys
import zipfile
import docx

root = Path(sys.argv[1] if len(sys.argv) > 1 else '../dateien').resolve()
original = json.loads((root / 'ORIGINAL-INHALTE.json').read_text())
results = []
for key, name in [('A', 'A-Word-12-Karten.docx'), ('B', 'B-Word-Medien-Tabelle.docx')]:
    document = docx.Document(root / name)
    paragraphs = [p.text for p in document.paragraphs if p.text]
    for card in original[key]:
        for text in [card['title'], *card['paragraphs'], *card.get('bullets', []), 'Quelle: ' + card['source']]:
            assert text in paragraphs, (name, text)
    if key == 'B':
        assert len(document.tables) == 1 and len(document.inline_shapes) == 2
        table = [[c.text for c in row.cells] for row in document.tables[0].rows]
        assert table == [original['table']['headers'], *original['table']['rows']]
    with zipfile.ZipFile(root / name) as archive:
        assert archive.testzip() is None
        media = [archive.read(p) for p in archive.namelist() if p.startswith('word/media/')]
        expected = [(root / c['image']).read_bytes() for c in original[key] if c.get('image')]
        assert sorted(hashlib.sha256(b).hexdigest() for b in media) == sorted(hashlib.sha256(b).hexdigest() for b in expected)
    results.append({'file': name, 'originalCards': len(original[key]), 'paragraphs': len(paragraphs),
                    'tables': len(document.tables), 'images': len(document.inline_shapes),
                    'allOriginalFieldsAndImages': 'matched'})
print(json.dumps({'status': 'passed', 'parser': 'python-docx ' + docx.__version__,
                   'note': 'Independent structural/data check, not Microsoft Word layout certification.',
                   'files': results}, indent=2))
