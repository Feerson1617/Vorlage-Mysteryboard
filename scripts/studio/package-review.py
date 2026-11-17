"""Seal Studio sources + actual QA products, without native binaries or profiles.

python3 scripts/studio/package-review.py OUTPUT.zip EVIDENCE_DIRECTORY [RELEASE.json]
Native DMG/App ZIP are delivered separately, referenced by exact SHA-256.
"""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import subprocess
import sys
import zipfile

root = Path(__file__).resolve().parents[2]
output = Path(sys.argv[1]).resolve()
evidence = Path(sys.argv[2]).resolve()
release = json.loads(Path(sys.argv[3]).read_text()) if len(sys.argv) > 3 else dict(
    product='MysteryBoard Studio 0.1.0 – technische Abnahmefassung',
    runtimeCommit='0defd50126519ddda43a6a001a06355206844a93',
    baseCommit='a04f7c59f51309676156cdcb959db4fdc39128c3',
    branch='feat/mysteryboard-studio-macos',
    macOSRun='https://github.com/Feerson1617/Vorlage-Mysteryboard/actions/runs/44029762631',
    report='STUDIO-ABNAHMEBERICHT.md',
)
runtime_commit = release['runtimeCommit']
if len(sys.argv) > 3:
    native = json.loads((evidence / 'Mac/native-macos.json').read_text())
    assert native['passed'] and native['isPackaged'] and native['arch'] == 'arm64'
    assert native['sourceCommit'] == release['nativeBuildSourceCommit']
    assert native['appVersion'] == json.loads((root / 'package.json').read_text())['version']
    assert (output.parent / 'Mac-Dateien.json').is_file(), 'Missing tested native downloads'
payload = {}


def add(path, name):
    if name in payload:
        raise ValueError('Duplicate archive entry: ' + name)
    payload[name] = path.read_bytes()


# Full runtime source, all original tests and their fixtures, reproducible build
# and QA scripts. No dependency installations, CI profiles, private uploads,
# old delivery ZIPs or legacy historical evidence directories.
for folder in ['src', 'studio', 'scripts', 'schemas', 'tests', 'examples', 'scorm', 'ocr', 'qa', '.github']:
    for path in sorted((root / folder).rglob('*')):
        rel = path.relative_to(root)
        if not path.is_file() or any(p in rel.parts for p in ['node_modules', '__pycache__', 'dist']):
            continue
        if rel.as_posix() == 'studio/electron/main.cjs' or path.suffix in ['.pyc', '.log']:
            continue
        add(path, 'source/' + rel.as_posix())
for path in sorted(root.iterdir()):
    if path.is_file() and (path.suffix in ['.md', '.json', '.ts', '.html', '.cjs', '.mjs'] or path.name in ['.gitignore', '.gitattributes']):
        add(path, 'source/' + path.name)
for path in sorted((root / 'docs').glob('*.md')):
    add(path, 'source/docs/' + path.name)
for name in ['MysteryBoard-Boden-Klasse11-RC2.html', 'MysteryBoard-Boden-Klasse11-RC2-SCORM-1.2.zip', 'MysteryBoard-Boden-Klasse11.html']:
    add(root / 'artifacts' / name, 'source/artifacts/' + name)
for name in ['STUDIO-MACOS.md', release['report']]:
    add(root / 'docs' / name, name)
for folder in ['studio', 'player']:
    for path in sorted((root / 'studio/dist' / folder).rglob('*')):
        if path.is_file():
            add(path, 'built/' + folder + '/' + path.relative_to(root / 'studio/dist' / folder).as_posix())
add(root / 'studio/dist/player-boundary.json', 'built/player-boundary.json')

# Current proven outputs. Four native print formats, two native SCOs, real
# PNG downloads, screenshots and original native test reports. Expanded SCOs
# are reconstructed from their actual ZIPs by the included QA helper.
for path in sorted(evidence.iterdir()):
    if path.is_file() and path.suffix in ['.json', '.png', '.pdf', '.zip', '.mysteryboard', '.log', '.txt']:
        add(path, 'evidence/' + path.name)
for folder in ['Mac', 'Vorher', 'Vergleich', 'Frueher-Testlauf-Touch-Emulation', 'logs', 'PNG-Originalpruefung', 'OCR-Regression']:
    for path in sorted((evidence / folder).rglob('*')):
        if path.is_file() and 'native-profile' not in path.parts:
            add(path, 'evidence/' + path.relative_to(evidence).as_posix())
