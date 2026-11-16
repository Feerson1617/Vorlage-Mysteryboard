"""Independent check of actual task/SCO/PNG downloads, no app codec imported.
Usage: python3 verify-outputs.py CASES.json DOWNLOAD_DIR
CASES contains alias, title and the independently checked original cards.
"""
import base64
import hashlib
from html.parser import HTMLParser
import importlib.util
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET
import zipfile

helper = Path(__file__).resolve().parent.parent / 'classroom-scorm' / 'verify-delivery.py'
spec = importlib.util.spec_from_file_location('independent_png', helper)
png = importlib.util.module_from_spec(spec)
spec.loader.exec_module(png)
cases = json.loads(Path(sys.argv[1]).read_text())
root = Path(sys.argv[2])
report = []
blank = png.HTML(Path(sys.argv[3]).read_text()) if len(sys.argv) > 3 else None
for case in cases:
    expected = [{k: c[k] for k in ('title', 'text')} for c in case['cards']]
    for width in (1024, 768, 600, 320):
        prefix = f'{case["alias"]}-{width}'
        draft = json.loads((root / f'{prefix}-entwurf.mysteryboard').read_bytes())
        task = json.loads((root / f'{prefix}-aufgabe.mysteryboard').read_bytes())
        assert draft['kind'] == 'draft' and task['kind'] == 'task'
        assert draft['content'] == task['content']
        assert [{k: c[k] for k in ('title', 'text')} for c in task['content']['cards']] == expected
        assert task['formatVersion'] == 3 and task['content']['title'] == case['title']
        archive = root / f'{prefix}-SCORM-1.2.zip'
        if not archive.exists() and width == 1024 and case.get('classroomZip'):
            archive = root / case['classroomZip']
        retained = archive.exists()
        if retained:
            with zipfile.ZipFile(archive) as z:
                assert z.testzip() is None
                assert sorted(z.namelist()) == ['app.html', 'imsmanifest.xml', 'launch.html', 'session.js']
                app = z.read('app.html')
                assert len(app) < 10_000_000
                html = png.HTML(app.decode())
                assert len(html.modules) == 1 and len(html.bootstrap) == 1
                if blank:
                    assert html.modules == blank.modules
                assert html.bootstrap[0]['classroom'] is True
                assert json.loads(base64.b64decode(html.bootstrap[0]['task'], validate=True)) == task
                assert all(url.startswith('data:') for url in html.resources)
                manifest = ET.fromstring(z.read('imsmanifest.xml'))
                ns = {'i': 'http://www.imsproject.org/xsd/imscp_rootv1p1p2'}
                assert manifest.find('i:metadata/i:schemaversion', ns).text == '1.2'
                assert manifest.find('i:resources/i:resource', ns).attrib['href'] == 'launch.html'
                assert manifest.find('i:organizations/i:organization/i:title', ns).text == case['title']
        else:
            assert width != 1024, 'Das Haupt-SCORM-Paket fehlt.'
        student = json.loads((root / f'{prefix}-schueler.mysteryboard').read_bytes())
        restored = json.loads((root / f'{prefix}-wiederhergestellt.mysteryboard').read_bytes())
        continued = json.loads((root / f'{prefix}-fortgesetzt.mysteryboard').read_bytes())
        image = png.png_document((root / f'{prefix}-original.png').read_bytes())
        assert student == restored == image
        assert student['content'] == task['content']
        assert [e['direction'] for e in student['work']['edges']] == [1]
        assert [e['direction'] for e in continued['work']['edges']] == [1, 1]
        report.append({'case': case['alias'], 'viewportWidth': width, 'cards': len(expected), 'everyTitleAndText': 'passed', 'zipCrcAndManifest': 'passed' if retained else 'additional viewport ZIP not retained; see full browser protocol', 'fullFreshPngRestore': 'passed', 'newDirectedConnections': 'passed', 'scormZipSha256': hashlib.sha256(archive.read_bytes()).hexdigest() if retained else None})
print(json.dumps(report, ensure_ascii=False, indent=2))
