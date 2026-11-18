"""Build a standalone RC review from the actual artifacts and current evidence."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
if len(sys.argv) != 2:
    raise SystemExit('Aufruf: python3 scripts/package-release-candidate.py NEUE-AUSGABE.zip')
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
    ('KI-PROMPT-ZUM-KOPIEREN.md', 'KI-PROMPT-ZUM-KOPIEREN.md'),
    ('AI-ANLEITUNG.md', 'AI-ANLEITUNG.md'),
    ('LEHRKRAEFTE-ANLEITUNG.md', 'LEHRKRAEFTE-ANLEITUNG.md'),
    ('docs/RELEASE-CANDIDATE.md', 'PRUEFBERICHT.md'),
    ('docs/RELEASE-CANDIDATE-AUFTRAG.md', 'AUFTRAG.md'),
    ('docs/UNIVERSAL-FORMAT.md', 'docs/UNIVERSAL-FORMAT.md'),
    ('docs/NEUES-MYSTERY.md', 'docs/NEUES-MYSTERY.md'),
]:
    items[target] = (root / source).read_bytes()
for source, target in [('examples/ki-papierprobe', 'papierprobe'), ('examples/help-editor', 'beispiele'),
                       ('docs/test-evidence/release-candidate', 'pruefnachweise'), ('qa/release-candidate', 'browserpruefung'), ('schemas', 'schemas')]:
    for p in sorted((root / source).rglob('*')):
        if p.is_file() and 'node_modules' not in p.parts and '__pycache__' not in p.parts:
            items[target + '/' + p.relative_to(root / source).as_posix()] = p.read_bytes()
for name in ['papierprobe/Papieroriginal.pdf', 'papierprobe/Parkteich-Aufgabe-v1.mysteryboard',
             'papierprobe/Parkteich-Lehrkraftentwurf-v1.mysteryboard', 'papierprobe/ERWARTETE-INHALTSSTRUKTUR.json',
             'pruefnachweise/RESULTS.json', 'pruefnachweise/papier/papier-1024x768-schuelerarbeit-v2.png',
             'pruefnachweise/papier/papier-1024x768-aufgabe-v2.mysteryboard', 'browserpruefung/pruefen.mjs']:
    assert name in items, 'Benötigter Lieferbestandteil fehlt: ' + name
assert json.loads(items['pruefnachweise/RESULTS.json'])['status'] == 'passed'
items['QUELLSTAND.json'] = (json.dumps({
    'releaseCandidate': 'Universal-2026-11-14-RC', 'repository': 'Feerson1617/Vorlage-Mysteryboard',
    'sourceCommit': commit, 'sourceBranch': branch, 'baseCommit': 'ae0f4cba54522752474bc474ac43a6b878b38751',
    'documentFormatVersion': 3, 'externalAiTrial': 'OPEN', 'realSchoolDevices': 'OPEN', 'schoolApproval': False,
}, indent=2) + '\n').encode()
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
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name, data in sorted(items.items()):
        z.writestr(name, data)
with zipfile.ZipFile(output) as z:
    assert z.testzip() is None and len(z.namelist()) == len(set(z.namelist()))
    for e in entries:
        assert hashlib.sha256(z.read(e['file'])).hexdigest() == e['sha256']
print(json.dumps({'file': output.name, 'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
                  'sourceCommit': commit, 'entries': len(items), 'zipCrc': 'passed', 'allEntryChecksums': 'passed'}, indent=2))
