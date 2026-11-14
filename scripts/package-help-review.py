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
for source,target in [('artifacts/MysteryBoard-Universal.html','MysteryBoard-Universal.html'),('artifacts/MysteryBoard-Universal-SCORM-1.2.zip','MysteryBoard-Universal-SCORM-1.2.zip'),('docs/HELP-EDITOR-ABNAHME.md','HELP-EDITOR-ABNAHME.md'),('docs/HELP-EDITOR-FINAL.md','AKTUELLER-PRUEFBERICHT.md'),('LEHRKRAEFTE-ANLEITUNG.md','LEHRKRAEFTE-ANLEITUNG.md'),('AI-ANLEITUNG.md','AI-ANLEITUNG.md'),('docs/HELP-EDITOR-FINAL-PRUEFAUFTRAG.md','UNABHAENGIGER-PRUEFAUFTRAG.md')]:items[target]=(root/source).read_bytes()
for folder,target in [('examples/help-editor','beispiele'),('docs/test-evidence/help-editor','pruefnachweise')]:
 for p in sorted((root/folder).rglob('*')):
  if p.is_file():items[target+'/'+p.relative_to(root/folder).as_posix()]=p.read_bytes()
for name in ['Hilfe-Lehrkraftentwurf.mysteryboard','Hilfe-Ursachen.mysteryboard','Hilfe-Nutzungskonflikte.mysteryboard','Hilfe-Sechs-eigene-Gruppen.mysteryboard','Hilfe-Ohne-farbige-Hilfe.mysteryboard','Hilfe-Schuelerarbeitsstand.png','Hilfe-Ueberarbeitet.mysteryboard','Hilfe-60-Karten-Entwurf.mysteryboard','Hilfe-60-Karten-Schuelerarbeitsstand.png']:
 assert 'beispiele/'+name in items, 'Benötigtes Beispiel fehlt: '+name
for name in ['pruefen.mjs','reproduce-preview.mjs','package.json','package-lock.json','README.md']:
 items['browserpruefung/'+name]=(root/'qa/help-review'/name).read_bytes()
assert 'pruefnachweise/final/RESULTS.json' in items,'Aktuelle Abschlussprüfung fehlt'
# Keep the current results unambiguous at the top level. Preserve history with
# its original context inside the project and the earlier report below.
for name in ['RESULTS.json','full-check.txt','browser-summary.json','rc2.txt']:
 items['pruefnachweise/'+name]=items['pruefnachweise/final/'+name]
items['HELP-EDITOR-ABNAHME.md']=b'Historischer Bericht zum Ausgangsstand 9aa16fd. Aktueller Stand: AKTUELLER-PRUEFBERICHT.md.\n\n'+items['HELP-EDITOR-ABNAHME.md']
items['QUELLSTAND.json']=(json.dumps({'repository':'Feerson1617/Vorlage-Mysteryboard','commit':commit,'branch':branch,'baseCommit':'5a6899a7a67465c932c340c60ccde56e989586b4','documentFormat':3,'reviewBaseCommit':'d7b41c20a8d773248f71f858ce18f5ce1b5c51d8'},indent=2)+'\n').encode()
items['START-HIER.md']='''# MysteryBoard – grafische Hilfen unabhängig prüfen

Öffnet MysteryBoard-Universal.html in einem vollständigen Browser. Falls lokale Dateien gesperrt sind, im entpackten Ordner mit `python3 -m http.server 8765` lokal bereitstellen und danach vom Netz trennen. Dies ist keine öffentliche Veröffentlichung.

Unter `beispiele/` liegen die tatsächlichen Browser-Ausgaben: Ursachen- und Konflikt-Aufgaben, ein erneut bearbeitbarer Entwurf, die vollständige Schüler-PNG und eine Revision. Die Dateien sind neutrale Prüfbeispiele ohne fachliche Musterlösung.

1. Aufgabe über „Mystery bearbeiten“ laden, „Lehrkräftemodus – Mystery bearbeiten“ wählen, Kürzel eingeben.
2. „Hilfen bearbeiten“ öffnen: Denkimpuls ändern, freiwillige Nummernhilfe einschalten, Gruppen und jede Kartenzuordnung prüfen. Nach Nummer oder Titel suchen; bei Bedarf mehrere Karten gemeinsam einer vorhandenen Gruppe zuordnen. Keine Karte wird automatisch zugeordnet.
3. „Hilfe aus Schülersicht ansehen“ öffnen und beide Hilfestufen, Nummernfarben und Legende prüfen. Die Vorschau darf keine Sicherung, Dateiimporte, Teamänderung oder Druckfunktion anbieten. Bewegungen und Verbindungen werden beim Schließen verworfen.
4. Hilfe übernehmen, Entwurf sichern, neue Sitzung öffnen und vergleichen. „Schülerversion erstellen“ erzeugt eine neutrale Datei.
5. SCORM-ZIP unverändert in einen eigenen lokalen Unterordner entpacken und launch.html über denselben lokalen Server öffnen. Aufgabe importieren, Teamname eingeben, Touch, Verbindungen, Farben, Undo/Redo und Druck testen.
6. Original-PNG herunterladen, Anwendung schließen und in frischer SCORM-Sitzung wiederherstellen. Die Hilfe ist zunächst ausgeblendet. Alle Karten, Medien, Positionen, Beziehungen, Kategorien und Team müssen erhalten bleiben.
7. Neue Revision importieren und deren Hilfen vergleichen; anschließend die alte Schüler-PNG öffnen. Sie muss ihren ursprünglichen vollständigen Inhalt wiederherstellen.

Die SHA-256-Liste mit `sha256sum -c SHA256SUMS.txt` bzw. macOS `shasum -a 256 -c SHA256SUMS.txt` prüfen. Die volle Quellvorlage wird separat geliefert; die üblichen Build-/Testbefehle und tatsächlichen Ergebnisse stehen im Prüfbericht.

## Automatisierter unabhängiger Lauf

Im vollständig entpackten Abnahmepaket:

```sh
cd browserpruefung
npm ci
npx playwright install chromium
npm test
```

Node.js 24 und npm werden nur für diese technische Prüfung benötigt. Ist ein System-Chromium vorhanden, verwendet der Prüfcode ihn; alternativ `CHROMIUM_PATH` setzen oder Playwrights Browser installieren. Unter Linux werden passende Browser-Systembibliotheken benötigt. Der Code startet selbst einen lokalen Prüfserver, extrahiert die tatsächliche SCORM-ZIP und arbeitet danach offline. Er importiert keinen Anwendungscode. Die Original-PNG wird zusätzlich unabhängig mit Node-zlib und SHA-256 gelesen. Ergebnisse, echte Arbeitsdateien, PDFs und Screenshots landen unter `browserpruefung/ergebnisse/`. Die App selbst benötigt diese Prüfwerkzeuge nicht.

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
