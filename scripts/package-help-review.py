"""Bundle the runnable help-editor review with examples and actual QA evidence."""
from pathlib import Path
import hashlib,json,subprocess,sys,zipfile
root=Path(__file__).resolve().parent.parent
if len(sys.argv)!=2:raise SystemExit('Aufruf: python3 scripts/package-help-review.py AUSGABE.zip')
output=Path(sys.argv[1]).resolve()
if output.exists() or output.suffix!='.zip':raise SystemExit('Bitte einen neuen ZIP-Ausgabepfad wählen.')
try:
 commit=subprocess.check_output(['git','-C',str(root),'rev-parse','HEAD'],text=True,stderr=subprocess.DEVNULL).strip()
 branch=subprocess.check_output(['git','-C',str(root),'branch','--show-current'],text=True,stderr=subprocess.DEVNULL).strip()
except (FileNotFoundError,subprocess.CalledProcessError):
 version=json.loads((root/'PROJECT-VERSION.json').read_text());commit=version['sourceCommit'];branch=version['sourceBranch']
items={}
for source,target in [('artifacts/MysteryBoard-Universal.html','MysteryBoard-Universal.html'),('artifacts/MysteryBoard-Universal-SCORM-1.2.zip','MysteryBoard-Universal-SCORM-1.2.zip'),('docs/HELP-EDITOR-ABNAHME.md','HELP-EDITOR-ABNAHME.md'),('LEHRKRAEFTE-ANLEITUNG.md','LEHRKRAEFTE-ANLEITUNG.md'),('AI-ANLEITUNG.md','AI-ANLEITUNG.md')]:items[target]=(root/source).read_bytes()
for folder,target in [('examples/help-editor','beispiele'),('docs/test-evidence/help-editor','pruefnachweise')]:
 for p in sorted((root/folder).rglob('*')):
  if p.is_file():items[target+'/'+p.relative_to(root/folder).as_posix()]=p.read_bytes()
assert any(n.endswith('.mysteryboard') for n in items),'Beispieldateien fehlen'
assert 'pruefnachweise/RESULTS.json' in items,'Abschließende Prüfergebnisse fehlen'
items['QUELLSTAND.json']=(json.dumps({'repository':'Feerson1617/Vorlage-Mysteryboard','commit':commit,'branch':branch,'baseCommit':'5a6899a7a67465c932c340c60ccde56e989586b4','documentFormat':3},indent=2)+'\n').encode()
items['START-HIER.md']='''# MysteryBoard – grafische Hilfen unabhängig prüfen

Öffnet MysteryBoard-Universal.html in einem vollständigen Browser. Falls lokale Dateien gesperrt sind, im entpackten Ordner mit `python3 -m http.server 8765` lokal bereitstellen und danach vom Netz trennen. Dies ist keine öffentliche Veröffentlichung.

Unter `beispiele/` liegen die tatsächlichen Browser-Ausgaben: Ursachen- und Konflikt-Aufgaben, ein erneut bearbeitbarer Entwurf, die vollständige Schüler-PNG und eine Revision. Die Dateien sind neutrale Prüfbeispiele ohne fachliche Musterlösung.

1. Aufgabe über „Mystery bearbeiten“ laden, „Lehrkräftemodus – Mystery bearbeiten“ wählen, Kürzel eingeben.
2. „Hilfetext festlegen“ öffnen: Denkimpuls ändern, freiwillige Nummernhilfe einschalten, Gruppen und jede Kartenzuordnung prüfen. Keine Karte wird automatisch zugeordnet.
3. „Hilfe aus Schülersicht ansehen“ öffnen und beide Hilfestufen, Nummernfarben und Legende prüfen. Bewegungen aus dieser Vorschau dürfen nicht in die Aufgabe übernommen werden.
4. Hilfe übernehmen, Entwurf sichern, neue Sitzung öffnen und vergleichen. „Schülerversion erstellen“ erzeugt eine neutrale Datei.
5. SCORM-ZIP unverändert in einen eigenen lokalen Unterordner entpacken und launch.html über denselben lokalen Server öffnen. Aufgabe importieren, Teamname eingeben, Touch, Verbindungen, Farben, Undo/Redo und Druck testen.
6. Original-PNG herunterladen, Anwendung schließen und in frischer SCORM-Sitzung wiederherstellen. Die Hilfe ist zunächst ausgeblendet. Alle Karten, Medien, Positionen, Beziehungen, Kategorien und Team müssen erhalten bleiben.
7. Neue Revision importieren und deren Hilfen vergleichen; anschließend die alte Schüler-PNG öffnen. Sie muss ihren ursprünglichen vollständigen Inhalt wiederherstellen.

Die SHA-256-Liste mit `sha256sum -c SHA256SUMS.txt` bzw. macOS `shasum -a 256 -c SHA256SUMS.txt` prüfen. Die volle Quellvorlage wird separat geliefert; die üblichen Build-/Testbefehle und tatsächlichen Ergebnisse stehen im Prüfbericht.

Die grafische Funktion braucht weder JSON noch Programmcode. Der Lehrkräftemodus ist kein geschützter Zugang und speichert nicht automatisch. Safari, echte Schul-iPads, itslearning, Canva und nativer Safari-Druck benötigen weiterhin einen echten Praxistest. Keine schulische Freigabe aus der Browseremulation ableiten.
'''.encode()
for name,data in list(items.items()):
 if name.endswith(('.md','.txt','.json')):
  for prefix in (b'/' + b'workspace/',b'/' + b'home/agent/',b'/' + b'opt/codex/',b'/' + b'tmp/'):data=data.replace(prefix,b'[testumgebung]/')
 items[name]=data
entries=[{'file':n,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()} for n,b in sorted(items.items())]
items['PRUEFSUMMEN.json']=(json.dumps({'sourceCommit':commit,'files':entries},indent=2)+'\n').encode()
items['SHA256SUMS.txt']=''.join(f'{e["sha256"]}  {e["file"]}\n' for e in entries).encode()
output.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for name,data in sorted(items.items()):z.writestr(name,data)
with zipfile.ZipFile(output) as z:
 assert z.testzip() is None and len(z.namelist())==len(set(z.namelist()))
 for e in entries:assert hashlib.sha256(z.read(e['file'])).hexdigest()==e['sha256']
print(json.dumps({'file':output.name,'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'sourceCommit':commit,'entries':len(items)},indent=2))
