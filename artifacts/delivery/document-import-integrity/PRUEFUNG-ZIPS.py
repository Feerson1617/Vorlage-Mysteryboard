"""Verify and actually extract all three delivered ZIPs into a new directory.
Usage: python3 verify-zips.py DELIVERY-DIRECTORY NEW-EXTRACTION-DIRECTORY
"""
from pathlib import Path
import hashlib
import io
import json
import re
import sys
import zipfile

source = Path(sys.argv[1]).resolve()
target = Path(sys.argv[2]).resolve()
target.mkdir(exist_ok=False)
sha = lambda data: hashlib.sha256(data).hexdigest()
result = []
for name, folder in [
    ('MysteryBoard-Universal-Projektvorlage.zip', 'projekt'),
    ('MysteryBoard-Dokumentimport-Abnahmepaket.zip', 'abnahme'),
    ('MysteryBoard-Universal-SCORM-1.2.zip', 'scorm'),
]:
    with zipfile.ZipFile(source / name) as archive:
        assert archive.testzip() is None
        assert len(set(archive.namelist())) == len(archive.namelist())
        for entry in archive.namelist():
            assert not Path(entry).is_absolute() and '..' not in Path(entry).parts
        archive.extractall(target / folder)
    result.append({'file': name, 'bytes': (source / name).stat().st_size,
                   'sha256': sha((source / name).read_bytes()), 'zipCrc': 'passed',
                   'actuallyExtracted': True})
project = target / 'projekt/MysteryBoard-Universal-Projektvorlage'
review = target / 'abnahme'
version = json.loads((project / 'PROJECT-VERSION.json').read_text())
review_version = json.loads((review / 'QUELLSTAND.json').read_text())
assert version['sourceCommit'] == review_version['sourceCommit']
assert version['sourceBranch'] == 'feat/mysteryboard-document-import-integrity'
assert version['baseCommit'] == '8418a445248893c2ba01bea673d84febcdf36537'
for entry in version['entries']:
    data = (project / entry['file']).read_bytes()
    assert len(data) == entry['bytes'] and sha(data) == entry['sha256'], entry['file']
for entry in json.loads((review / 'PRUEFSUMMEN.json').read_text())['files']:
    data = (review / entry['file']).read_bytes()
    assert len(data) == entry['bytes'] and sha(data) == entry['sha256'], entry['file']
html = (source / 'MysteryBoard-Universal.html').read_bytes()
assert len(html) < 10_000_000
assert html == (review / 'MysteryBoard-Universal.html').read_bytes()
assert html == (project / 'artifacts/MysteryBoard-Universal.html').read_bytes()
assert html == (target / 'scorm/app.html').read_bytes()
assert (source / 'MysteryBoard-Universal-SCORM-1.2.zip').read_bytes() == (review / 'MysteryBoard-Universal-SCORM-1.2.zip').read_bytes()
assert (source / 'MysteryBoard-Universal-SCORM-1.2.zip').read_bytes() == (project / 'artifacts/MysteryBoard-Universal-SCORM-1.2.zip').read_bytes()
texts = ('.md', '.txt', '.json', '.log', '.sh', '.mjs', '.cjs', '.ts', '.tsx', '.py', '.html', '.css', '.xml')
checked = 0
for path in target.rglob('*'):
    if not path.is_file(): continue
    data = path.read_bytes()
    if path.suffix == '.zip':
        with zipfile.ZipFile(io.BytesIO(data)) as nested:
            assert nested.testzip() is None, str(path)
    if path.suffix in texts:
        assert not re.search(rb'(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,}|sk-proj-[A-Za-z0-9_-]{30,}|-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----)', data), 'Zugangsdatenverdacht: ' + path.name
        assert not re.search(rb'/(?:work' + rb'space|home/agent|opt/codex)/', data), 'Cloud-Pfad: ' + path.name
        checked += 1
print(json.dumps({'status': 'passed', 'sourceCommit': version['sourceCommit'],
                  'archives': result, 'allManifestEntryHashes': 'passed',
                  'applicationByteIdentical': True, 'textFilesAudited': checked,
                  'privateCredentialsAndCloudPaths': 'none detected'}, indent=2))
