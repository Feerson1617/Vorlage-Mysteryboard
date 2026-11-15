"""Collect only completed checks and actual downloads; never turn a failure green.

Usage: python3 scripts/collect-document-import-evidence.py EXTERNAL-EVIDENCE-DIR
Run after the documented full check, RC2 check, standalone review and benchmark.
"""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import base64
import io
import json
import re
import shutil
import subprocess
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1]).resolve()
target = root / 'docs/test-evidence/document-import'
target.mkdir(parents=True, exist_ok=True)
full = (source / 'final/full-check.txt').read_text()
rc2 = (source / 'rc2-final.txt').read_text()
assert not re.search(r'^\s*\d+ failed', full, re.M), 'Gesamtlauf ist fehlgeschlagen'
unit = re.search(r'Tests\s+(\d+) passed', full)
browser = re.search(r'^\s*(\d+) passed \(', full, re.M)
assert unit and browser and int(unit[1]) >= 117 and int(browser[1]) >= 188
assert re.search(r'^\s*4 passed \(', rc2, re.M)
standalone = json.loads((source / 'preflight/browserpruefung/ergebnisse/dokumentimport/ERGEBNIS.json').read_text())
assert standalone['status'] == 'passed'
html = (root / 'artifacts/MysteryBoard-Universal.html').read_bytes()
assert hashlib.sha256(html).hexdigest() == standalone['applicationSha256']
benchmark = json.loads((source / 'preflight/browserpruefung/ergebnisse/benchmark/ERGEBNIS.json').read_text())
assert benchmark['status'] == 'measured' and benchmark['bytes']['current'] == len(html)

