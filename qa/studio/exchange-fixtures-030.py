"""Independent, hand-authored classroom examples. No Studio components or hashes."""
import base64
import json
import sys
from pathlib import Path

def generate(folder):
    folder.mkdir(parents=True, exist_ok=True)
    def emit(name, project):
        envelope = dict(format="MysteryBoardAI", formatVersion=1, kind="project", project=project)
        (folder/name).write_text(json.dumps(envelope, indent=2, ensure_ascii=False)+"\n")
    material = Path(__file__).resolve().parents[2]/"tests/fixtures/document-import/bild-1.png"
    image = "data:image/png;base64,"+base64.b64encode(material.read_bytes()).decode()
    cards = [
        dict(id=1,title="Versuch im Schatten",text="Beide Gefäße stehen am selben Ort.",group="required",source="Fiktiver Unterrichtsversuch"),
        dict(id=2,title="Messreihe",text="Vergleicht die Werte.",group="required",
             table=dict(headers=["Gefäß","Temperatur"],rows=[["A","19 °C"],["B","23 °C"]]),source="Beispieldaten"),
        dict(id=3,title="Unsere Erklärung",text="",studentEditable=True,group="extension")]
    emit("KI-Einzel-Austausch.mysteryboard", dict(kind="single",content=dict(title="Gefäße im Schatten",subtitle="Warum unterscheiden sich die Werte?",instructions="Begründet eine Hypothese.",cards=cards)))
    levels=[]
    for index,(name,task) in enumerate([
        ("Entdecken","Beschreibt einen Unterschied und nutzt dazu die beiden Werte."),
        ("Vergleichen","Vergleicht die Messwerte und begründet eine Vermutung."),
        ("Erklären","Verknüpft die Messung mit einer überprüfbaren Erklärung."),
        ("Hinterfragen","Prüft eine Alternativerklärung und entwerft einen Kontrollversuch.")]):
        content=dict(title="Gefäße – "+name,instructions=task,subtitle="Wie lässt sich der Unterschied untersuchen?",cards=[dict(c) for c in cards])
        level=dict(name=name,description=task,content=content)
        if index==0: content["recovery"]="off"
        if index>0: content["help"]=dict(method=task)
        if index==2:
            content["help"]["categories"]=[dict(id="messung",label="Beobachten",color="#157846",cardIds=[1,2])]
            content["cards"][0].update(image=image,imageAlt="Neutrales Prüfbild",imageCaption="Bildbeispiel für die Materialansicht")
        if index==3: content["recovery"]="extended"
        if index>=2:
            level["author"]=dict(initials="QA",edges=[{"id":2,"from":2,"to":3,"direction":1,"label":"Privatbefund-QA"}])
            level["studentHints"]=[{"id":1,"from":1,"to":2,"direction":1,"label":"Messung zuordnen"}]
        levels.append(level)
    emit("KI-Niveaus-Austausch.mysteryboard",dict(kind="collection",title="Messwerte untersuchen",defaultRecovery="session",levels=levels))

if __name__=="__main__":
    generate(Path(sys.argv[1]))
