"""Independent native PDF inspection. Requires PyMuPDF only for QA, never Studio.

python3 qa/studio/check-pdfs.py EVIDENCE_DIRECTORY
Renders every native PDF page and compares actual PDF text with saved projects.
"""
import json
import re
import sys
from pathlib import Path

import fitz

root = Path(sys.argv[1]).resolve()
out = root / 'Mac' / 'PDF-Seiten'
out.mkdir(parents=True, exist_ok=True)
rows = []
normalize = lambda text: re.sub(r'\s+', ' ', text).strip()
for n, fmt, width, height in [
    (5, 'A4 Hochformat', 595.28, 841.89),
    (16, 'A3 Querformat', 1190.55, 841.89),
    (20, 'A4 Querformat', 841.89, 595.28),
    (60, 'A3 Hochformat', 841.89, 1190.55),
]:
    path = root / 'Mac' / f'Studio-{n}-Karten.pdf'
    project = json.loads((root / 'Mac' / f'Studio-{n}-gespeichert.mysteryboard').read_text())
    doc = fitz.open(path)
    pages = [page.get_text() for page in doc]
    combined = normalize(' '.join(pages))
    for card in project['content']['cards']:
        # Exact original heading, factual text and source must survive.
        for field in ['title', 'text', 'source']:
            expected = normalize(card.get(field, ''))
            assert expected in combined, (n, card['id'], field, expected)
        # All of a card's text must be on one page.
        assert any(normalize(card['title']) in normalize(p) and
                   normalize(card['text']) in normalize(p) for p in pages), (n, card['id'], 'split card')
    checks = []
    for i, page in enumerate(doc):
        assert abs(page.rect.width-width) < 2 and abs(page.rect.height-height) < 2
        outside = [w for w in page.get_text('words') if
                   w[0] < -1 or w[1] < -1 or w[2] > page.rect.width+1 or w[3] > page.rect.height+1]
        assert not outside, (n, i+1, outside)
        page.get_pixmap(matrix=fitz.Matrix(.7, .7)).save(out / f'{n}-Seite-{i+1:02}.png')
        checks.append(dict(page=i+1, widthPt=page.rect.width, heightPt=page.rect.height,
                           words=len(page.get_text('words')), fonts=len(page.get_fonts()),
                           vectors=len(page.get_drawings()), images=len(page.get_images()), outsidePage=0))
    assert all(p['fonts'] > 0 for p in checks)
    assert all(p['vectors'] > 0 for p in checks[1:])
    rows.append(dict(file=path.name, cards=n, format=fmt, pages=len(doc),
                     everyPageRendered=True, allOriginalTextsPresent=True,
                     noCardSplitBetweenPages=True, pageChecks=checks))
(root / 'Mac-PDF-Originalpruefung.json').write_text(json.dumps(rows, indent=2)+'\n')
print(json.dumps([dict(file=r['file'], pages=r['pages'], cards=r['cards']) for r in rows]))
limits = root / 'PDF-Grenzpruefung.json'
if limits.exists():
    cases = json.loads(limits.read_text())
    for case in cases:
        pdf = root / ('PDF-' + case['name'] + '.pdf')
        if not case['exported']:
            assert not pdf.exists(), 'Rejected card must not produce a partial PDF'
            continue
        draft = json.loads((root / ('PDF-' + case['name'] + '.mysteryboard')).read_text())
        doc = fitz.open(pdf)
        text = normalize(draft['content']['cards'][0]['text'])
        assert any(text in normalize(p.get_text()) for p in doc), 'Long card clipped or split'
        assert any('LiberationSerif' in str(p.get_fonts()) for p in doc), 'Chosen font not embedded'
        for i, page in enumerate(doc):
            page.get_pixmap(matrix=fitz.Matrix(.7, .7)).save(root / f"PDF-{case['name']}-Seite-{i+1}.png")
        case.update(fullOriginalTextOnOnePage=True, serifFontEmbedded=True, allPagesRendered=True)
    (root / 'PDF-Grenzpruefung-unabhaengig.json').write_text(json.dumps(cases, ensure_ascii=False, indent=2)+'\n')
