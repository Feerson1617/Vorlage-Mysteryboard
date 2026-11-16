#!/usr/bin/env python3
"""Package sealed runtime/test bytes; never rebuild the application here."""
import sys,pathlib,subprocess,json,hashlib,zipfile,datetime
out=pathlib.Path(sys.argv[1]);commit=sys.argv[2];evidence=pathlib.Path(sys.argv[3]);root=pathlib.Path.cwd()
assert (evidence/'final-checks-complete.txt').is_file(),'Finish all checks before sealing delivery'
payload={}
def add(name,source):
 b=source.read_bytes() if isinstance(source,pathlib.Path)else source
 assert name not in payload,name
 payload[name]=b
# Every runtime file is the artifact actually opened by the browser tests.
for name in ['MysteryBoard-Universal.html','MysteryBoard-Universal-SCORM-1.2.zip','MysteryBoard-OCR-Autorenpaket.zip','MysteryBoard-OCR-SCORM-1.2.zip']:
 add('Anwendungen/'+name,root/'artifacts'/name)
for source,name in [('OCR-Gerades-Foto.jpg-Unterricht-SCORM.zip','MysteryBoard-OCR-Beispiel-SCORM-1.2.zip'),('OCR-Gerades-Foto.jpg-Entwurf.mysteryboard','OCR-Beispiel-Lehrkraftentwurf.mysteryboard'),('OCR-Gerades-Foto.jpg-Original.png','Team Küste_Lokale OCR – neutrale Übung.png')]:
 add('Beispiel/'+name,evidence/source)
paths=subprocess.check_output(['git','ls-tree','-r','--name-only',commit],text=True).splitlines()
source_dirs=('src/','tests/','scripts/','schemas/','examples/','scorm/','ocr/','qa/')
frozen={'artifacts/MysteryBoard-Boden-Klasse11.html','artifacts/MysteryBoard-Boden-Klasse11-RC2.html','artifacts/MysteryBoard-Boden-Klasse11-RC2-SCORM-1.2.zip'}
for p in paths:
 if p.startswith(source_dirs)or p in frozen or p in {'docs/LOKALE-OCR.md','docs/OCR-ABNAHMEBERICHT.md'}or('/'not in p and not p.endswith('.zip')):
  add('Quellcode/'+p,subprocess.check_output(['git','show',commit+':'+p]))
for p in sorted(evidence.iterdir()):
 if p.is_file()and p.suffix in {'.json','.log','.png','.txt'}:
  # No private directory is traversed. All public evidence uses our own sheets.
  add('Pruefnachweise/'+p.name,p)
for p in sorted((root/'tests/fixtures/ocr').iterdir()):
 if p.is_file():add('Testmaterial/'+p.name,p)
for name in ['LOKALE-OCR.md','OCR-ABNAHMEBERICHT.md']:add(name,root/'docs'/name)
version={'sourceCommit':commit,'baseCommit':'9740c7120bd2c80d06bd158b7276f696c30b67d7','branch':'feat/mysteryboard-offline-ocr','contentFormat':3,'privateOriginalsIncluded':False,'realSafariSchoolIpadItslearningAcceptance':'open','runtimeFiles':[]}
for name,b in payload.items():
 if name.startswith(('Anwendungen/','Beispiel/')):version['runtimeFiles'].append({'file':name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
add('VERSION.json',(json.dumps(version,ensure_ascii=False,indent=2)+'\n').encode())
add('START-HIER.md',('''# MysteryBoard – lokale OCR

Für itslearning das unveränderte `Anwendungen/MysteryBoard-OCR-SCORM-1.2.zip` als SCORM 1.2 importieren. Es enthält den universellen Editor und sämtliche lokalen OCR-Dateien.

Für den lokalen Computer `MysteryBoard-OCR-Autorenpaket.zip` vollständig entpacken und `python3 start-ocr.py` ausführen (Python 3 kostenlos). Auf dem Mac ist START.command als Starthilfe enthalten. Die mehrteilige OCR-Fassung benötigt diesen lokalen Server; die normale Universal-HTML funktioniert weiterhin ohne OCR-Zusatzdateien.

`Beispiel/` enthält einen tatsächlich im Browser erzeugten Entwurf, sein schlankes Unterrichts-SCORM ohne OCR-Dateien und eine tatsächlich gesicherte Schüler-PNG. Die Quellen und alle ursprünglichen Tests stehen in `Quellcode/`.

`OCR-ABNAHMEBERICHT.md` nennt Messergebnisse, Fehlergrenzen und offene reale Geräte-/LMS-Tests. Testfotos sind eigene synthetische Bildbedingungen; keine echte Kameraabnahme. OCR ist kein fachlicher Prüfer. Jede Karte, Zahl, Quelle und Bezeichnung am Original kontrollieren.

Die eingefrorene Boden-RC2 und main wurden nicht verändert. Kein Release, keine Pages-Veröffentlichung, kein Merge. Private Unterrichtsoriginale sind nicht in diesem öffentlich bereitstellbaren Paket enthalten.

Integrität prüfen: `python3 Pruefen.py` im entpackten Ordner. Entwicklungsprüfung: `npm ci` und `npm run check` im Quellcode-Ordner (Node 24, Python 3, Chromium/Playwright erforderlich). Die fertige Autorenfassung benötigt npm nicht. Detaillierte Befehle stehen im Prüfbericht.
''').encode())
add('Pruefen.py',('''#!/usr/bin/env python3
import pathlib,json,hashlib,zipfile,tempfile
root=pathlib.Path(__file__).resolve().parent
manifest=json.loads((root/'MANIFEST.json').read_text())
for f in manifest:
 p=root/f['file'];assert p.is_file(),f['file'];b=p.read_bytes();assert len(b)==f['bytes'] and hashlib.sha256(b).hexdigest()==f['sha256'],f['file']
for p in list((root/'Anwendungen').glob('*.zip'))+list((root/'Beispiel').glob('*.zip')):
 with zipfile.ZipFile(p)as z,tempfile.TemporaryDirectory(prefix='ocr-check-')as folder:
  assert z.testzip()is None;z.extractall(folder)
  for n in z.namelist():assert pathlib.Path(folder,n).read_bytes()==z.read(n)
print(str(len(manifest))+' Dateien SHA-256-geprüft; alle Produkt-ZIPs vollständig und CRC-fehlerfrei entpackt.')
''').encode())
manifest=[{'file':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}for p,b in sorted(payload.items())]
add('MANIFEST.json',(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode())
add('SHA256SUMS',(''.join(f"{f['sha256']}  {f['file']}\n"for f in manifest)).encode())
out.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9)as z:
 for name,b in sorted(payload.items()):
  info=zipfile.ZipInfo(name,(2026,11,16,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.create_system=3;info.external_attr=0o100644<<16;z.writestr(info,b)
with zipfile.ZipFile(out)as z:assert z.testzip()is None;assert len(z.namelist())==len(payload)
print(json.dumps({'file':str(out),'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'entries':len(payload),'sourceCommit':commit},indent=2))
