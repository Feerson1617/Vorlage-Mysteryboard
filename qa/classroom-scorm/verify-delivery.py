"""Independent standard-library check of actual browser downloads.

No application codec or application source is imported.
Usage: python3 verify-delivery.py DELIVERY_DIR [BROWSER_DOWNLOAD_DIR]
"""
import base64
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import struct
import sys
import xml.etree.ElementTree as ET
import zipfile
import zlib


class HTML(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.modules, self.bootstrap, self.resources = [], [], []
        self.kind, self.parts = None, []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'script':
            self.kind = 'module' if attrs.get('type') == 'module' else 'bootstrap' if attrs.get('id') == 'mysteryboard-launch' else None
            self.parts = []
        if tag in ('script', 'link', 'img'):
            for name in ('src', 'href'):
                if name in attrs:
                    self.resources.append(attrs[name])

    def handle_data(self, data):
        if self.kind:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if tag == 'script':
            if self.kind == 'module':
                self.modules.append(''.join(self.parts))
            elif self.kind == 'bootstrap':
                self.bootstrap.append(json.loads(''.join(self.parts)))
            self.kind = None


def png_document(data):
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    offset, payloads, ended = 8, [], False
    while offset < len(data):
        length = struct.unpack('>I', data[offset:offset + 4])[0]
        tag = data[offset + 4:offset + 8]
        content = data[offset + 8:offset + 8 + length]
        assert len(content) == length
        crc = struct.unpack('>I', data[offset + 8 + length:offset + 12 + length])[0]
        assert zlib.crc32(tag + content) & 0xffffffff == crc
        if tag == b'mySt':
            payloads.append(content)
        offset += length + 12
        if tag == b'IEND':
            ended = True
            break
    assert ended and offset == len(data) and len(payloads) == 1
    payload = payloads[0]
    assert payload[:4] == b'MBX\x03'
    raw = zlib.decompress(payload[40:])
    assert len(raw) == struct.unpack('>I', payload[4:8])[0]
    assert hashlib.sha256(raw).digest() == payload[8:40]
    document = json.loads(raw)
    assert document['kind'] == 'student' and document['formatVersion'] == 3
    return document


def verify(root, downloads=None):
    blank_bytes = (root / 'MysteryBoard-Universal.html').read_bytes()
    blank = HTML(blank_bytes.decode())
    assert len(blank.modules) == 1 and blank.bootstrap == [None]
    assert all(url.startswith('data:') for url in blank.resources)
    report = {'blankHtmlBytes': len(blank_bytes), 'packages': [], 'snapshots': []}
    tasks = []
    for name in ('MysteryBoard-Universal-SCORM-1.2.zip', 'MysteryBoard-Zwoelf-Beobachtungen-SCORM-1.2.zip', 'MysteryBoard-Fuenf-Spuren-SCORM-1.2.zip'):
        path = root / name
        with zipfile.ZipFile(path) as archive:
            assert archive.testzip() is None
            assert sorted(archive.namelist()) == ['app.html', 'imsmanifest.xml', 'launch.html', 'session.js']
            manifest = ET.fromstring(archive.read('imsmanifest.xml'))
            ns = {'i': 'http://www.imsproject.org/xsd/imscp_rootv1p1p2'}
            assert manifest.find('i:metadata/i:schemaversion', ns).text == '1.2'
            resource = manifest.find('i:resources/i:resource', ns)
            assert resource.attrib['href'] == 'launch.html'
            assert {f.attrib['href'] for f in resource} == {'launch.html', 'session.js', 'app.html'}
            app_bytes = archive.read('app.html')
            assert 0 < len(app_bytes) < 10_000_000
            html = HTML(app_bytes.decode())
            assert html.modules == blank.modules
            assert all(url.startswith('data:') for url in html.resources)
            if name.startswith('MysteryBoard-Universal-'):
                assert app_bytes == blank_bytes and html.bootstrap == [None]
                wrapper = (archive.read('launch.html'), archive.read('session.js'))
                task = None
            else:
                assert wrapper == (archive.read('launch.html'), archive.read('session.js'))
                assert len(html.bootstrap) == 1 and html.bootstrap[0]['classroom'] is True
                task = json.loads(base64.b64decode(html.bootstrap[0]['task'], validate=True))
                assert set(task) == {'format', 'formatVersion', 'kind', 'content', 'contentHash'}
                assert task['kind'] == 'task' and task['formatVersion'] == 3
                assert task['content']['initial']['edges'] == []
                tasks.append(task)
            report['packages'].append({'file': name, 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'htmlBytes': len(app_bytes), 'taskId': task['content']['id'] if task else None, 'zipCrc': 'passed', 'samePlayerAndWrapper': True})
    assert [len(task['content']['cards']) for task in tasks] == [12, 5]
    assert tasks[0]['content']['id'] != tasks[1]['content']['id']
    for index, task in enumerate(tasks, 1):
        assert all(card['title'].startswith(f'Mystery {index}') for card in task['content']['cards'])
        if downloads:
            for width in (1024, 768, 600, 320):
                before = json.loads((downloads / f'vollstand-{index}-{width}.mysteryboard').read_bytes())
                restored = json.loads((downloads / f'restored-{index}-{width}.mysteryboard').read_bytes())
                continued = json.loads((downloads / f'continued-{index}-{width}.mysteryboard').read_bytes())
                png = png_document((downloads / f'original-png-{index}-{width}.png').read_bytes())
                assert before == png == restored
                assert before['content'] == task['content']
                assert len(before['work']['edges']) == 1 and len(continued['work']['edges']) == 2
                report['snapshots'].append({'task': index, 'viewportWidth': width, 'fullSnapshot': 'passed', 'pngCrcAndSha256': 'passed', 'continuedEdges': 2})
    return report


if __name__ == '__main__':
    print(json.dumps(verify(Path(sys.argv[1]), Path(sys.argv[2]) if len(sys.argv) > 2 else None), ensure_ascii=False, indent=2))
