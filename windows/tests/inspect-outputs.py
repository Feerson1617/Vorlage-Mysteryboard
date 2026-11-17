"""Independent file inspection; does not call MysteryBoard's codecs/renderers."""
import importlib.util,json,re,sys,zipfile
from pathlib import Path
import fitz
root=Path(sys.argv[1]).resolve()
native=root/'portable'; players=root/'players'
assert json.loads((native/'Testergebnisse.json').read_text())['passed']
normalize=lambda text:re.sub(r'\s+',' ',text).strip()
results=[]
for n,width,height in [(5,595.28,841.89),(12,595.28,841.89),(16,1190.55,841.89),(20,841.89,595.28),(60,841.89,1190.55)]:
 project=json.loads((native/f'Studio-{n}-gespeichert.mysteryboard').read_text())
 doc=fitz.open(native/f'Studio-{n}-Karten.pdf'); pages=[normalize(p.get_text()) for p in doc]
 for card in project['content']['cards']:
  for field in ['title','text','source']:
   assert normalize(card.get(field,'')) in ' '.join(pages),(n,card['id'],field)
  assert any(normalize(card['title']) in p and normalize(card['text']) in p for p in pages),(n,'split card')
 checks=[]
 for i,p in enumerate(doc):
  assert abs(p.rect.width-width)<2 and abs(p.rect.height-height)<2
  assert not [w for w in p.get_text('words') if w[0]<-1 or w[1]<-1 or w[2]>p.rect.width+1 or w[3]>p.rect.height+1]
  out=root/'PDF-Seiten';out.mkdir(exist_ok=True)
  p.get_pixmap(matrix=fitz.Matrix(.7,.7)).save(out/f'{n}-Seite-{i+1:02}.png')
  checks.append({'page':i+1,'words':len(p.get_text('words')),'fonts':len(p.get_fonts()),'images':len(p.get_images()),'vectors':len(p.get_drawings())})
 assert any(p['images']>0 for p in checks), 'Embedded original diagram missing'
 results.append({'cards':n,'passed':True,'pages':checks,'everyPageRendered':True,'fullTextsAndSources':True,'noCardSplit':True,'widthPt':width,'heightPt':height})
(root/'PDF-Originalpruefung.json').write_text(json.dumps(results,indent=2)+'\n')
# Existing independent PNG auditor checks CRC, embedded digest, full task/media,
# direction, manifest, no LMSSetValue and six new-session restorations.
import subprocess
subprocess.run([sys.executable,'qa/studio/check-pngs.py',str(players)],check=True)
print('Independent PDF and PNG/SCORM inspection passed')
