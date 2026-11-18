"""Compare PDF.js output to a second renderer at independently authored bounds."""
import json,sys
from pathlib import Path
import fitz
from PIL import Image,ImageChops,ImageStat
fixtures,out=map(Path,sys.argv[1:])
checks={}
for case,areas in {
    'P02':[(0,45,110,545,650)],
    'P03':[(0,82,376,262,496)],
    'P04':[(0,82,376,262,496),(0,321,400,465,496),(1,310,375,560,741)],
    'P05':[(0,45,110,545,650),(1,310,375,560,741)],
    'P06':[(0,45,110,545,650)],
    'P07':[(0,150,45,690,545),(1,55,150,555,690),(2,110,55,650,555)],
    'P09':[(0,45,110,545,650)]
}.items():
    with fitz.open(fixtures/(case+'.pdf')) as doc:
        checks[case]=[]
        for i,(page,*bounds) in enumerate(areas):
            # Render the visible page, then crop in rotated viewport coordinates.
            pm=doc[page].get_pixmap(matrix=fitz.Matrix(2,2),alpha=False)
            ref=Image.frombytes('RGB',[pm.width,pm.height],pm.samples).crop(tuple(round(v*2) for v in bounds))
            img=Image.open(out/(case+'-image-'+str(i)+'.png')).convert('RGB')
            assert abs(img.width/img.height-ref.width/ref.height)<.014,(case,i,img.size,ref.size)
            dims=ref.size
            delta=ImageChops.difference(ref,img.resize(dims,Image.Resampling.LANCZOS))
            tiles=[ImageStat.Stat(delta.crop((dims[0]*x//3,dims[1]*y//3,dims[0]*(x+1)//3,dims[1]*(y+1)//3))).mean for x in range(3) for y in range(3)]
            worst=max(max(t) for t in tiles)
            assert worst<14,(case,i,worst)
            checks[case].append({'page':page+1,'bounds':bounds,'pixels':list(img.size),'maxMeanRGBPerTile':round(worst,3)})
(out/'Grafikvergleich.json').write_text(json.dumps(checks,indent=2)+'\n')
