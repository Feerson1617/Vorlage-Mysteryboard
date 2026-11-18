#!/usr/bin/env python3
"""Private-only full original comparison; output contains copyrighted texts."""
import sys,pathlib,json,re,hashlib
cases=list({c['pdf']:c for c in json.loads(pathlib.Path(sys.argv[1]).read_text())}.values());folder=pathlib.Path(sys.argv[2]);results=[]
def dist(a,b):
 row=list(range(len(b)+1))
 for i,x in enumerate(a,1):
  nextrow=[i]
  for j,y in enumerate(b,1):nextrow.append(min(nextrow[-1]+1,row[j]+1,row[j-1]+(x!=y)))
  row=nextrow
 return row[-1]
norm=lambda s:re.sub(r'\s+',' ',s).strip()
for i,c in enumerate(cases,1):
 raw=json.loads((folder/f'Original-{i}.json').read_text())['raw'];comparisons=[]
 for j,(a,b)in enumerate(zip(raw,c['cards']),1):
  x=norm(a['title']+' '+a['text']+' '+a.get('source',''));y=norm(b['title']+' '+b['text']+' '+b.get('source',''))
  comparisons.append({'card':j,'raw':a,'reference':b,'characterEdits':dist(x,y),'referenceCharacters':len(y)})
 results.append({'alias':f'Original-{i}','inputSha256':hashlib.sha256(pathlib.Path(c['pdf']).read_bytes()).hexdigest(),'actualCards':len(raw),'expectedCards':len(c['cards']),'characterErrorRateWhitespaceNormalized':sum(r['characterEdits']for r in comparisons)/max(1,sum(r['referenceCharacters']for r in comparisons)),'cards':comparisons})
(folder/'Originalvergleich-PRIVAT.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print(json.dumps([{k:v for k,v in r.items()if k!='cards'}for r in results],indent=2))
