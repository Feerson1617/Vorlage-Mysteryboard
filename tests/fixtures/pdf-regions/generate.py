"""Own neutral PDF fixtures; no uploaded teaching material is used.
Regenerate with Python 3 + the free ReportLab package.
"""
from pathlib import Path
import json
import textwrap
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

root = Path(__file__).resolve().parent
W, H = A4


def paragraph(c, text, x, y, width=24, centered=False):
    for line in textwrap.wrap(text, width, break_long_words=False):
        (c.drawCentredString if centered else c.drawString)(x, y, line)
        y -= 14
    return y


expected = {'grid': [], 'headings': []}
c = canvas.Canvas(str(root / 'Rahmen-20.pdf'), pagesize=A4, invariant=1)
for page, count in [(1, 15), (2, 5)]:
    c.setFont('Helvetica', 11)
    c.drawString(44, H-32, 'Neutrales Materialblatt - synthetische Messungen')
    c.drawString(44, H-59, 'Welche Beobachtungen lassen sich vergleichen?')
    c.setStrokeColorRGB(.1, .3, .5)
    c.rect(43, H-66, 500, 24)
    top = H-90
    rows = 5 if page == 1 else 2
    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(.7)
    for col in range(4):
        c.line(44+col*166, top, 44+col*166, top-rows*118)
    for row in range(rows+1):
        # Two small interruptions exercise shared, imperfect borders.
        y = top-row*118
        c.line(44, y, 292, y)
        c.line(294, y, 542, y)
    for i in range(count):
        n = (page-1)*15+i+1
        text = f'Feld {n}: Der Messwert ist {n},50 g bei 12,5 Grad.'
        second = f'Zweiter Absatz in Feld {n}: Alle Werte sind synthetisch.' if n in (2, 3) else None
        expected['grid'].append({'title': '', 'text': text + ('\n\n'+second if second else ''), 'page': page})
        y = paragraph(c, text, 50+(i%3)*166, top-17-(i//3)*118)
        if second:
            paragraph(c, second, 50+(i%3)*166, y-14)
    if page == 2:
        c.drawString(44, top-rows*118-45, 'Arbeitsauftrag:')
        c.drawString(44, top-rows*118-62, '1. Lest die Felder. 2. Vergleicht die Werte. 3. Belegt eure Aussage.')
    c.showPage()
c.save()

labels = ['R', 'A', 'H', 'C', 'T', 'F', 'B', 'J', 'I', 'D', 'K', 'L', 'P', 'N', 'O', 'M']
c = canvas.Canvas(str(root / 'Ohne-Rahmen-16.pdf'), pagesize=A4, invariant=1)
for i, letter in enumerate(labels):
    x, y = 163+(i%2)*270, H-65-(i//2)*88
    c.setFont('Helvetica-Bold', 11)
    c.drawCentredString(x, y, 'Karte '+letter)
    c.setFont('Helvetica', 11)
    text = f'Neutrale Beobachtung {letter}: Diese Messung wurde mit 3,50 g und 12,5 Grad dokumentiert.'
    paragraph(c, text, x, y-18, 31, True)
    expected['headings'].append({'title': 'Karte '+letter, 'text': text, 'page': 1})
c.save()

c = canvas.Canvas(str(root / 'Unklare-Bereiche.pdf'), pagesize=A4, invariant=1)
for i in range(4):
    x, y = 45+(i%2)*280, H-100-(i//2)*200
    c.setFont('Helvetica', 11)
    paragraph(c, f'Unbenannter Textbereich {i+1}. Diese zwei Zeilen bilden einen unsicheren Vorschlag.', x, y, 28)
c.save()
(root / 'ERWARTETE-KARTEN.json').write_text(json.dumps(expected, ensure_ascii=False, indent=2)+'\n')
