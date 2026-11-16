#!/usr/bin/env python3
"""Independent OCR transcript comparison. Does not alter runtime or OCR text."""
import sys,json,pathlib,re
root=pathlib.Path(sys.argv[1]);expected=json.loads(pathlib.Path('tests/fixtures/ocr/Solltexte.json').read_text())
def distance(a,b):
 row=list(range(len(b)+1))
 for i,x in enumerate(a,1):
  nxt=[i]
  for j,y in enumerate(b,1):nxt.append(min(nxt[-1]+1,row[j]+1,row[j-1]+(x!=y)))
  row=nxt
 return row[-1]
norm=lambda s:re.sub(r'\s+',' ',s).strip()
result=[]
for file,keys in [('Scan-A-20.pdf.json',['Raster-A-Seite1','Raster-A-Seite2']),('Scan-B-16.pdf.json',['Raster-B-16'])]:
 if not(root/file).exists():continue
 raw=json.loads((root/file).read_text())['cards'];gold=sum([expected[k]for k in keys],[]);cards=[]
 for i,(r,g)in enumerate(zip(raw,gold)):
  a=norm(r['title']+' '+r['text']+' '+r['source']);b=norm(g['title']+' '+g['text']+' '+g['source']);n=distance(a,b)
  cards.append({'card':i+1,'raw':r,'expected':g,'characterEdits':n,'referenceCharacters':len(b),'exactText':r['text']==g['text'],'exactTitle':r['title']==g['title'],'critical':{v:v in r['text']for v in ['1912','1,5 °C','2,1 mg/l','600 Millionen Liter']},'paragraphsRaw':r['text'].split('\n\n'),'paragraphsExpected':g['text'].split('\n\n')})
 edits=sum(c['characterEdits']for c in cards);length=sum(c['referenceCharacters']for c in cards)
 result.append({'file':file,'countActual':len(raw),'countExpected':len(gold),'characterErrorRateWhitespaceNormalized':edits/length if length else None,'rawExactTextCards':sum(c['exactText']for c in cards),'rawExactTitles':sum(c['exactTitle']for c in cards),'cards':cards})
corrections=[]
for file,key in [('Korrigiert-Gerades-Foto.jpg.json','Machbarkeit'),('Korrigiert-Scan-B-16.pdf.json','Raster-B-16')]:
 if not(root/file).exists():continue
 actual=json.loads((root/file).read_text());gold=expected[key]
 comparison=[{'card':i+1,'title':a['title']==b['title'],'text':a['text']==b['text'],'source':a['source']==b['source']}for i,(a,b)in enumerate(zip(actual,gold))]
 corrections.append({'file':file,'countActual':len(actual),'countExpected':len(gold),'allReferenceFieldsExact':len(actual)==len(gold)and all(all(c[k]for k in ['title','text','source'])for c in comparison),'cards':comparison,'stage':'after explicit GUI correction, before two intentional editor changes'})
print(json.dumps({'raw':result,'afterManualCorrection':corrections},ensure_ascii=False,indent=2))
