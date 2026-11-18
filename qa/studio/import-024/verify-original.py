"""Independent reference: manually selected rectangles, PyMuPDF text and full image."""
import hashlib, json, re, sys, unicodedata
from pathlib import Path
import fitz
from PIL import Image, ImageChops, ImageStat
pdf,out=map(Path,sys.argv[1:])
ref=json.loads(Path(__file__).with_name('original-reference.json').read_text())
assert hashlib.sha256(pdf.read_bytes()).hexdigest()==ref['sha256']
measured=json.loads((out/'Originalabgleich-privat.json').read_text())
def letters(text):
    return ''.join(c for c in unicodedata.normalize('NFKC',text) if not c.isspace() and c!='\xad')
doc=fitz.open(pdf)
assert len(doc)==3
proof=[]
for p,cards in zip(doc,measured):
    for card in cards:
        reference=fitz.Rect(card['ref'])
        items=p.get_text('words',clip=reference)
        words=''.join(t[4] for t in items)
        if not words.strip(): continue
        a,b=letters(words),letters(card['text'])
        assert a==b,(p.number+1,card['id'],len(a),len(b))
        proof.append({'page':p.number+1,'card':card['id'],'characters':len(a),'textSha256':hashlib.sha256(a.encode()).hexdigest()})
assert len(proof)==31
frame=fitz.Rect(ref['m2']); page=doc[1]; image,=page.get_image_info(); area=fitz.Rect(image['bbox'])
assert [image['width'],image['height']]==ref['m2Pixels'] and max(abs(v-w) for v,w in zip(area,ref['m2Placement']))<1
pm=page.get_pixmap(matrix=fitz.Matrix(4,4),clip=frame,alpha=False)
expected=Image.frombytes('RGB',(pm.width,pm.height),pm.samples)
actual=Image.open(next(out.glob('Uebernommene-Bildkarte.*'))).convert('RGB')
assert abs(actual.width/actual.height-frame.width/frame.height)<.002
rel=[(area.x0-frame.x0)/frame.width,(area.y0-frame.y0)/frame.height,(area.x1-frame.x0)/frame.width,(area.y1-frame.y0)/frame.height]
def crop(im): return im.crop(tuple(round(v*im.size[i%2]) for i,v in enumerate(rel))).resize((864,1302),Image.Resampling.LANCZOS)
diff=ImageChops.difference(crop(expected),crop(actual))
panels=[max(ImageStat.Stat(diff.crop((x,y,x+432,y+434))).mean) for y in (0,434,868) for x in (0,432)]
assert max(panels)<12,panels
report={'pdfSha256':ref['sha256'],'regions':[len(c) for c in measured],'matchedText':proof,'m2Size':actual.size,'sixPanelMaxChannelMAE':panels,'passed':True}
(out/'P01-Messwerte.json').write_text(json.dumps(report,indent=2)+'\n')
