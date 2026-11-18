"""Create three neutral PDF fixtures with authored artwork and no outside assets."""
from pathlib import Path
from PIL import Image, ImageDraw
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

ROOT = Path(__file__).parent
image = Image.new('RGB', (420, 600), '#ffffff')
canvas_image = ImageDraw.Draw(image)
canvas_image.rectangle((4, 4, 415, 595), outline='#341d55', width=7)
for index, color in enumerate(('#571b84', '#e76023', '#168e7d', '#225eaa')):
    y = 94 + index * 110
    canvas_image.rectangle((50, y, 362, y+51), fill=color)
    canvas_image.text((50, y+66), f'Panel {index+1}   0   50   100', fill='black')
canvas_image.text((60, 29), 'M2 - Four panels', fill='black')
art = ImageReader(image)


def page(name):
    return canvas.Canvas(str(ROOT / name), pagesize=(595, 842), invariant=True)


def text(pdf, x, y, title, note, width=202):
    pdf.rect(x, y, width, 138)
    pdf.setFont('Helvetica-Bold', 13)
    pdf.drawString(x+12, y+111, title)
    pdf.setFont('Helvetica', 10)
    pdf.drawString(x+12, y+87, note)


def graphic(pdf, x=310, y=59, width=250, height=366):
    pdf.rect(x, y, width, height)
    pdf.drawImage(art, x+7, y+5, width-14, height-10)
    pdf.setStrokeColor('#571b84')
    pdf.line(x+3, y+32, x+3, y+81)
    pdf.setStrokeColor('#000000')


def mixed(pdf):
    text(pdf, 36, 590, 'Karte 1', 'Quelltext darf bearbeitet werden.')
    text(pdf, 36, 380, 'Karte 2', 'Diese Karte wird geloescht.')
    text(pdf, 36, 182, 'Karte 3', 'Ein Foto gehoert zum Text.')
    pdf.rect(79, 193, 43, 63)
    pdf.drawImage(art, 83, 196, 35, 56)
    graphic(pdf)


pdf = page('Bildkarten.pdf')
graphic(pdf)
pdf.rect(37, 430, 227, 285)
pdf.setStrokeColor('#2233ad')
pdf.line(60, 480, 225, 650)
pdf.setFillColor('#2233ad')
pdf.rect(92, 500, 109, 62, fill=1)
pdf.save()
pdf = page('Gemischte-Karten.pdf')
mixed(pdf)
pdf.save()
pdf = page('Mehrseitige-Karten.pdf')
text(pdf, 36, 587, 'Karte A', 'Erste Seite.')
text(pdf, 36, 361, 'Karte B', 'Zweite Karte auf Seite eins.')
pdf.showPage()
mixed(pdf)
# Unframed illustration. It must be offered for manual review.
pdf.drawImage(art, 471, 585, 66, 102)
pdf.showPage()
text(pdf, 38, 555, 'Ziel:', 'Beantwortet die Frage als Team.')
pdf.save()
