"""Download the actual successful Actions artifact and audit its native binaries.

python3 scripts/studio/fetch-native-evidence.py RUN_ID EVIDENCE_DIR DELIVERY_DIR
Requires authenticated gh and Python 3. No release or repository mutation.
"""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys
import zipfile

run_id, evidence_arg, delivery_arg = sys.argv[1:]
evidence, delivery = Path(evidence_arg).resolve(), Path(delivery_arg).resolve()
repo = 'Feerson1617/Vorlage-Mysteryboard'
api = lambda path: json.loads(subprocess.check_output(['gh', 'api', f'repos/{repo}/{path}']))
run = api(f'actions/runs/{run_id}')
assert run['status'] == 'completed' and run['conclusion'] == 'success', 'Native workflow is not successful'
artifacts = api(f'actions/runs/{run_id}/artifacts')['artifacts']
artifact, = [entry for entry in artifacts if not entry['expired']
             and entry['name'] == 'MysteryBoard-Studio-macOS-Apple-Silicon-' + run['head_sha']]
delivery.mkdir(parents=True, exist_ok=True)
outer = delivery / 'MysteryBoard-Studio-Actions-Artefakt.zip'
with outer.open('wb') as stream:
    subprocess.run(['gh', 'api', f'repos/{repo}/actions/artifacts/{artifact["id"]}/zip'], stdout=stream, check=True)
digest = hashlib.sha256(outer.read_bytes()).hexdigest()
if artifact.get('digest'):
    assert artifact['digest'] == 'sha256:' + digest, 'Actions artifact digest mismatch'
unpacked = delivery / 'Actions-Inhalt'
unpacked.mkdir(exist_ok=True)
with zipfile.ZipFile(outer) as archive:
    assert archive.testzip() is None
    assert len(archive.namelist()) == len(set(archive.namelist()))
    for name in archive.namelist():
        assert (unpacked / name).resolve().is_relative_to(unpacked)
        assert 'native-profile' not in Path(name).parts
    archive.extractall(unpacked)
proof_path, = unpacked.rglob('native-macos.json')
proof = json.loads(proof_path.read_text())
assert proof['passed'] and proof['sourceCommit'] == run['head_sha']
assert not (proof_path.parent / 'Mac-Fehler.txt').exists(), 'Unexpected failed-run capture'
native_out = evidence / 'Mac'
if (native_out / 'native-macos.json').exists():
    assert json.loads((native_out / 'native-macos.json').read_text())['sourceCommit'] == run['head_sha']
shutil.copytree(proof_path.parent, native_out, dirs_exist_ok=True)
make = next(path for path in unpacked.rglob('make') if path.is_dir() and path.parent.name == 'out')
app_zip, = make.rglob('*.zip')
dmg, = make.rglob('*.dmg')
app_copy = delivery / 'MysteryBoard-Studio-0.2.0-Apple-Silicon-App.zip'
dmg_copy = delivery / 'MysteryBoard-Studio-0.2.0-Apple-Silicon.dmg'
shutil.copyfile(app_zip, app_copy)
shutil.copyfile(dmg, dmg_copy)
audit = json.loads(subprocess.check_output([
    sys.executable, 'qa/studio/check-native-package.py', str(app_copy), str(dmg_copy), str(proof_path),
]))
metadata = dict(
    **audit, workflow=run['html_url'], runAttempt=run['run_attempt'],
    originalArtifactFiles=dict(appZip=app_zip.relative_to(unpacked).as_posix(), dmg=dmg.relative_to(unpacked).as_posix()),
    artifact=dict(id=artifact['id'], name=artifact['name'], expiresAt=artifact['expires_at'],
                  download=f'https://github.com/{repo}/actions/runs/{run_id}/artifacts/{artifact["id"]}',
                  downloadedBytes=outer.stat().st_size, sha256=digest, zipCRC='passed',
                  providerDigestMatches=bool(artifact.get('digest'))),
    actualBinaryDownloadTest='gh REST binary stream; ZIP CRC and ARM64 Mach-O checked; not an HTML preview',
    notarized=False, physicalM1AndItslearningAndManagedIpad='open',
)
(delivery / 'Mac-Dateien.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
(native_out / 'Actions-Artefakt.json').write_text(json.dumps(metadata['artifact'], indent=2) + '\n')
print(json.dumps(metadata, ensure_ascii=False, indent=2))
