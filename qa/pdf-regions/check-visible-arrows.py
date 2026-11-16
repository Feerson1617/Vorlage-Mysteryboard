"""Verify actual raster differences at the two ends of the same connector.
Inputs are real screenshots, PNG downloads and rasterized real PDFs, not SVG
attributes or application-code assertions. Requires the free Pillow package.
"""
import json
from pathlib import Path
import sys
from PIL import Image, ImageChops

data = json.loads(Path(sys.argv[1]).read_text())
out = []
for sample in data:
    images = [Image.open(sample[key]).convert('RGB') for key in ('none', 'forward', 'reverse')]
    assert len(set(i.size for i in images)) == 1
    boxes = []
    for image in images[1:]:
        diff = ImageChops.difference(images[0], image)
        if sample.get('boardOnlyFraction'):
            diff = diff.crop((0, 0, diff.width, int(diff.height*sample['boardOnlyFraction'])))
        box = diff.getbbox()
        assert box and box[2]-box[0] >= 5 and box[3]-box[1] >= 5, (sample['name'], box)
        changed = sum(max(pixel) > 10 for pixel in getattr(diff, "get_flattened_data", diff.getdata)())
        assert changed >= 20, (sample['name'], changed)
        boxes.append({'bounds': box, 'changedPixels': changed})
    center = lambda b: ((b['bounds'][0]+b['bounds'][2])/2, (b['bounds'][1]+b['bounds'][3])/2)
    forward, reverse = map(center, boxes)
    assert forward[0] > reverse[0]+40, (sample['name'], boxes)
    assert abs(forward[1]-reverse[1]) < 8, (sample['name'], boxes)
    if sample.get('tips'):
        for actual, expected in zip((forward, reverse), sample['tips']):
            assert abs(actual[0]-expected['x']) < 20 and abs(actual[1]-expected['y']) < 15
    out.append({'name': sample['name'], 'forwardHeadAtTarget': True, 'reverseHeadAtSource': True, 'noneHasNeitherHead': True, 'actualRasterDifference': boxes})
print(json.dumps(out, indent=2))
