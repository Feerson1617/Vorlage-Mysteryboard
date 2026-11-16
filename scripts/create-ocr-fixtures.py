"""Own CC0 synthetic printed cards + photo degradations, never teacher originals."""
from PIL import Image,ImageDraw,ImageFont,ImageEnhance,ImageFilter
from pathlib import Path
import json,math
root=Path('tests/fixtures/ocr');root.mkdir(exist_ok=True)
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
expected={}
def sheet(name,cols,rows,labels,start=1,frames=True):
 w,h=2200,3100;im=Image.new('RGB',(w,h),'white');d=ImageDraw.Draw(im)
 cw=(w-140)//cols;ch=(h-180)//rows;f=ImageFont.truetype(font,26)
 cards=[]
 for i,label in enumerate(labels):
  x=70+(i%cols)*cw;y=80+(i//cols)*ch
  title=f'Karte {label}'
  text=f'1912 prüft Müller die Küste.\n1,5 °C und 2,1 mg/l.\n\n600 Millionen Liter.\nGröße, süßes Öl und Grüße.'
  source='Quelle: Übung 2026.'
  if frames:d.rectangle((x,y,x+cw-12,y+ch-12),outline='black',width=3)
  d.multiline_text((x+24,y+22),title+'\n\n'+text+'\n\n'+source,font=f,fill='black',spacing=7)
  cards.append({'title':title,'text':text,'source':'Übung 2026.'})
 im.save(root/(name+'.png'));expected[name]=cards
 return im
sheet('Raster-A-Seite1',3,5,list(range(1,16)))
sheet('Raster-A-Seite2',3,2,list(range(16,21)))
sheet('Raster-B-16',2,8,list('JGCDEFBHIAKLPNOM'))
sheet('Ohne-Rahmen',2,3,list('ABCDEF'),frames=False)
single=sheet('Einzelkarte',1,1,['Ä'])
base=Image.new('RGB',(1500,1800),'white');draw=ImageDraw.Draw(base);f=ImageFont.truetype(font,30)
for i in range(4):
 x=60+(i%2)*720;y=60+(i//2)*820
 draw.rectangle((x,y,x+660,y+750),outline='black',width=3)
 draw.multiline_text((x+25,y+25),f'Karte {i+1}\n\n1912 prüft Müller die Küste.\nGrüße, Größe und süßes Öl.\n1,5 °C und 2,1 mg/l.\n600 Millionen Liter.\n\nQuelle: Übung 2026.',font=f,fill='black',spacing=16)
base.save(root/'Machbarkeit.png')
expected['Machbarkeit']=[{'title':f'Karte {i+1}','text':'1912 prüft Müller die Küste.\nGrüße, Größe und süßes Öl.\n1,5 °C und 2,1 mg/l.\n600 Millionen Liter.','source':'Übung 2026.'}for i in range(4)]
base.save(root/'Gerades-Foto.jpg',quality=91)
base.rotate(90,expand=True,fillcolor='white').save(root/'Gedrehtes-Foto.png')
base.rotate(3,expand=True,fillcolor='white').save(root/'Schraeges-Foto.png')
ImageEnhance.Contrast(base).enhance(.35).save(root/'Schwacher-Kontrast.png')
base.filter(ImageFilter.GaussianBlur(1.3)).save(root/'Teilweise-unscharf.png')
shade=base.copy();pixels=shade.load()
for y in range(shade.height):
 for x in range(shade.width):
  factor=.45+.55*x/shade.width
  pixels[x,y]=tuple(int(c*factor)for c in pixels[x,y])
shade.save(root/'Schatten.png')
base.resize((600,720)).save(root/'Kleine-Schrift.png')
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
for name,pages in [('Scan-A-20',['Raster-A-Seite1','Raster-A-Seite2']),('Scan-B-16',['Raster-B-16'])]:
 c=canvas.Canvas(str(root/(name+'.pdf')),pagesize=(595,842),invariant=1)
 for p in pages:c.drawImage(ImageReader(str(root/(p+'.png'))),0,0,595,842);c.showPage()
 c.save()
(root/'Solltexte.json').write_text(json.dumps(expected,ensure_ascii=False,indent=2)+'\n')
(root/'LIZENZ.txt').write_text('Alle Testkarten, Texte, Scan-PDFs und Bildvarianten in diesem Verzeichnis: eigene synthetische CC0-Testmaterialien. Keine Original-Unterrichtsdokumente. Schrift: DejaVu Sans, freie Bitstream-Vera-/DejaVu-Lizenz; siehe https://dejavu-fonts.github.io/License.html. Keine OCR-Ausgabe als Solltext verwendet.\n')
base.save(root/'Foto.webp',quality=91)
c=canvas.Canvas(str(root/'Gemischt.pdf'),pagesize=(595,842),invariant=1)
c.setFont('Helvetica',14);c.drawString(50,805,'Karte X');c.drawString(50,780,'Vorhandener Text: 1912 und 2,1 mg/l.')
c.drawImage(ImageReader(base),50,100,480,576);c.showPage();c.save()