def copy_file(path, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(path, dest)

logs = {
    'final/full-check.txt': 'full-check.txt',
    'final/full-check-first-attempt.txt': 'attempts/full-check-title-label.txt',
    'final/full-check-media-limit-attempt.txt': 'attempts/full-check-media-limit.txt',
    'final/title-label-first-attempt.md': 'attempts/title-label-context.md',
    'final/media-limit-attempt.md': 'attempts/media-limit-context.md',
    'rc2-final.txt': 'rc2.txt', 'webkit.txt': 'webkit-open.txt',
    'preflight-final.txt': 'standalone-review.txt', 'benchmark-final.txt': 'benchmark.txt',
    'cold-source.txt': 'cold-source.txt', 'npm-audit-production.json': 'npm-audit-production.json',
    'npm-audit-all.json': 'npm-audit-all.json', 'protected-artifacts.json': 'protected-artifacts.json',
    'browser-corrections.txt': 'targeted-corrections.txt',
    'remote-before-push.txt': 'remote-before-push.txt',
    'file-scheme.txt': 'file-scheme-open.txt',
    'library-evaluation.txt': 'library-evaluation.txt',
    'word-original.txt': 'word-original.txt',
    'scorm-validation.txt': 'scorm-validation.txt',
}
for path, dest in logs.items():
    copy_file(source / path, target / dest)
for path in sorted((source / 'final/downloads').glob('import-*')):
    copy_file(path, target / 'downloads' / path.name)
for folder in sorted((root / 'test-results').glob('document-import-*')):
    for path in folder.glob('*.png'):
        if path.name in ['karten-pruefen.png', 'original-vergleichen.png', 'scorm-schueler.png']:
            copy_file(path, target / 'screenshots' / folder.name / path.name)
for folder in ['dokumentimport', 'benchmark']:
    shutil.copytree(source / 'preflight/browserpruefung/ergebnisse' / folder,
                    target / folder, dirs_exist_ok=True)
# Preserve every test/step record, without duplicating tens of MB of PNGs from
# historical regression cases. Current import downloads/screenshots are above.
for folder in ['playwright-report', 'playwright-report-rc2']:
    html_report = (root / folder / 'index.html').read_text()
    encoded = re.search(r'data:application/zip;base64,([A-Za-z0-9+/=]+)', html_report)
    assert encoded, 'Playwright-Berichtsdaten fehlen'
    with zipfile.ZipFile(io.BytesIO(base64.b64decode(encoded[1]))) as archive:
        assert archive.testzip() is None
        for name in archive.namelist():
            assert re.fullmatch(r'[A-Za-z0-9_-]+\.json', name), name
            destination = target / (folder + '-json') / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(archive.read(name))
(target / 'BROWSER-PROTOKOLLE.md').write_text(
    '# Vollständige Browserprotokolle\n\n'
    '`full-check.txt` und `rc2.txt` enthalten die vollständigen frischen Konsolenläufe. '
    'Die Ordner `playwright-report-json` und `playwright-report-rc2-json` enthalten sämtliche '
    'unveränderten Test-/Schrittdatensätze aus den eingebetteten Playwright-Berichtsarchiven. '
    'Maschinenpfade werden erst für die portable ZIP-Dokumentlieferung neutralisiert.\n\n'
    'Tatsächliche Importdownloads, Original-PNGs und aktuelle Screenshots liegen unter '
    '`downloads`, `screenshots` und `dokumentimport`. Die JSON-Anhangverweise alter '
    'Regressionsfälle benennen die ursprünglichen Laufdateien; diese historischen '
    'Doppelanhänge werden nicht sämtlich erneut ausgeliefert. Die vollständigen '
    'Tests im Quellpaket erzeugen sie bei Bedarf erneut. Es wird kein HTML-Bericht '
    'mit fehlenden Anhangdateien als funktionsfähiger Bericht ausgegeben.\n')
copy_file(source / 'preflight/referenz/Universal-35019c3.html', target / 'referenz/Universal-35019c3.html')
integrity = []
for path in sorted((root / 'artifacts').glob('*.html')):
    data = path.read_bytes()
    assert len(data) < 10_000_000, path.name
    integrity.append({'file': path.name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
scorm = root / 'artifacts/MysteryBoard-Universal-SCORM-1.2.zip'
integrity.append({'file': scorm.name, 'bytes': scorm.stat().st_size, 'sha256': hashlib.sha256(scorm.read_bytes()).hexdigest()})
(target / 'artifact-integrity.json').write_text(json.dumps(integrity, indent=2) + '\n')
implementation = {}
for folder in ['src', 'scripts']:
    for path in sorted((root / folder).rglob('*')):
        if path.is_file() and '__pycache__' not in path.parts:
            implementation[path.relative_to(root).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
for name in ['package.json', 'package-lock.json', 'vite.config.ts']:
    implementation[name] = hashlib.sha256((root / name).read_bytes()).hexdigest()
(target / 'IMPLEMENTATION-SHA256.json').write_text(json.dumps(implementation, indent=2) + '\n')
result = {
    'status': 'passed', 'collectedAtUtc': datetime.now(timezone.utc).isoformat(),
    'baseCommit': '35019c364ffef026482250ec75042b38e138fe18',
    'sourceBranch': 'feat/mysteryboard-local-document-import',
    'applicationSha256': hashlib.sha256(html).hexdigest(),
    'tests': {'unit': int(unit[1]), 'chromium': int(browser[1]), 'originalChromium': 173,
              'newImportChromium': 15, 'frozenRc2Chromium': 4,
              'standaloneChecks': standalone['checks']},
    'runtime': {'node': subprocess.check_output(['node', '--version'], text=True).strip(),
                'npm': subprocess.check_output(['npm', '--version'], text=True).strip(),
                'chromium': standalone['browserVersion']},
    'coldBuild': 'passed; byte-identical HTML and SCORM',
    'htmlLimitBytesExclusive': 10_000_000,
    'open': ['WebKit 26.5 not available', 'WebKit 27.2 missing host libraries',
             'real Safari/managed school iPads', 'real itslearning/Canva deployment',
             'direct file URL blocked by host administrator; localhost/offline tested',
             'native Safari print', 'physical iPad total-memory/performance measurement'],
    'schoolApproval': False,
}
(target / 'RESULTS.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(result, ensure_ascii=False, indent=2))
