"""Create the independent review ZIP from tracked artifacts; no network required."""
from pathlib import Path
import hashlib,json,subprocess,sys,zipfile
root=Path(__file__).resolve().parent.parent
if len(sys.argv)!=2:raise SystemExit('Aufruf: python3 scripts/package-acceptance.py AUSGABE.zip')
output=Path(sys.argv[1]).resolve()
if output.exists() or output.suffix.lower()!='.zip':raise SystemExit('Neuen ZIP-Ausgabepfad wählen.')
try:commit=subprocess.check_output(['git','-C',str(root),'rev-parse','HEAD'],text=True,stderr=subprocess.DEVNULL).strip()
except (subprocess.CalledProcessError,FileNotFoundError):commit=json.loads((root/'PROJECT-VERSION.json').read_text())['sourceCommit']
files={
 'MysteryBoard-Universal.html':'artifacts/MysteryBoard-Universal.html',
 'MysteryBoard-Universal-SCORM-1.2.zip':'artifacts/MysteryBoard-Universal-SCORM-1.2.zip',
 'MysteryBoard-Beispiel-Schuelerversion.mysteryboard':'examples/abnahme/MysteryBoard-Beispiel-Schuelerversion.mysteryboard',
 'MysteryBoard-Beispiel-Lehrkraftentwurf.mysteryboard':'examples/abnahme/MysteryBoard-Beispiel-Lehrkraftentwurf.mysteryboard',
 'MysteryBoard-Beispiel-Schuelerarbeitsstand.png':'examples/abnahme/MysteryBoard-Beispiel-Schuelerarbeitsstand.png',
 'MysteryBoard-Beispiel-Ueberarbeitet.mysteryboard':'examples/abnahme/MysteryBoard-Beispiel-Ueberarbeitet.mysteryboard',
 'MysteryBoard-Beispiel-Schuelerstand.mysteryboard':'examples/abnahme/MysteryBoard-Beispiel-Schuelerstand.mysteryboard',
 'UNIVERSAL-ABNAHME.md':'docs/UNIVERSAL-ABNAHME.md',
 'UNABHAENGIGE-PRUEFUNG.md':'docs/UNABHAENGIGE-PRUEFUNG.md',
 'BEISPIELE.md':'examples/abnahme/README.md',
 'protokolle/aktuelle-pruefung.txt':'docs/test-evidence/universal-authoring/lieferung-beispiele.txt',
 'protokolle/scorm-pruefung.txt':'docs/test-evidence/universal-authoring/lieferung-scorm.txt',
 'protokolle/datentests.txt':'docs/test-evidence/universal-authoring/lieferung-unit.txt',
 'protokolle/bisherige-vollstaendige-suite.txt':'docs/test-evidence/universal-authoring/full-check.txt',
 'protokolle/bisherige-ergebnisse.json':'docs/test-evidence/universal-authoring/RESULTS.json',
 'protokolle/scorm-manifest.json':'docs/test-evidence/universal-authoring/lieferung-scorm-manifest.json',
}
items={}
for name,path in files.items():
 data=(root/path).read_bytes()
 if name.endswith(('.md','.txt','.json')):
  for prefix in (b'/' + b'workspace/',b'/' + b'home/agent/',b'/' + b'opt/codex/',b'/' + b'tmp/'):data=data.replace(prefix,b'[fruehere-testumgebung]/')
 items[name]=data
report=f'''# Aktueller Prüfbericht für die unabhängige Prüfung\n\nQuellcommit: `{commit}` auf `feat/mysteryboard-universal-authoring`. Die vollständige Anwendung liegt byteidentisch als HTML und im SCORM-Paket vor. Der frühere Entwicklungsbericht UNIVERSAL-ABNAHME.md dokumentiert den damaligen lokalen Status; er wird durch den aktuellen Lieferbericht ergänzt.\n\nAktuell erneut ausgeführt: 93 Datentests, drei umfassende SCORM-Unterrichtsabläufe und der zusätzliche Browser-Rundlauf mit den hier enthaltenen Beispielen. Der ursprüngliche vollständige Lauf mit 150 Browser- und 93 Datentests und die vier separaten RC2-Tests sind in den beiliegenden Protokollen bzw. dem Entwicklungsbericht dokumentiert. Das Beispiel enthält zwölf Karten, 9/3 Gruppen, drei Bilder und eine strukturierte Tabelle. Seine Schüler-PNG wurde in frischen Standalone- und SCORM-Sitzungen vollständig wiederhergestellt; anschließend wurde eine andere Version geladen und die alte PNG erneut unvermischt geöffnet. Die SCORM-Mock-API erhielt nur LMSInitialize und LMSFinish, keine Datenwerte.\n\nRealtests für Safari, verwaltete Schul-iPads, itslearning und ggf. Canva sind offen; WebKit 26.5/27.2 und nativer Safari-Systemdruck wurden nicht erfolgreich getestet. Keine schulische Freigabe. PDF-Seiten müssen vor dem Bildimport lokal umgewandelt werden.\n\nHistorische Testprotokolle in diesem Paket ersetzen nur maschinenspezifische Cloud-Pfadpräfixe durch `[fruehere-testumgebung]/`; der Wortlaut der Testergebnisse bleibt erhalten. Die ursprünglichen Protokolle liegen im Git-Stand.\n'''
items['AKTUELLER-PRUEFBERICHT.md']=report.encode();items['QUELLSTAND.json']=(json.dumps({'repository':'Feerson1617/Vorlage-Mysteryboard','branch':'feat/mysteryboard-universal-authoring','commit':commit},indent=2)+'\n').encode()
entries=[{'file':n,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()} for n,b in sorted(items.items())]
items['PRUEFSUMMEN.json']=(json.dumps({'sha256':entries},indent=2)+'\n').encode()
items['SHA256SUMS.txt']=''.join(f'{e["sha256"]}  {e["file"]}\n' for e in entries).encode()
output.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for name,data in sorted(items.items()):z.writestr(name,data)
with zipfile.ZipFile(output) as z:
 assert z.testzip() is None and len(z.namelist())==len(set(z.namelist()))
 for e in entries:assert hashlib.sha256(z.read(e['file'])).hexdigest()==e['sha256']
print(json.dumps({'file':output.name,'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'sourceCommit':commit,'entries':len(items)},indent=2))
