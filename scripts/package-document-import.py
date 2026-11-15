"""Package the actual local document-import delivery and its reproducible evidence."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
if len(sys.argv) != 2:
    raise SystemExit('Aufruf: python3 scripts/package-document-import.py NEUE-AUSGABE.zip')
output = Path(sys.argv[1]).resolve()
if output.exists() or output.suffix.lower() != '.zip':
    raise SystemExit('Neuen ZIP-Ausgabepfad angeben; vorhandene Dateien werden nicht überschrieben.')
try:
    commit = subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True, stderr=subprocess.DEVNULL).strip()
    branch = subprocess.check_output(['git', '-C', str(root), 'branch', '--show-current'], text=True, stderr=subprocess.DEVNULL).strip()
except (FileNotFoundError, subprocess.CalledProcessError):
    version = json.loads((root / 'PROJECT-VERSION.json').read_text())
    commit, branch = version['sourceCommit'], version['sourceBranch']
items = {}
for source, target in [
    ('artifacts/MysteryBoard-Universal.html', 'MysteryBoard-Universal.html'),
    ('artifacts/MysteryBoard-Universal-SCORM-1.2.zip', 'MysteryBoard-Universal-SCORM-1.2.zip'),
    ('START-HIER.md', 'START-HIER.md'),
    ('AI-ANLEITUNG.md', 'AI-ANLEITUNG.md'),
    ('LEHRKRAEFTE-ANLEITUNG.md', 'LEHRKRAEFTE-ANLEITUNG.md'),
    ('docs/DOKUMENTIMPORT-PRUEFBERICHT.md', 'PRUEFBERICHT.md'),
    ('docs/DOKUMENTIMPORT-AUFTRAG.md', 'AUFTRAG.md'),
    ('docs/DOKUMENTIMPORT-ANLEITUNG.md', 'DOKUMENTIMPORT-ANLEITUNG.md'),
    ('docs/UNIVERSAL-FORMAT.md', 'docs/UNIVERSAL-FORMAT.md'),
    ('docs/NEUES-MYSTERY.md', 'docs/NEUES-MYSTERY.md'),
]:
    items[target] = (root / source).read_bytes()
for source, target in [
    ('tests/fixtures/document-import', 'dateien'),
    ('docs/test-evidence/document-import', 'pruefnachweise'),
    ('qa/document-import', 'browserpruefung'),
    ('schemas', 'schemas'),
]:
    for path in sorted((root / source).rglob('*')):
        if path.is_file() and 'node_modules' not in path.parts and '__pycache__' not in path.parts:
            items[target + '/' + path.relative_to(root / source).as_posix()] = path.read_bytes()
# Keep a clearly labelled historical file solely for the size/start benchmark.
items['referenz/Universal-35019c3.html'] = subprocess.check_output([
    'git', '-C', str(root), 'show', '35019c364ffef026482250ec75042b38e138fe18:artifacts/MysteryBoard-Universal.html'
]) if (root / '.git').exists() else (root / 'docs/test-evidence/document-import/referenz/Universal-35019c3.html').read_bytes()
required = [
    'dateien/A-Word-12-Karten.docx', 'dateien/B-Word-Medien-Tabelle.docx',
    'dateien/C-PDF-12-Karten.pdf', 'dateien/D-PDF-Mehrspaltig.pdf',
    'dateien/E-PDF-Scan-ohne-Text.pdf', 'dateien/ORIGINAL-INHALTE.json',
    'pruefnachweise/RESULTS.json', 'browserpruefung/pruefen.mjs',
    'pruefnachweise/downloads/import-docx-1024-entwurf.mysteryboard',
    'pruefnachweise/downloads/import-pdf-1024-aufgabe.mysteryboard',
    'pruefnachweise/downloads/import-docx-1024-schueler.png',
    'pruefnachweise/downloads/import-pdf-1024-schueler.png',
]
for name in required:
    assert name in items, 'Benötigter Lieferbestandteil fehlt: ' + name
assert json.loads(items['pruefnachweise/RESULTS.json'])['status'] == 'passed'
items['QUELLSTAND.json'] = (json.dumps({
    'developmentPhase': 'LocalDocumentImport-2026-11-15',
    'repository': 'Feerson1617/Vorlage-Mysteryboard',
    'sourceCommit': commit, 'sourceBranch': branch,
    'baseCommit': '35019c364ffef026482250ec75042b38e138fe18',
    'documentFormatVersion': 3, 'ocrImplemented': False,
    'externalAiRequired': False, 'realSchoolDevices': 'OPEN', 'schoolApproval': False,
}, ensure_ascii=False, indent=2) + '\n').encode()
for name, data in list(items.items()):
    if name.endswith(('.md', '.txt', '.json', '.log', '.sh')):
        for prefix in (b'/' + b'workspace/', b'/' + b'home/agent/', b'/' + b'opt/codex/', b'/' + b'tmp/'):
            data = data.replace(prefix, b'[pruefumgebung]/')
        items[name] = data
    if name.endswith(('.md', '.txt', '.json', '.log', '.sh', '.mjs', '.ts', '.py', '.html')):
        assert not re.search(rb'(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,}|sk-proj-[A-Za-z0-9_-]{30,}|-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----)', data), 'Zugangsdatenverdacht in ' + name
        assert not re.search(rb'/(?:work' + rb'space|home/agent|opt/codex)/', data), 'Lokaler Cloud-Pfad in ' + name
entries = [{'file': n, 'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest()} for n, b in sorted(items.items())]
items['PRUEFSUMMEN.json'] = (json.dumps({'sourceCommit': commit, 'files': entries}, indent=2) + '\n').encode()
items['SHA256SUMS.txt'] = ''.join(e['sha256'] + '  ' + e['file'] + '\n' for e in entries).encode()
output.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name, data in sorted(items.items()):
        archive.writestr(name, data)
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None and len(archive.namelist()) == len(set(archive.namelist()))
    for entry in entries:
        assert hashlib.sha256(archive.read(entry['file'])).hexdigest() == entry['sha256']
result = {'file': output.name, 'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
          'sourceCommit': commit, 'entries': len(items), 'zipCrc': 'passed', 'allEntryChecksums': 'passed'}
print(json.dumps(result, ensure_ascii=False, indent=2))
output.with_suffix('.integrity.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
