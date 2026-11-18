"""Independently decode actual PNGs and compare full task to actual SCO bytes.

python3 qa/studio/check-pngs.py EVIDENCE_DIRECTORY
Uses the existing standard-library PNG inspector, never the application codec.
"""
import base64
import importlib.util
import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

root = Path(sys.argv[1]).resolve()
inspector = Path(__file__).resolve().parents[1] / 'classroom-scorm/verify-delivery.py'
spec = importlib.util.spec_from_file_location('independent_png', inspector)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
out = root / 'PNG-Originalpruefung'
out.mkdir(exist_ok=True)
rows = []
for proof_path in sorted(root.glob('*-Wiederherstellung.json')):
    proof = json.loads(proof_path.read_text())
    png = root / Path(proof['originalPNG']).name
    candidates = [root / Path(proof['scorm']).name, root / 'Mac' / Path(proof['scorm']).name]
    scorm = next(p for p in candidates if p.exists())
    document = module.png_document(png.read_bytes())
    with zipfile.ZipFile(scorm) as z:
        assert z.testzip() is None
        assert set(z.namelist()) == {'app.html', 'launch.html', 'session.js', 'imsmanifest.xml'}
        manifest = ET.fromstring(z.read('imsmanifest.xml'))
        assert any(e.tag.split('}')[-1] == 'schemaversion' and e.text == '1.2' for e in manifest.iter())
        assert any(e.tag.split('}')[-1] == 'resource' and e.attrib.get('href') == 'launch.html' and
                   any(k.split('}')[-1] == 'scormtype' and v == 'sco' for k, v in e.attrib.items()) for e in manifest.iter())
        assert b'LMSSetValue' not in z.read('session.js')
        for element in manifest.iter():
            if element.tag.split('}')[-1] == 'file':
                assert element.attrib['href'] in z.namelist()
        html = z.read('app.html').decode()
    launch = json.loads(re.search(r'<script id="mysteryboard-launch" type="application/json">(.*?)</script>', html, re.S).group(1))
    task = json.loads(base64.b64decode(launch['task']))
    assert document['content'] == task['content'], (png.name, 'task content changed')
    assert document['contentHash'] == task['contentHash']
    assert len(document['work']['cards']) == proof['cards']
    assert len(document['work']['edges']) == 1
    assert document['work']['edges'][0]['direction'] == 1
    assert document['work']['edges'][0]['label'] == 'Begründeter Zusammenhang'
    assert proof['restoredEqual'] and proof['undoRedo']
    assert proof['externalRequests'] == []
    (out / (png.stem + '.json')).write_text(json.dumps(document, ensure_ascii=False, indent=2)+'\n')
    rows.append(dict(png=png.name, scorm=scorm.name, cards=proof['cards'],
                     pngCRCAndEmbeddedSHA256='passed', fullTaskIncludingMediaEqual=True,
                     savedDirection=1, freshSessionDOMEqual=True))
assert len(rows) >= 6
(root / 'PNG-Originalpruefung.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2)+'\n')
print(json.dumps(rows, ensure_ascii=False))
