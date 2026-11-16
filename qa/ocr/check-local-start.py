#!/usr/bin/env python3
import zipfile,tempfile,subprocess,os,sys,urllib.request,hashlib,json,signal
with zipfile.ZipFile('artifacts/MysteryBoard-OCR-Autorenpaket.zip')as z,tempfile.TemporaryDirectory(prefix='ocr-local-start-')as d:
 assert z.testzip()is None;z.extractall(d)
 assert (z.getinfo('START.command').external_attr>>16)&0o111
 process=subprocess.Popen([sys.executable,'start-ocr.py'],cwd=d,env={**os.environ,'BROWSER':'true'},stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 try:
  line=process.stdout.readline();url=line.split('lokal:',1)[1].strip();b=urllib.request.urlopen(url,timeout=15).read();assert b==z.read('app.html')
  model=urllib.request.urlopen(url.replace('app.html','ocr/deu.traineddata.gz'),timeout=15).read();assert model==z.read('ocr/deu.traineddata.gz')
  print(json.dumps({'freshZipExtraction':True,'serverBoundToLoopback':url.startswith('http://127.0.0.1:'),'htmlBytes':len(b),'htmlSha256':hashlib.sha256(b).hexdigest(),'modelBytes':len(model),'modelSha256':hashlib.sha256(model).hexdigest(),'uploads':'none; static GET only'},indent=2))
 finally:
  process.send_signal(signal.SIGINT);process.communicate(timeout=10)