for name in ['Mac-Dateien.json']:
    path = output.parent / name
    if path.exists():
        add(path, name)

head = subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True).strip()
payload['VERSION.json'] = (json.dumps(dict(
    product=release['product'],
    packagedAtUtc=datetime.now(timezone.utc).isoformat(),
    applicationSourceCommit=runtime_commit,
    packagingSourceCommit=head,
    baseCommit=release['baseCommit'],
    branch=release['branch'],
    macOSRun=release['macOSRun'],
    nativeBuildSourceCommit=release.get('nativeBuildSourceCommit', runtime_commit),
    nativeBinaries='Separate DMG and App ZIP: see Mac-Dateien.json. Not embedded in this review ZIP.',
    schoolApproval=False,
    note='Runtime files match applicationSourceCommit; subsequent changes are QA/documentation/delivery only. Manifest hashes are authoritative for this archive.'
), ensure_ascii=False, indent=2)+'\n').encode()
payload['LESEN.txt'] = '''MysteryBoard Studio – Abnahmepaket

STUDIO-MACOS.md: Installation und Bedienung.
{report}: tatsächliche Nachweise und offene Abnahmepunkte.
Mac-Dateien.json: separate native Downloads mit Bytes und SHA-256.
evidence/Mac/: PDFs, .mysteryboard-Projekte, Schüler-SCORMs und echte Mac-Protokolle.
evidence/: PNG-Sicherungen, Browsernachweise, alle gerenderten PDF-Seiten.
built/: geprüfter Studio-Renderer samt lokaler OCR und getrennter Player.
source/: vollständiger Quellcode, alle alten Tests, Fixtures, Buildskripte und gepinnte Lockdatei.

Integrität: python3 verify-package.py
Quelle: cd source && npm ci && npm test && npm run studio:build
Vollregression: CLASSROOM_SCORM=1 npm run check && npm run test:rc2
Mac-Build: npm run studio:make -- --platform=darwin --arch=arm64
Native Mac-QA: STUDIO_EXEC='/Pfad/MysteryBoard Studio.app/Contents/MacOS/MysteryBoard Studio' npm run studio:test
Build- und Testwerkzeuge werden nur für Entwicklung/Prüfung benötigt.
Die installierte App benötigt kein Terminal, Python oder System-Node.js.

Nur gültige Schüler-SCORM-ZIPs in itslearning hochladen, nicht dieses Quell-/Abnahmepaket.
Keine Apple-Notarisierung und keine schulische Gerätefreigabe behauptet.
Frühere Touch-Emulationsfehler sind separat markiert und nicht als bestandene Läufe ausgegeben.
'''.replace('{report}', release['report']).encode()
payload['verify-package.py'] = '''from pathlib import Path
import hashlib,json,zipfile
root=Path(__file__).resolve().parent
manifest=json.loads((root/'MANIFEST.json').read_text())
for entry in manifest:
 p=root/entry['file']; data=p.read_bytes()
 assert len(data)==entry['bytes'],entry['file']
 assert hashlib.sha256(data).hexdigest()==entry['sha256'],entry['file']
 if p.suffix=='.zip':
  with zipfile.ZipFile(p) as z: assert z.testzip() is None,p
print(f"Vollständig: {len(manifest)} Dateien, sämtliche SHA-256 und enthaltene ZIP-CRC korrekt.")
'''.encode()
manifest = [dict(file=n, bytes=len(b), sha256=hashlib.sha256(b).hexdigest()) for n, b in sorted(payload.items())]
payload['MANIFEST.json'] = (json.dumps(manifest, ensure_ascii=False, indent=2)+'\n').encode()
output.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name, data in sorted(payload.items()):
        info = zipfile.ZipInfo(name, (2026, 11, 17, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        z.writestr(info, data, compresslevel=9)
with zipfile.ZipFile(output) as z:
    assert z.testzip() is None
    assert len(z.namelist()) == len(set(z.namelist()))
    for entry in manifest:
        assert hashlib.sha256(z.read(entry['file'])).hexdigest() == entry['sha256']
assert output.stat().st_size < 32 * 1024 * 1024, 'Review ZIP exceeds 32 MiB upload target'
result = dict(file=output.name, bytes=output.stat().st_size,
              sha256=hashlib.sha256(output.read_bytes()).hexdigest(), entries=len(payload),
              zipCRC='passed', entrySHA256='passed', applicationSourceCommit=runtime_commit)
output.with_suffix('.integrity.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(result, indent=2))
