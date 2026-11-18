"""Inspect delivered native binaries, independently of Electron/Forge.

python3 qa/studio/check-native-package.py APP.zip INSTALLER.dmg native-macos.json
Standard library only. hdiutil/codesign results remain separate native proofs.
"""
from pathlib import Path
import hashlib
import json
import plistlib
import stat
import struct
import sys
import zipfile

app_zip, dmg, proof_path = map(Path, sys.argv[1:])
proof = json.loads(proof_path.read_text())
assert proof['passed'] and proof['isPackaged']
assert proof['arch'] == 'arm64' and proof['appVersion'] == '0.2.0'
with zipfile.ZipFile(app_zip) as archive:
    assert archive.testzip() is None
    names = archive.namelist()
    assert len(names) == len(set(names))
    plist_name, = [name for name in names if name.count('.app/') == 1
                   and name.endswith('.app/Contents/Info.plist')]
    info = plistlib.loads(archive.read(plist_name))
    assert info['CFBundleShortVersionString'] == proof['appVersion']
    app_root = plist_name.removesuffix('Info.plist')
    executable = archive.read(app_root + 'MacOS/' + info['CFBundleExecutable'])
    magic, cpu = struct.unpack('<II', executable[:8])
    assert magic == 0xfeedfacf and cpu == 0x100000c, 'Not an ARM64 Mach-O application'
    assert app_root + 'Resources/app.asar' in names
    links = sum(stat.S_ISLNK(entry.external_attr >> 16) for entry in archive.infolist())
    assert links > 0, 'macOS framework symlinks must be preserved'
with dmg.open('rb') as stream:
    stream.seek(-512, 2)
    assert stream.read(4) == b'koly', 'Missing complete UDIF disk-image footer'
result = dict(
    passed=True, appVersion=proof['appVersion'], nativeBuildSourceCommit=proof['sourceCommit'],
    nativeCheckpoints=len(proof['checks']), appZipEntries=len(names), zipCRC='passed',
    frameworkSymlinks=links, machO='ARM64', minimumMacOS=info.get('LSMinimumSystemVersion'),
    dmgUDIFFooter='present', dmgNativeVerification='see DMG-Pruefung.log',
    files=[dict(file=path.name, bytes=path.stat().st_size,
                sha256=hashlib.sha256(path.read_bytes()).hexdigest()) for path in [app_zip, dmg]],
)
print(json.dumps(result, ensure_ascii=False, indent=2))
