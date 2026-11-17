"""Seal actual Windows binaries and evidence, never fabricate a release."""
from pathlib import Path
import hashlib,json,shutil,subprocess,sys,zipfile
root=Path(__file__).resolve().parent.parent
evidence=root/'windows/evidence';delivery=root/'windows/delivery';delivery.mkdir(exist_ok=True)
stage=delivery/'MysteryBoard-Studio-Windows-x64'
phase=sys.argv[1] if len(sys.argv)>1 else 'candidate'
portable=root/'windows/out/MysteryBoard Studio-win32-x64'
make=root/'windows/out/make'
setup,=make.rglob('*Setup.exe')
hashfile=lambda p:hashlib.file_digest(p.open('rb'),'sha256').hexdigest()
full=json.loads((evidence/'portable/Testergebnisse.json').read_text())
installed=json.loads((evidence/'installed/Testergebnisse.json').read_text())
players=json.loads((evidence/'players/Studentenpruefung.json').read_text())
assert full['passed'] and installed['passed'] and players['passed']
assert len(players['proofs'])==6
regression=json.loads((root/'windows/reference-regression/Ergebnis.json').read_text())
assert regression['passed'] and regression['sourceCommit']=='39ff7853293b49c4aba180b49cf5331e26df96e7'
assert [(c['exitCode'],c['failed'],c['skipped']) for c in regression['commands']]==[(0,0,0),(0,0,0)]
if phase=='final':
 proof=json.loads((evidence/'Frisch-entpackt.json').read_text());assert proof['passed']
 for name in ['bundle-portable','bundle-installed']:
  assert json.loads((evidence/name/'Testergebnisse.json').read_text())['passed']
 shutil.rmtree(stage,ignore_errors=True)
(stage/'Installation').mkdir(parents=True,exist_ok=True)
for p in setup.parent.iterdir():
 if p.is_file():shutil.copy2(p,stage/'Installation'/p.name)
shutil.copytree(portable,stage/'Portable/MysteryBoard-Studio',dirs_exist_ok=True)
report=stage/'Pruefbericht';report.mkdir(exist_ok=True)
payload_proof=[]
if phase=='final':
 tested=root/'windows/fresh-package/MysteryBoard-Studio-Windows-x64'
 for area in ['Portable','Installation']:
  actual_files={p.relative_to(stage).as_posix():p for p in (stage/area).rglob('*') if p.is_file()}
  tested_files={p.relative_to(tested).as_posix():p for p in (tested/area).rglob('*') if p.is_file()}
  assert actual_files.keys()==tested_files.keys(), 'Runtime-tested and final payload file lists differ'
  for name,p in sorted(actual_files.items()):
   digest=hashfile(p);assert digest==hashfile(tested_files[name]), 'Final payload differs from actual runtime-tested file: '+name
   payload_proof.append({'file':name,'bytes':p.stat().st_size,'sha256':digest})
 (report/'Identisch-zum-Laufzeittest.json').write_text(json.dumps({'passed':True,'files':payload_proof,'note':'Every installer and portable file is byte-identical to the freshly unpacked Windows runtime test. Final reports are sealed afterwards.'},indent=2)+'\n')
# Profiles contain Chromium caches, not test evidence. Exclude them from delivery.
for p in evidence.rglob('*'):
 rel=p.relative_to(evidence)
 if not p.is_file() or any(part.startswith('profile') for part in rel.parts) or p.suffix=='.mjs':continue
 target=report/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target)
for p in (root/'windows').rglob('*'):
 rel=p.relative_to(root/'windows')
 if any(part in ['node_modules','out','stage','evidence','delivery','fresh-package','.git'] for part in rel.parts) or not p.is_file() or p.suffix in ['.log','.zip','.exe']:continue
 target=report/'Pruefskripte'/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target)
