"""Read a real PNG backup with the Python standard library, not the app codec.
Usage: verify-png.py INPUT.png OUTPUT.json
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import sys

helper = Path(__file__).resolve().parent.parent / 'classroom-scorm/verify-delivery.py'
spec = importlib.util.spec_from_file_location('independent_png', helper)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
source, output = map(Path, sys.argv[1:3])
data = source.read_bytes()
assert len(data) <= 30_000_000
document = module.png_document(data)
output.write_text(json.dumps(document, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'file': source.name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'width': struct.unpack('>I', data[16:20])[0], 'height': struct.unpack('>I', data[20:24])[0], 'format': 'MBX3', 'crcAndEmbeddedSha256': 'passed', 'cards': len(document['work']['cards']), 'edges': len(document['work']['edges'])}))
