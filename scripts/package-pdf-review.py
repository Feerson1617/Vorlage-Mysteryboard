"""Public, neutral acceptance package. Never collects private PDFs or outputs.
Usage: python3 scripts/package-pdf-review.py OUTPUT.zip SOURCE_COMMIT EVIDENCE_DIR
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
output, commit, evidence = Path(sys.argv[1]).resolve(), sys.argv[2], Path(sys.argv[3]).resolve()
assert not output.exists()
downloads = evidence / 'downloads'
payloads = {}


def add(name, path):
    assert name not in payloads and not name.startswith('/') and '..' not in Path(name).parts
    payloads[name] = path.read_bytes()


for name in ('MysteryBoard-Universal.html', 'MysteryBoard-Universal-SCORM-1.2.zip'):
    add(name, root / 'artifacts' / name)
for alias, label in (('Rahmen20', 'Neutrale-20-Karten'), ('OhneRahmen16', 'Neutrale-16-Karten')):
    add(f'MysteryBoard-{label}-SCORM-1.2.zip', downloads / f'{alias}-1024-SCORM-1.2.zip')
    add(f'MysteryBoard-{label}.mysteryboard', downloads / f'{alias}-1024-aufgabe.mysteryboard')
for name in ('PDF-KARTEN-UND-PFEILE-ANLEITUNG.md', 'PDF-KARTEN-UND-PFEILE-PRUEFBERICHT.md'):
    add(name, root / 'docs' / name)
add('ABNAHME-START.md', root / 'qa/pdf-regions/ABNAHME-START.md')
for path in (root / 'tests/fixtures/pdf-regions').iterdir():
    if path.is_file() and path.suffix in ('.pdf', '.json', '.md'):
        add('testdateien/' + path.name, path)
# Explicit allowlists: an Original* output can never enter this public archive.
prefixes = ('Rahmen20-', 'OhneRahmen16-', 'regionen-Rahmen20-', 'regionen-OhneRahmen16-', 'html-', 'universal-scorm-', 'classroom-scorm-')
for path in downloads.iterdir():
    if path.is_file() and path.name.startswith(prefixes) and path.suffix.lower() != '.zip':
        add('browserdownloads/' + path.name, path)
for path in evidence.iterdir():
    if path.is_file() and path.suffix in ('.log', '.txt', '.json'):
        add('pruefprotokolle/' + path.name, path)
for path in (root / 'test-results').glob('pdf-regions-manual*/*.png'):
    add('screenshots/' + path.parent.name + '/' + path.name, path)
files = subprocess.check_output(['git', '-C', str(root), 'ls-tree', '-r', '--name-only', commit], text=True).splitlines()
files = [name for name in files if not name.startswith(('artifacts/', 'docs/test-evidence/'))]
files += ['artifacts/MysteryBoard-Boden-Klasse11.html', 'artifacts/MysteryBoard-Boden-Klasse11-RC2.html', 'artifacts/MysteryBoard-Boden-Klasse11-RC2-SCORM-1.2.zip']
for name in files:
    payloads['projekt/' + name] = subprocess.check_output(['git', '-C', str(root), 'show', commit + ':' + name])
version = {'sourceCommit': commit, 'sourceBranch': 'fix/mysteryboard-pdf-multiple-cards', 'baseCommit': 'b35aa16f41fe1f2bb7557ef42c9140723ed9d203', 'documentFormatVersion': 3, 'containsUploadedOriginals': False, 'containsDerivedOriginalTasks': False, 'schoolIpadSafariItslearningAcceptance': 'open'}
payloads['VERSION.json'] = (json.dumps(version, indent=2)+'\n').encode()
payloads['projekt/PROJECT-VERSION.json'] = payloads['VERSION.json']
result = json.loads((evidence / 'final-summary.json').read_text())
result['sourceCommit'] = commit
payloads['ERGEBNIS.json'] = (json.dumps(result, ensure_ascii=False, indent=2)+'\n').encode()
entries = [{'file': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()} for name, data in sorted(payloads.items())]
payloads['PRUEFSUMMEN.json'] = (json.dumps(entries, ensure_ascii=False, indent=2)+'\n').encode()
payloads['SHA256SUMS.txt'] = ''.join(e['sha256']+'  '+e['file']+'\n' for e in entries).encode()
output.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name, data in sorted(payloads.items()):
        archive.writestr(name, data)
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    for entry in entries:
        assert hashlib.sha256(archive.read(entry['file'])).hexdigest() == entry['sha256']
info = {'file': output.name, 'sourceCommit': commit, 'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'entries': len(payloads), 'zipCrc': 'passed', 'allEntryChecksums': 'passed', 'uploadedOriginalsIncluded': False}
output.with_suffix('.integrity.json').write_text(json.dumps(info, indent=2)+'\n')
print(json.dumps(info, indent=2))