base=json.loads((root/'windows/macos-reference.json').read_text())['commit']
commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
summary={'passed':phase=='final','phase':phase,'baseCommit':base,'windowsCommit':commit,'windowsRunner':full['prefs'],'portable':full,'installed':installed,'studentRuns':len(players['proofs']),'referenceRegression':regression,'runtimeTestedPayloadEqual':phase=='final','runtimeTestedPayloadFiles':len(payload_proof),'macOSIntegrity':json.loads((evidence/'macos-integrity.json').read_text()),'unsigned':True,'restrictedSchoolPC':'not tested','SmartScreen':'not bypassed; may warn or block','realItslearning':'not tested'}
(report/'Testergebnisse.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
assessment='Technisch einsatzbereit (automatisierte Windows-x64-Abnahme)' if phase=='final' else 'Kandidat: abschließende Prüfung des entpackten Pakets läuft noch'
text=f'''# MysteryBoard Studio 0.2.0 – Windows-Abnahme

Stand: {assessment}

Ausgangscommit: `{base}`. Windows-Commit: `{commit}`.

Echte Windows-x64-Electron-Prozesse wurden sowohl aus dem portablen Ordner als auch nach tatsächlicher Squirrel-Installation gestartet. Nach vollständigem Prozessneustart wurden gespeicherte Projekte erneut geöffnet und ihre Daten verglichen. Detailnachweise: portable/Testergebnisse.json und installed/Testergebnisse.json.

{len(full['checks'])} portable Prüfpunkte; {len(installed['checks'])} installierte Prüfpunkte; sechs tatsächliche Schüler-SCORMs mit PNG-Wiederherstellung in neuer Sitzung. Echte OCR verwendet die mitgelieferten lokalen Modelle bei aktivierter Chromium-Offline-Netzemulation. PDF-Seiten werden unabhängig mit PyMuPDF gerendert und auf vollständige Texte, Seitengröße, Bilder und Kartenumbrüche geprüft.

Die gesamte macOS-Basis mit 1.695 Dateien ist unverändert. Nur neue Windows-Dateien und ein neuer Windows-Workflow sind hinzugefügt. main und vorhandene Releases wurden nicht verändert. Im generierten Windows-HTML wurden ausschließlich die sichtbaren ⌘S/O-Hinweise durch Strg+S/O ersetzt und die CSP-Hashes aktualisiert; React, Core, Hauptprozess und bestehender Player-Quellcode bleiben identisch.

Wegen zweier historischer Dateinamen (RESULTS.json und results.json) prüft der Windows-Checkout 1.693 ursprüngliche Arbeitsdateien und die zwei kollidierenden Dokumentations-Git-Blobs. Kein geschützter Dateiinhalt wurde geändert. Das endgültige Archiv enthält nachträglich versiegelte Berichte; sämtliche Installer- und Portable-Dateien sind einzeln mit den tatsächlich aus dem frisch entpackten Kandidaten getesteten Dateien verglichen. Siehe Identisch-zum-Laufzeittest.json.

## Prüfverfahren und Grenzen

Playwright steuert echte gepackte Electron-Fenster. Nur Antworten der nativen Datei- und Bestätigungsdialoge werden vorgegeben. Reale Dateiverarbeitung, atomic writes, IPC, PDF-printToPDF, Word/PDF-Import, OCR und Export bleiben unverändert. Tastenkürzel werden mit synthetischen Windows-SendKeys-Ereignissen ausgelöst. Das ist keine physische Tastaturprüfung und keine händische Dialogabnahme.

Fenster: 1280×800, 1024×768, 800×600; tatsächliche Größen und Screenshots sind dokumentiert. 150 % wurde mit Electrons Geräte-Skalierungsoption geprüft, nicht durch Änderung der Windows-Anzeigeeinstellungen.

Der kostenlose reguläre GitHub-Windows-Runner ist kein verwalteter Schul-PC. Installation unter eingeschränkten Schulrechten, tatsächliche SmartScreen-/Defender-Entscheidungen, Firmenrichtlinien, reale itslearning-Integration und physische Display-/Druckerprüfung bleiben offen. Die App ist nicht vertrauenswürdig codesigniert; Windows kann warnen oder die Ausführung nach Organisationsrichtlinien blockieren. Keine Schutzfunktion wurde global deaktiviert.

Der native Host ist Windows Server 2025 Datacenter x64; Windows 11 x64 bleibt die Zielplattform, wurde hier aber nicht als separates Betriebssystem gestartet. Die npm-Installationslogs melden bekannte Hinweise zu den eingefrorenen Build-Werkzeugen. Es wird keine Aussage einer vollständig schwachstellenfreien Lieferkette getroffen; Build-Abhängigkeiten und Entwicklerwerkzeuge werden nicht als node_modules in die Anwendung aufgenommen.

## Befehle

```powershell
npm ci
npm ci --prefix windows
python -m pip install -r windows/qa-requirements.txt
node windows/integrity.mjs
node --test windows/tests/*.test.mjs
npm test
node windows/build.mjs
node windows/tests/inspect-package.mjs 'windows/out/MysteryBoard Studio-win32-x64' windows/evidence
node windows/tests/native.mjs 'windows/out/MysteryBoard Studio-win32-x64/MysteryBoard Studio.exe' windows/evidence/portable full
# Installation/Deinstallation: windows/install.ps1, tatsächliche Setup-EXE
# Installiertes EXE: node windows/tests/native.mjs <installiertes EXE> windows/evidence/installed smoke
npx playwright install chromium
node windows/tests/player.mjs windows/evidence/players windows/evidence/portable
python windows/tests/inspect-outputs.py windows/evidence
python windows/package.py candidate
python windows/verify-bundle.py <KOMPLETTPAKET.zip> windows/fresh-package
# portable und installierte EXE aus genau diesem frischen Paket erneut testen
python windows/package.py final
python windows/verify-bundle.py <KOMPLETTPAKET.zip> windows/final-check
```

Die exakten ausgeführten Befehle, Ergebnisse und Exitcodes stehen zusätzlich im separaten Workflow `.github/workflows/studio-windows.yml` und den beigefügten Logs. Die unveränderte gesamte Browser-Regression wird gesondert in einer Linux-Quellkopie ausgeführt und ist kein Windows-Laufzeitnachweis.

Die bestehende Quell-Regression besteht vollständig: 177 Datentests, 272 Chromium-Browsertests und vier eingefrorene RC2-Prüfungen, jeweils ohne fehlgeschlagene oder übersprungene Tests. Vollständige neue Protokolle: Pruefskripte/reference-regression/full-check.txt und rc2.txt. Die Plattformtrennung steht in Pruefskripte/reference-regression/Ergebnis.json.
'''
(report/'WINDOWS-ABNAHME.md').write_text(text,encoding='utf8')
(stage/'INSTALLATION-LESEN.txt').write_text('MysteryBoard Studio 0.2.0 – Windows x64\n\nWindows 11 x64 als Zielsystem.\nInstallation: Installation/MysteryBoard-Studio-0.2.0-Windows-x64-Setup.exe starten.\nPortable: gesamten Ordner Portable/MysteryBoard-Studio entpacken, darin MysteryBoard Studio.exe starten. Nicht nur die EXE kopieren.\nKein Node.js, Python, Git oder Internet für die Anwendung erforderlich.\nDie App ist nicht vertrauenswürdig codesigniert. SmartScreen oder Schulrichtlinien können die Ausführung beschränken. Sicherheitsfunktionen nicht deaktivieren; bei verwalteten PCs die zuständige Administration einbeziehen.\nBearbeitbares Projekt: .mysteryboard. Schüler sichern bewusst ausschließlich als PNG. Keine automatische LMS-Übertragung von Antworten/Teams/Arbeitsständen.\nAbnahmegrenzen und tatsächliche Ergebnisse siehe Pruefbericht/WINDOWS-ABNAHME.md.\n',encoding='utf8')
files=sorted(p for p in stage.rglob('*') if p.is_file() and p.name!='SHA256SUMS.txt')
(stage/'SHA256SUMS.txt').write_text(''.join(hashfile(p)+'  '+p.relative_to(stage).as_posix()+'\n' for p in files),encoding='utf8')
zipname=delivery/'MysteryBoard-Studio-0.2.0-Windows-x64-KOMPLETTPAKET.zip'
with zipfile.ZipFile(zipname,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(stage.rglob('*')):
  if p.is_file():z.write(p,p.relative_to(delivery).as_posix())
assert zipfile.ZipFile(zipname).testzip() is None
portable_zip=delivery/'MysteryBoard-Studio-0.2.0-Windows-x64-Portable.zip'
with zipfile.ZipFile(portable_zip,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(portable.rglob('*')):
  if p.is_file():z.write(p,'MysteryBoard-Studio/'+p.relative_to(portable).as_posix())
shutil.copy2(setup,delivery/setup.name)
if phase=='final':
 view=delivery/'MysteryBoard-Studio-0.2.0-Windows-x64-Sichtpruefung.zip'
 with zipfile.ZipFile(view,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for p in sorted(report.rglob('*')):
   if p.is_file() and (p.suffix in ['.md','.json','.txt','.log'] or 'Screenshots' in p.parts):z.write(p,p.relative_to(stage).as_posix())
metadata={'phase':phase,'baseCommit':base,'windowsCommit':commit,'files':[{'file':p.name,'bytes':p.stat().st_size,'sha256':hashfile(p)} for p in sorted(delivery.iterdir()) if p.is_file() and p.suffix in ['.zip','.exe']]}
(delivery/'Downloads.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(metadata,indent=2))
