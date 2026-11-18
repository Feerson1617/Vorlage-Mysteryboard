"""Package the tested source and neutral touch/PNG acceptance evidence.
Usage: package-touch-review.py OUTPUT.zip SOURCE_COMMIT EVIDENCE_DIR
"""
import base64
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import zipfile

repo = Path(__file__).resolve().parent.parent
out, commit, evidence = Path(sys.argv[1]).resolve(), sys.argv[2], Path(sys.argv[3]).resolve()
assert not out.exists()
payloads = {}
def add(name, path):
    assert name not in payloads and not Path(name).is_absolute() and '..' not in Path(name).parts
    payloads[name] = path.read_bytes()

for name in ['MysteryBoard-Universal.html', 'MysteryBoard-Universal-SCORM-1.2.zip']:
    add(name, repo / 'artifacts' / name)
downloads = evidence / 'downloads'
add('MysteryBoard-Unterrichtsbeispiel-SCORM-1.2.zip', downloads / 'Unterrichtsbeispiel-1024-SCORM-1.2.zip')
helper = repo / 'qa/classroom-scorm/verify-delivery.py'
spec = importlib.util.spec_from_file_location('independent_png', helper)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
with zipfile.ZipFile(downloads / 'Unterrichtsbeispiel-1024-SCORM-1.2.zip') as archive:
    assert archive.testzip() is None
    app = module.HTML(archive.read('app.html').decode())
    task = json.loads(base64.b64decode(app.bootstrap[0]['task'], validate=True))
payloads['MysteryBoard-Unterrichtsbeispiel.mysteryboard'] = (json.dumps(task, ensure_ascii=False, indent=2) + '\n').encode()
add('Team Nordseeküste_Strömungen und Küsten – Übungsaufgabe.png', downloads / 'html-1024-Original.png')
add('TOUCH-UND-PNG-PRUEFBERICHT.md', repo / 'docs/TOUCH-UND-PNG-PRUEFBERICHT.md')
add('ABNAHME-START.md', repo / 'qa/touch-saving/ABNAHME-START.md')
# Only new neutral evidence. Never collects the private original PDF directories.
prefixes = ('html-', 'universal-scorm-', 'classroom-scorm-', 'race-', 'resize-', 'two-drags-', 'undo-', 'stress-', 'text-bild-', 'pfeile-touch-', 'nach-Fehlschlag', 'automatischer-PNG-')
omitted = []
for path in downloads.iterdir():
    if not path.is_file() or not path.name.startswith(prefixes):
        continue
    if path.suffix == '.json' or (path.suffix == '.png' and ('-1024-' in path.name or 'sichtbare-pfeile' in path.name or path.name.startswith(('pfeile-touch-', 'nach-Fehlschlag', 'automatischer-PNG-')))):
        add('browserdownloads/' + path.name, path)
    elif path.suffix == '.png':
        omitted.append({'file': path.name, 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'note': 'additional viewport PNG not repeated; full decoded data and actual browser protocol included'})
for path in evidence.iterdir():
    if path.is_file() and path.suffix in ('.json', '.txt', '.log', '.diff'):
        add('pruefprotokolle/' + path.name, path)
for path in (evidence / 'baseline').glob('*.json'):
    add('pruefprotokolle/baseline/' + path.name, path)
for path in (evidence / 'driver-probe').glob('*.json'):
    add('pruefprotokolle/driver-probe/' + path.name, path)
for path in (evidence / 'arrow-tracking').iterdir():
    if path.is_file() and path.suffix in ('.json', '.png'):
        add('pfeile-waehrend-drag/' + path.name, path)
payloads['WEITERE-ANSICHTSGROESSEN.json'] = (json.dumps(omitted, ensure_ascii=False, indent=2) + '\n').encode()
names = subprocess.check_output(['git', '-C', str(repo), 'ls-tree', '-r', '--name-only', commit], text=True).splitlines()
names = [n for n in names if not n.startswith(('artifacts/', 'docs/test-evidence/'))]
names += ['artifacts/MysteryBoard-Boden-Klasse11.html', 'artifacts/MysteryBoard-Boden-Klasse11-RC2.html', 'artifacts/MysteryBoard-Boden-Klasse11-RC2-SCORM-1.2.zip']
for name in names:
    payloads['projekt/' + name] = subprocess.check_output(['git', '-C', str(repo), 'show', commit + ':' + name])
version = {'sourceCommit': commit, 'branch': 'fix/mysteryboard-touch-png-saving', 'baseCommit': '50c6b59e8688abea8863eb27f2753840f2391df5', 'documentFormatVersion': 3, 'containsUploadedOriginals': False, 'realSafariSchoolIpadItslearningAcceptance': 'open'}
payloads['VERSION.json'] = (json.dumps(version, indent=2) + '\n').encode()
payloads['projekt/PROJECT-VERSION.json'] = payloads['VERSION.json']
result = json.loads((evidence / 'final-summary.json').read_text())
result['sourceCommit'] = commit
payloads['ERGEBNIS.json'] = (json.dumps(result, ensure_ascii=False, indent=2) + '\n').encode()
entries = [{'file': n, 'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest()} for n, b in sorted(payloads.items())]
payloads['PRUEFSUMMEN.json'] = (json.dumps(entries, ensure_ascii=False, indent=2) + '\n').encode()
payloads['SHA256SUMS.txt'] = ''.join(e['sha256']+'  '+e['file']+'\n' for e in entries).encode()
out.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name, data in sorted(payloads.items()):
        archive.writestr(name, data)
with zipfile.ZipFile(out) as archive:
    assert archive.testzip() is None
    for entry in entries:
        assert hashlib.sha256(archive.read(entry['file'])).hexdigest() == entry['sha256']
info = {'file': out.name, 'bytes': out.stat().st_size, 'sha256': hashlib.sha256(out.read_bytes()).hexdigest(), 'sourceCommit': commit, 'entries': len(payloads), 'zipCrc': 'passed', 'allEntryChecksums': 'passed', 'containsUploadedOriginals': False}
out.with_suffix('.integrity.json').write_text(json.dumps(info, indent=2) + '\n')
print(json.dumps(info, indent=2))
