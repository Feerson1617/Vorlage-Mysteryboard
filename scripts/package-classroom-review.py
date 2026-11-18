"""Package the tested production files and actual browser downloads, without rebuilding.

python3 scripts/package-classroom-review.py OUTPUT.zip SOURCE_COMMIT EVIDENCE_DIR DOWNLOAD_DIR
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
output, commit, evidence, downloads = Path(sys.argv[1]).resolve(), sys.argv[2], Path(sys.argv[3]), Path(sys.argv[4])
assert not output.exists(), 'Ausgabedatei existiert bereits.'
payloads = {}


def add(name, path):
    assert name not in payloads and not name.startswith('/') and '..' not in Path(name).parts
    payloads[name] = path.read_bytes()


for name in ('MysteryBoard-Universal.html', 'MysteryBoard-Universal-SCORM-1.2.zip'):
    add(name, root / 'artifacts' / name)
for index, label in ((1, 'Zwoelf-Beobachtungen'), (2, 'Fuenf-Spuren')):
    add(f'MysteryBoard-{label}-SCORM-1.2.zip', downloads / f'Unterricht-{index}-1024-SCORM-1.2.zip')
for name in ('UNTERRICHTS-SCORM-ANLEITUNG.md', 'UNTERRICHTS-SCORM-PRUEFBERICHT.md'):
    add(name, root / 'docs' / name)
add('ABNAHME-START.md', root / 'qa' / 'classroom-scorm' / 'ABNAHME-START.md')
for path in evidence.rglob('*'):
    if path.is_file():
        add('pruefprotokolle/' + path.relative_to(evidence).as_posix(), path)
for path in downloads.iterdir():
    if path.is_file() and path.name.startswith(('unveraendert-', 'vollstand-', 'original-png-', 'restored-', 'continued-')):
        add('testdateien/' + path.name, path)
for name in ('A-Word-12-Karten.docx', 'B-Word-Medien-Tabelle.docx', 'C-PDF-12-Karten.pdf', 'F-Defekt.docx', 'F-Defekt.pdf'):
    add('testdateien/' + name, root / 'tests' / 'fixtures' / 'document-import' / name)
paths = subprocess.check_output(['git', '-C', str(root), 'ls-tree', '-r', '--name-only', commit], text=True).splitlines()
source_paths = [p for p in paths if not p.startswith(('artifacts/', 'docs/test-evidence/'))]
source_paths += ['artifacts/MysteryBoard-Boden-Klasse11.html', 'artifacts/MysteryBoard-Boden-Klasse11-RC2.html', 'artifacts/MysteryBoard-Boden-Klasse11-RC2-SCORM-1.2.zip']
# The committed source is authoritative; do not accidentally bundle local edits.
for name in source_paths:
    payloads['projekt/' + name] = subprocess.check_output(['git', '-C', str(root), 'show', commit + ':' + name])
payloads['VERSION.json'] = (json.dumps({'sourceCommit': commit, 'sourceBranch': 'feat/mysteryboard-classroom-scorm-export', 'baseCommit': '38ba0a77ac1f2b8d667f5185724ee4933d159d1a', 'documentFormatVersion': 3, 'classroomZips': 'Actual Chromium browser downloads, not rebuilt by this packager', 'realSafariItslearningSchoolIpadAcceptance': 'open'}, ensure_ascii=False, indent=2) + '\n').encode()
payloads['projekt/PROJECT-VERSION.json'] = payloads['VERSION.json']
result_summary = json.loads((evidence / 'final-summary.json').read_text())
result_summary['sourceCommit'] = commit
result_summary['productionFiles'] = json.loads((evidence / 'production-checksums.json').read_text())
payloads['ERGEBNIS.json'] = (json.dumps(result_summary, ensure_ascii=False, indent=2) + '\n').encode()
entries = [{'file': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()} for name, data in sorted(payloads.items())]
payloads['PRUEFSUMMEN.json'] = (json.dumps(entries, ensure_ascii=False, indent=2) + '\n').encode()
payloads['SHA256SUMS.txt'] = ''.join(f'{entry["sha256"]}  {entry["file"]}\n' for entry in entries).encode()
output.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name, data in sorted(payloads.items()):
        archive.writestr(name, data)
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    assert len(archive.namelist()) == len(set(archive.namelist()))
    for entry in entries:
        assert hashlib.sha256(archive.read(entry['file'])).hexdigest() == entry['sha256']
result = {'file': output.name, 'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'sourceCommit': commit, 'entries': len(payloads), 'zipCrc': 'passed', 'allEntryChecksums': 'passed'}
output.with_suffix('.integrity.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
