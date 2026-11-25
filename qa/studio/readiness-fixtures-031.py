"""External authoring samples; independent standard-library PNG and JSON writer."""
import base64
import json
import random
import struct
import sys
import zlib
from copy import deepcopy
from pathlib import Path

def compact(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()

def picture(index, width=1000, height=800):
    def chunk(kind, body):
        return struct.pack(">I", len(body))+kind+body+struct.pack(">I", zlib.crc32(kind+body))
    # Three independent colour cross-sections; uncompressed IDAT preserves the real byte load.
    raw = bytearray()
    texture = iter(random.Random(310 + index).randbytes(width*height*3))
    for y in range(height):
        raw.append(0)
        for x in range(width):
            band = (y + (x * (index + 1) // 12)) // 75
            raw.extend(((83 + 23*band + x//100 + (next(texture) & 15)) % 256, (150 + index*33 - 11*band + (next(texture) & 15)) % 256, (57 + band*15 + (next(texture) & 15)) % 256))
    png = b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",width,height,8,2,0,0,0))+chunk(b"IDAT",zlib.compress(raw,0))+chunk(b"IEND",b"")
    return "data:image/png;base64,"+base64.b64encode(png).decode()

def card(i):
    return dict(id=i,title="Ausschnitt "+str(i),text="Vergleicht die Schichten.",group="required")

def single(cards):
    return dict(kind="single",content=dict(title="Farbige Schichtmodelle",instructions="Beschreibt die Abfolge in den schematischen Profilen.",cards=cards))

def calibrated(project, target):
    c = deepcopy(project["content"])
    c.update(id="0"*36,version="1.0.0",cardGroups=dict(required=dict(label="Pflichtkarte",prefix=""),extension=dict(label="Vertiefungskarte",prefix="V")),
             startLayout=dict(mode="ordered"),recovery="session",initial=dict(cards=[dict(id=k["id"],x=(k["id"]-1)*480,y=0,color=0) for k in c["cards"]],edges=[],categories=[""]*6))
    task=dict(format="MysteryBoard",formatVersion=3,kind="task",contentHash="0"*64,content=c)
    gap=target-len(compact(task))
    assert gap>=0, gap
    for k in project["content"]["cards"]:
        for field,limit in [("text",4000),("source",1000)]:
            if field not in k or not gap: continue
            n=min(gap,limit-len(k[field]))
            k[field]+=(" Modellvergleich."*((n+16)//16))[:n]
            gap-=n
    assert not gap,gap

def create(folder):
    folder.mkdir(parents=True,exist_ok=True)
    def emit(name, project):
        (folder/(name+".mysteryboard")).write_bytes(compact(dict(format="MysteryBoardAI",formatVersion=1,kind="project",project=project)))
    pics=[picture(i) for i in range(3)]
    base=single([dict(card(i+1),image=p,imageAlt="Schichtprofil "+str(i+1),source="Synthetisches Prüfmaterial") for i,p in enumerate(pics)])
    calibrated(base,9_617_958)
    emit("Gross",base)
    near=single([dict(card(i),source="Modell") for i in range(1,101)])
    for i in range(4):
        near["content"]["cards"][i]["image"]=picture(i,1200)
    table=dict(headers=["A","B","C","D","E","F"],rows=[["層"*120]*6 for _ in range(20)])
    for k in near["content"]["cards"]: k["table"]=table
    calibrated(near,19_980_000)
    emit("Grenze",near)
    emit("Gemischt",dict(kind="collection",title="Material vergleichen",levels=[dict(name="Bildmaterial",content=base["content"]),dict(name="Text",content=single([card(1)])["content"])]))
    for n in [1,2,4,12]:
        emit("Niveaus-"+str(n),dict(kind="collection",title="Vergleich",defaultRecovery="extended",levels=[dict(name="Stufe "+str(i),content=single([card(j) for j in range(1,101)])["content"]) for i in range(1,n+1)]))
    hidden=single([card(i) for i in range(1,4)])
    hidden["author"]=dict(hiddenCards=[1,2,3])
    emit("Versteckt",hidden)
    duplicate=single([card(1),card(2)])
    duplicate["content"]["help"]=dict(categories=[dict(id="a",label="Ursachen",color="#157846",cardIds=[1]),dict(id="b",label="ursachen",color="#215587",cardIds=[2])])
    emit("Doppelt",duplicate)
    missing=single([dict(card(1),imageAlt="Fehlendes Bild")])
    emit("Fehlend",missing)
    ref=single([card(1)])
    ref["studentHints"]=[dict(id=1,**{"from":1},to=2,direction=1,label="Beleg")]
    emit("Referenz",ref)
    emit("Unbekannt",single([dict(card(1),neu=True)]))
    (folder/"Defekt.mysteryboard").write_bytes(b'{"format":')
if __name__=="__main__":create(Path(sys.argv[1]))
