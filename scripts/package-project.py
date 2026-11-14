"""Portable source delivery; no build, publish, dependencies or git checkout needed.

Usage: python3 scripts/package-project.py OUTPUT.zip [SOURCE_COMMIT]
The archive includes all source, configs, fixtures, docs, examples and artifacts;
installed dependencies, temporary builds and prior project ZIPs are excluded.
"""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import subprocess
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
if len(sys.argv) < 2:
    raise SystemExit('Aufruf: python3 scripts/package-project.py AUSGABE.zip [QUELLCOMMIT]')
output = Path(sys.argv[1]).resolve()
if output.exists():
    raise SystemExit(f'Ausgabedatei existiert bereits: {output}')
if output.suffix.lower() != '.zip':
    raise SystemExit('Die Ausgabe benötigt die Endung .zip.')
commit = sys.argv[2] if len(sys.argv) > 2 else None
if not commit:
    try:
        commit = subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True, stderr=subprocess.DEVNULL).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        version = root / 'PROJECT-VERSION.json'
        commit = json.loads(version.read_text())['sourceCommit'] if version.exists() else 'unversioned-local-copy'
folders = ['src', 'scripts', 'tests', 'schemas', 'examples', 'docs', 'artifacts', 'scorm', 'qa', '.github']
files = [p for p in root.iterdir() if p.is_file() and p.suffix in ['.md', '.json', '.ts', '.html']]
files += [root / '.gitignore']
for folder in folders:
    files += [p for p in (root / folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts and 'node_modules' not in p.relative_to(root).parts
              and not p.relative_to(root).as_posix().startswith('artifacts/previews/')
              and not p.relative_to(root).as_posix().startswith('artifacts/tests/')
              and not (p.relative_to(root).as_posix().startswith('docs/test-evidence/') and not p.relative_to(root).as_posix().startswith('docs/test-evidence/release-candidate/') and p.suffix.lower() in ['.png', '.pdf'])
              and 'Projektvorlage' not in p.name and 'Pruefnachweise.zip' not in p.name]
files = sorted(set(files) - {output, root / 'PROJECT-VERSION.json'})
entries = []
payloads = {}
redacted = []
for p in files:
    data = p.read_bytes()
    relative_path = p.relative_to(root).as_posix()
    # Historical human-readable test logs can contain machine-specific paths.
    # Neutralize those only in documentation, never in source or build artifacts.
    if relative_path.startswith('docs/') and p.suffix.lower() in ('.md', '.txt', '.json', '.log', '.sh'):
        original = data
        for prefix in (b'/' + b'workspace/', b'/' + b'home/agent/', b'/' + b'opt/codex/', b'/' + b'tmp/'):
            data = data.replace(prefix, b'[fruehere-testumgebung]/')
        if data != original:
            redacted.append(relative_path)
    payloads[p] = data
    entries.append({'file': p.relative_to(root).as_posix(), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
try:
    branch = subprocess.check_output(['git', '-C', str(root), 'branch', '--show-current'], text=True, stderr=subprocess.DEVNULL).strip()
except (subprocess.CalledProcessError, FileNotFoundError):
    branch = json.loads((root / 'PROJECT-VERSION.json').read_text()).get('sourceBranch', 'local-copy') if (root / 'PROJECT-VERSION.json').exists() else 'local-copy'
version = {'sourceCommit': commit, 'sourceBranch': branch,
           'baseCommit': '5a6899a7a67465c932c340c60ccde56e989586b4', 'documentFormatVersion': 3, 'reviewBaseCommit': 'ae0f4cba54522752474bc474ac43a6b878b38751', 'releaseCandidate': 'Universal-2026-11-14-RC',
           'packagedAtUtc': datetime.now(timezone.utc).isoformat(), 'entries': entries,
           'redactedHistoricalDocuments': redacted,
           'note': 'Quellcode und Produktionsartefakte unverändert. Historische Dokumenttexte ohne Cloud-Pfadpräfixe; regenerierbare Test-HTMLs und historische generierte Screenshots/Pruef-PDFs nicht enthalten; aktueller Release-Nachweis enthalten. Keine schulische Gerätefreigabe.'}
version_bytes = (json.dumps(version, ensure_ascii=False, indent=2) + '\n').encode()
output.parent.mkdir(parents=True, exist_ok=True)
prefix = 'MysteryBoard-Universal-Projektvorlage/'
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for p in files:
        archive.writestr(prefix + p.relative_to(root).as_posix(), payloads[p])
    archive.writestr(prefix + 'PROJECT-VERSION.json', version_bytes)
    checksums = ''.join(f'{e["sha256"]}  {e["file"]}\n' for e in entries)
    checksums += hashlib.sha256(version_bytes).hexdigest() + '  PROJECT-VERSION.json\n'
    archive.writestr(prefix + 'SHA256SUMS.txt', checksums)
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    assert len(archive.namelist()) == len(set(archive.namelist()))
    for e in entries:
        assert hashlib.sha256(archive.read(prefix + e['file'])).hexdigest() == e['sha256']
result = {'file': output.name, 'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
          'sourceCommit': commit, 'entries': len(entries) + 2, 'zipCrc': 'passed', 'allEntryChecksums': 'passed'}
print(json.dumps(result, ensure_ascii=False, indent=2))
output.with_suffix('.integrity.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
