"""Fetch a successful native Actions artifact and verify the real binary ZIP.

python windows/fetch-delivery.py RUN_ID OUTPUT_DIRECTORY
No release, no repository mutation, no HTML preview download.
"""
from pathlib import Path
import hashlib,json,shutil,struct,subprocess,sys,zipfile
run_id=sys.argv[1];out=Path(sys.argv[2]).resolve();out.mkdir(parents=True,exist_ok=True)
repo='Feerson1617/Vorlage-Mysteryboard'
api=lambda suffix:json.loads(subprocess.check_output(['gh','api',f'repos/{repo}/{suffix}']))
run=api('actions/runs/'+run_id)
assert run['status']=='completed' and run['conclusion']=='success','Native Windows workflow must pass before delivery'
assert run['head_branch']=='feat/mysteryboard-studio-windows-x64'
artifact,=[a for a in api(f'actions/runs/{run_id}/artifacts')['artifacts'] if not a['expired'] and a['name']=='MysteryBoard-Studio-Windows-x64-'+run['head_sha']]
outer=out/'Windows-Actions-Artefakt.zip'
with outer.open('wb') as f:subprocess.run(['gh','api',f'repos/{repo}/actions/artifacts/{artifact["id"]}/zip'],stdout=f,check=True)
sha=lambda p:hashlib.file_digest(p.open('rb'),'sha256').hexdigest()
digest=sha(outer)
if artifact.get('digest'):assert artifact['digest']=='sha256:'+digest
with zipfile.ZipFile(outer) as z:
 assert z.testzip() is None
 metadata_name,=[n for n in z.namelist() if Path(n).name=='Downloads.json']
 metadata=json.loads(z.read(metadata_name));assert metadata['phase']=='final' and metadata['windowsCommit']==run['head_sha']
 for file in metadata['files']:
  names=[n for n in z.namelist() if Path(n).name==file['file']];assert len(names)==1
  target=out/file['file']
  with z.open(names[0]) as source,target.open('wb') as dest:shutil.copyfileobj(source,dest)
  assert target.stat().st_size==file['bytes'];assert sha(target)==file['sha256']
  if target.suffix=='.zip':assert zipfile.ZipFile(target).testzip() is None
bundle=out/'MysteryBoard-Studio-0.2.0-Windows-x64-KOMPLETTPAKET.zip'
with zipfile.ZipFile(bundle) as z:
 assert z.testzip() is None
 names=z.namelist();assert len(names)==len(set(names))
 top='MysteryBoard-Studio-Windows-x64/'
 summary=json.loads(z.read(top+'Pruefbericht/Testergebnisse.json'))
 assert summary['passed'] and summary['windowsCommit']==run['head_sha']
 assert summary['macOSIntegrity']['changedOriginalFiles']==0
 assert summary['portable']['passed'] and summary['installed']['passed'] and summary['studentRuns']==6
 sums=z.read(top+'SHA256SUMS.txt').decode();listed=set()
 for line in sums.splitlines():
  expected,name=line.split('  ',1);data=z.read(top+name);assert hashlib.sha256(data).hexdigest()==expected,name;listed.add(top+name)
 assert set(names)==listed|{top+'SHA256SUMS.txt'}
 exe=z.read(top+'Portable/MysteryBoard-Studio/MysteryBoard Studio.exe');assert exe[:2]==b'MZ'
 offset=struct.unpack_from('<I',exe,0x3c)[0];assert exe[offset:offset+4]==b'PE\0\0' and struct.unpack_from('<H',exe,offset+4)[0]==0x8664
 with z.open(top+'Portable/MysteryBoard-Studio/resources/app.asar') as f:
  h=f.read(16);header_size=struct.unpack_from('<I',h,4)[0];json_size=struct.unpack_from('<I',h,12)[0]
  header=json.loads(f.read(json_size));assert header_size>json_size
  assert 'main.cjs' in header['files']['studio']['files']['electron']['files']
  for key in ['deu.traineddata.gz','worker.min.js','tesseract-core-lstm.wasm.js']:
   assert header['files']['studio']['files']['dist']['files']['studio']['files']['ocr']['files'][key]['size']>100
 result={'passed':True,'workflow':run['html_url'],'headCommit':run['head_sha'],'baseCommit':summary['baseCommit'],'artifactID':artifact['id'],'artifactSHA256':digest,'providerDigestMatches':bool(artifact.get('digest')),'expiresAt':artifact['expires_at'],'fullBundleSHA256':sha(bundle),'allInternalSHA256':len(listed),'windowsPE':'AMD64','localOCR':'included','macOSUnchanged':True,'actualBinaryDownload':'REST ZIP stream, all CRC and SHA256 verified, no HTML preview','files':metadata['files']}
(out/'Download-Pruefung.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2))
