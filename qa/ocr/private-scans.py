#!/usr/bin/env python3
"""Rasterize supplied private originals to image-only PDFs. Output stays outside git."""
import sys,pathlib,json,fitz
source=pathlib.Path(sys.argv[1]);target=pathlib.Path(sys.argv[2]);target.mkdir(parents=True,exist_ok=True)
cases=list({c['pdf']:c for c in json.loads(source.read_text())}.values());out=[]
for i,c in enumerate(cases):
 p=fitz.open(c['pdf']);d=fitz.open()
 for page in p:
  pix=page.get_pixmap(matrix=fitz.Matrix(2.7,2.7),alpha=False)
  q=d.new_page(width=page.rect.width,height=page.rect.height);q.insert_image(q.rect,stream=pix.tobytes('png'))
 path=target/f'Original-{i+1}-Scan.pdf';d.save(path,garbage=4,deflate=True);d.close();p.close()
 out.append({'alias':f'Original-{i+1}','file':str(path),'cards':len(c['cards']),'pages':len(c['pages']),'titles':[k['title']for k in c['cards']]})
(target/'scan-cases.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
print(json.dumps([{k:v for k,v in c.items()if k!='titles'}for c in out],indent=2))
