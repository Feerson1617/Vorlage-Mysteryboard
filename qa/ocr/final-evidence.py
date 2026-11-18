#!/usr/bin/env python3
import pathlib,hashlib,json,re,subprocess,platform,sys
root=pathlib.Path.cwd();out=pathlib.Path(sys.argv[1]);private=pathlib.Path(sys.argv[2])
assert(out/'final-checks-complete.txt').is_file()
log=(out/'full-check.log').read_text();rc=(out/'rc2.log').read_text();wk=(out/'webkit-final.log').read_text()
assert re.search(r'Tests\s+165 passed',log)and re.search(r'\b272 passed \(',log)
assert re.search(r'\b4 passed \(',rc)and re.search(r'\b5 passed \(',wk)
legacy=(private/'legacy-pdf-regression.log').read_text();raster=(private/'test-final.log').read_text();assert re.search(r'\b8 passed \(',legacy)and re.search(r'\b1 passed \(',raster)
versions={name:subprocess.check_output(['node','-p',f'require("./node_modules/{name}/package.json").version'],text=True).strip()for name in['react','tesseract.js','tesseract.js-core','@tesseract.js-data/deu','pdfjs-dist','@playwright/test','vite','vitest','typescript']}
files=[]
for p in sorted((root/'artifacts').glob('MysteryBoard*.html')):
 b=p.read_bytes();assert len(b)<10_000_000;files.append({'file':p.name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
for p in sorted((root/'artifacts').glob('*OCR*.zip')):
 b=p.read_bytes();files.append({'file':p.name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
for p in sorted((root/'src').rglob('*')):
 if p.is_file():
  expected=next(f for f in json.loads((out/'runtime-files-tested.json').read_text())if f['file']==str(p.relative_to(root)));assert hashlib.sha256(p.read_bytes()).hexdigest()==expected['sha256'],p
private_summary=[]
for i in[1,2]:
 p=private/f'Original-{i}-Scan.pdf';d=json.loads((private/f'Original-{i}.json').read_text());private_summary.append({'case':f'Original-{i}','scanBytes':p.stat().st_size,'scanSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'cards':len(d['raw']),'fullEvidence':'private supplement only; no original text in public package'})
result={'branch':'feat/mysteryboard-offline-ocr','baseCommit':'9740c7120bd2c80d06bd158b7276f696c30b67d7','checks':{'data':'165 passed (24 files)','chromium':'272 passed','frozenRC2':'4 passed','webkit27_2':'5 actual OCR-SCORM browser checks passed','privateFastOriginalPDFs':'8 passed','privateImageOnlyScans':'1 test, both 20/16 cases passed'},'versions':versions,'node':subprocess.check_output(['node','--version'],text=True).strip(),'python':platform.python_version(),'files':files,'privateOriginalSummary':private_summary,'notPerformed':['WebKit 26.5 (not available)','real managed school iPad','real Safari/M1 device performance','real itslearning installation','real school camera photographs'],'syntheticPhotoConditions':True,'originalTestsByteIdentical':json.loads((out/'existing-tests-unchanged.json').read_text()),'sourceRuntimeHashCheck':'all src files equal tested snapshot','merge':False,'pagesOrReleaseDeployment':False}
(out/'ABSCHLUSS.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result['checks'],indent=2))
