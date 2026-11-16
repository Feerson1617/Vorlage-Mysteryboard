"""Independent delivered-file check, Python standard library only.
Usage: verify-bundle.py EXTRACTED_ACCEPTANCE_DIRECTORY
"""
import base64
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET
import zipfile

root = Path(sys.argv[1]).resolve()
helper = Path(__file__).resolve().parent.parent / 'classroom-scorm/verify-delivery.py'
spec = importlib.util.spec_from_file_location('independent_png', helper)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
if (root / 'PRUEFSUMMEN.json').exists():
    for entry in json.loads((root / 'PRUEFSUMMEN.json').read_text()):
        name = Path(entry['file'])
        assert not name.is_absolute() and '..' not in name.parts
        data = (root / name).read_bytes()
        assert len(data) == entry['bytes'] and hashlib.sha256(data).hexdigest() == entry['sha256'], str(name)
html_bytes = (root / 'MysteryBoard-Universal.html').read_bytes()
assert len(html_bytes) < 10_000_000
html = module.HTML(html_bytes.decode())
assert html.bootstrap == [None] and len(html.modules) == 1
assert all(url.startswith('data:') for url in html.resources)
wrappers = None
for name in ['MysteryBoard-Universal-SCORM-1.2.zip', 'MysteryBoard-Unterrichtsbeispiel-SCORM-1.2.zip']:
    with zipfile.ZipFile(root / name) as archive:
        assert archive.testzip() is None
        assert sorted(archive.namelist()) == ['app.html', 'imsmanifest.xml', 'launch.html', 'session.js']
        app = archive.read('app.html')
        assert len(app) < 10_000_000
        parsed = module.HTML(app.decode())
        assert parsed.modules == html.modules
        assert all(url.startswith('data:') for url in parsed.resources)
        wrapper = (archive.read('launch.html'), archive.read('session.js'))
        if wrappers is None:
            wrappers = wrapper
            assert app == html_bytes
        else:
            assert wrapper == wrappers
            assert parsed.bootstrap[0]['classroom'] is True
            task = json.loads(base64.b64decode(parsed.bootstrap[0]['task'], validate=True))
            assert task == json.loads((root / 'MysteryBoard-Unterrichtsbeispiel.mysteryboard').read_text())
        manifest = ET.fromstring(archive.read('imsmanifest.xml'))
        ns = {'i': 'http://www.imsproject.org/xsd/imscp_rootv1p1p2'}
        assert manifest.find('i:metadata/i:schemaversion', ns).text == '1.2'
        assert manifest.find('i:resources/i:resource', ns).attrib['href'] == 'launch.html'
rows = []
downloads = root / 'browserdownloads'
for mode in ['html', 'universal-scorm', 'classroom-scorm']:
    for width in [1024, 768, 600, 320]:
        prefix = f'{mode}-{width}'
        docs = {kind: json.loads((downloads / f'{prefix}-{kind}-unabhaengig.json').read_text()) for kind in ['Original', 'Kompakt', 'Wiederhergestellt', 'Weitergearbeitet']}
        first = docs['Original']
        assert first == docs['Kompakt'] == docs['Wiederhergestellt']
        assert first['kind'] == 'student' and first['formatVersion'] == 3
        assert first['content'] == task['content']
        assert first['work']['team'] == 'Team Nordseeküste'
        assert [e['direction'] for e in first['work']['edges']] == [1, 2]
        later = docs['Weitergearbeitet']
        assert later['content'] == first['content']
        assert later['work']['team'] == first['work']['team'] and later['work']['edges'] == first['work']['edges']
        assert later['work']['cards'] != first['work']['cards']
        retained = 0
        for kind, document in docs.items():
            record = json.loads((downloads / f'{prefix}-{kind}-pruefung.json').read_text())
            assert record['actualDownloadName'] == 'Team Nordseeküste_Strömungen und Küsten – Übungsaufgabe.png'
            assert record['crcAndEmbeddedSha256'] == 'passed' and record['format'] == 'MBX3'
            path = downloads / f'{prefix}-{kind}.png'
            if path.exists():
                data = path.read_bytes()
                assert len(data) == record['bytes'] and hashlib.sha256(data).hexdigest() == record['sha256']
                assert module.png_document(data) == document
                retained += 1
        rows.append({'case': prefix, 'fullFreshRestoreAndContinuation': 'passed', 'independentPngData': 'passed', 'actualPngFilesRechecked': retained})
actual = module.png_document((root / 'Team Nordseeküste_Strömungen und Küsten – Übungsaufgabe.png').read_bytes())
assert actual == json.loads((downloads / 'html-1024-Original-unabhaengig.json').read_text())
print(json.dumps({'htmlBytes': len(html_bytes), 'zipCrcManifestAndSameRuntime': 'passed', 'cases': rows}, ensure_ascii=False, indent=2))
