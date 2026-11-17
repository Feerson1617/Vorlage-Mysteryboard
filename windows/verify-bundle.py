"""Verify every delivered byte and safe extraction into a new empty directory."""
from pathlib import Path
import hashlib,json,sys,zipfile
archive,target=Path(sys.argv[1]).resolve(),Path(sys.argv[2]).resolve()
assert not target.exists(),'Extraction directory must be new'
target.mkdir(parents=True)
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 assert len(z.namelist())==len(set(z.namelist()))
 for name in z.namelist():assert (target/name).resolve().is_relative_to(target)
 z.extractall(target)
root,=target.iterdir();listed=set()
for line in (root/'SHA256SUMS.txt').read_text().splitlines():
 expected,name=line.split('  ',1);p=root/name
 assert p.resolve().is_relative_to(root)
 assert hashlib.file_digest(p.open('rb'),'sha256').hexdigest()==expected,name
 listed.add(name)
actual={p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and p.name!='SHA256SUMS.txt'}
assert actual==listed
assert (root/'Installation/MysteryBoard-Studio-0.2.0-Windows-x64-Setup.exe').is_file()
assert (root/'Portable/MysteryBoard-Studio/resources/app.asar').is_file()
assert (root/'Portable/MysteryBoard-Studio/MysteryBoard Studio.exe').is_file()
summary=json.loads((root/'Pruefbericht/Testergebnisse.json').read_text())
if summary['passed']:
 proof=json.loads((root/'Pruefbericht/Identisch-zum-Laufzeittest.json').read_text());assert proof['passed']
 for entry in proof['files']:
  assert hashlib.file_digest((root/entry['file']).open('rb'),'sha256').hexdigest()==entry['sha256']
 assert summary['runtimeTestedPayloadEqual'] and summary['runtimeTestedPayloadFiles']==len(proof['files'])
print(json.dumps({'passed':True,'file':archive.name,'bytes':archive.stat().st_size,'sha256':hashlib.file_digest(archive.open('rb'),'sha256').hexdigest(),'filesChecked':len(listed),'extracted':str(root)},indent=2))
