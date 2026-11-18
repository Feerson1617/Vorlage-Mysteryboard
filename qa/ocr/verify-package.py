#!/usr/bin/env python3
import sys,zipfile,hashlib,gzip,tempfile,json,pathlib,xml.etree.ElementTree as E
p=pathlib.Path(sys.argv[1]);expected=json.loads(pathlib.Path(sys.argv[2]).read_text()) if len(sys.argv)>2 else None
with zipfile.ZipFile(p)as z,tempfile.TemporaryDirectory(prefix='ocr-zip-')as folder:
 assert z.testzip() is None
 assert len(z.namelist())==len(set(z.namelist()))
 for n in z.namelist():assert not n.startswith('/') and '..' not in pathlib.PurePosixPath(n).parts
 z.extractall(folder)
 files=[]
 for n in z.namelist():
  b=z.read(n);assert pathlib.Path(folder,n).read_bytes()==b
  files.append({'file':n,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
 assert len(z.read('app.html'))<10000000
 r=E.fromstring(z.read('imsmanifest.xml'));ns={'i':'http://www.imsproject.org/xsd/imscp_rootv1p1p2'}
 assert r.find('i:metadata/i:schemaversion',ns).text=='1.2'
 declared={f.attrib['href']for f in r.findall('i:resources/i:resource/i:file',ns)}
 assert declared=={n for n in z.namelist()if n not in {'imsmanifest.xml','START.command','start-ocr.py','LESEN.txt'}}
 if 'ocr/deu.traineddata.gz'in z.namelist():
  assert len(gzip.decompress(z.read('ocr/deu.traineddata.gz')))>1000000
  assert b'mysteryboard-ocr'in z.read('app.html')
  assert b'cacheMethod: "none"'in z.read('ocr/host.js')
 else:assert b'<meta name="mysteryboard-ocr"'not in z.read('app.html')
 if expected:
  for f in expected:assert next(v for v in files if v['file']==f['name'])['sha256']==f['sha256']
print(json.dumps({'zip':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'crc':'all passed','extraction':'all bytes equal','entries':files},ensure_ascii=False,indent=2))
