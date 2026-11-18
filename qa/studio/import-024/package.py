"""Mac release gate. Never include original materials in public artifacts."""
from pathlib import Path
import hashlib,json,os,re,shutil,sys,zipfile
src,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
def one(name):
    files=list(src.rglob(name))
    if len(files)!=1:raise SystemExit(f'Freigabe gesperrt: {name} ({len(files)} Nachweise).')
    return files[0]
def obj(p):return json.loads(p.read_text())
def sha(p):
    with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def log(p):return re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',p.read_text())
original=obj(one('P01-Messwerte.json'));workflow=obj(one('P01-Mac-SCORM.json'))
assert original['passed'] and original['regions']==[9,12,11] and len(original['matchedText'])==31
assert workflow['native'] and workflow['app']==dict(version='0.2.4',packaged=True) and workflow['studentPngRestored'] and workflow['sha256']==original['pdfSha256']
matrix=obj(one('Matrix.json'))['cases']
assert set(matrix)=={f'P{i:02}' for i in range(2,19)} and all(e['state']!='fehlgeschlagen' for e in matrix.values())
graphics=obj(one('Grafikvergleich.json'));assert len(graphics)>=7
assert obj(one('Importgrenzen.json'))['passed']
assert all(v.get('savedReopened') and v.get('scormContentMatchesProject') for k,v in matrix.items() if k!='P16')
for case in ['P04','P05']:
    flow,=[p for p in src.rglob('Editor-Nachher.json') if p.parent.name==case]
    evidence=obj(flow);assert evidence['passed'] and evidence['native'] and evidence['studentPngRestored'] and evidence['external']==[] and evidence['manualImageRetained']
native=obj(one('Mac-Pinnwand-Tests.json'));old=obj(one('native-macos.json'))
assert native['passed'] and old['passed'] and native['arch']=='arm64' and native['sourceCommit']==os.environ['GITHUB_SHA']
assert obj(one('Mac-Starthilfe-SCORM.json'))['passed']
assert all(obj(one(f'Schueler-Stress-{b}.json'))['passed'] for b in ['webkit','chromium'])
rc=log(one('RC2.log'));assert re.search(r'\b4 passed',rc)
browser=sum(int(re.findall(r'(\d+) passed',log(one(f'Chromium-{i}.log')))[-1]) for i in range(1,5))
assert browser>=272
data=int(re.search(r'Tests\s+(\d+) passed',log(one('Daten.log')))[1]);assert data>=187
sizes={}
for version in ['0.2.2','0.2.3','0.2.4']:
    sizes[version]=obj(one(f'Fenster-{version}.json'))['sizes'];assert len(sizes[version])==4
prefix='MysteryBoard-Studio-0.2.4'; dname=f'{prefix}-Mac-Apple-Silicon.dmg'
dmg=one(dname);shutil.copyfile(dmg,out/dname)
status={'P01':'Bestanden – automatisch erkannt; Aufgabenstellung bewusst zugewiesen.'}
for k,row in matrix.items():
    status[k]='Bestanden – automatisch erkannt.' if row['state']=='erkannt' else ('Bestanden – sicher abgelehnt; neues flaches PDF erforderlich.' if k=='P16' else 'Bestanden – Unsicherheit erkannt und manuell kontrollierbar.')
lines=['# MysteryBoard Studio 0.2.4 für Apple Silicon','',f"Quellcommit `{os.environ['GITHUB_SHA']}`. GitHub-Actions-Lauf {os.environ['GITHUB_RUN_ID']}.",'',f'{data} Datenprüfungen, {browser} Chromium-Tests, 4 RC2-Prüfungen. Native Tests auf macOS ARM64, Chromium und WebKit.','', '## Importfälle','',*[f'- {k}: {v}' for k,v in sorted(status.items())],'','## Fenster','','Die Zielmaße beziehen sich auf das gesamte native Fenster. Das PNG erfasst den Inhalt.','']
for i,row in enumerate(sizes['0.2.4']):
    size=' × '.join(map(str,row['requestedWindow']));comp=[v[i] for v in sizes.values()]
    equal=len({tuple(x['inner']) for x in comp})==1
    heights=' / '.join(str(round(x['board']['height'],1)) for x in comp)
    lines.append(f"- {size}: {'erreicht' if row['exact'] else 'nicht in der Zielgröße geprüft'}, Inhalt {row['inner']}, PNG {row['pixels']}. "+(f"Pinnwandhöhen 0.2.2 / 0.2.3 / 0.2.4: {heights}." if equal else "Vergleich wegen unterschiedlicher Inhaltsgrößen offen."))
lines+=['','## Einsatzgrenzen','','Die Original-PDF wurde über ihren SHA-256-Wert identifiziert. Der öffentliche Nachweis enthält ausschließlich Messwerte. Reale Bedienung mit physischem Trackpad, verwaltete Schul-iPads und itslearning bleiben eigene Praxistests. Die App ist ad hoc signiert und nicht Apple-notarisiert.']
(out/'ABNAHME.md').write_text('\n'.join(lines)+'\n')
(out/'INSTALLATION.md').write_text('# Installation\n\nDMG öffnen, MysteryBoard Studio in Programme kopieren und starten. Die App ist für Apple Silicon gebaut und ad hoc signiert. Auf verwalteten Macs die lokale Freigabe der Administration verwenden.\n')
review=out/(prefix+'-Sichtpruefung.zip')
with zipfile.ZipFile(review,'w',zipfile.ZIP_DEFLATED) as z:
    z.write(out/'ABNAHME.md','ABNAHME.md')
    z.write(Path(__file__).with_name('ABNAHME.md'),'Methodik.md')
    files=[*src.rglob('Fenster-*.json'),*src.rglob('*-Fenster-*.png'),one('P01-Messwerte.json'),one('P01-Mac-SCORM.json'),one('Matrix.json'),one('Grafikvergleich.json'),one('Importgrenzen.json'),one('Neutrale-Pruefdokumente.zip'),one('native-macos.json'),one('Mac-Pinnwand-Tests.json'),one('Mac-Starthilfe-SCORM.json'),*src.rglob('Schueler-Stress-*.json'),one('Daten.log'),one('RC2.log'),*src.rglob('Chromium-*.log'),*src.rglob('Vollstaendigkeitskontrolle.png'),*src.rglob('Korrigierte-Bildzuordnung.png'),*src.rglob('P??.png')]
    files.extend(p for p in src.rglob('SCORM-Bildkarte.png') if p.parent.name in ('P04','P05'))
    for p in sorted(set(files)):z.write(p,p.relative_to(src))
files=[out/dname,out/'INSTALLATION.md',out/'ABNAHME.md',review]
(out/'SHA256SUMS.txt').write_text(''.join(f'{sha(p)}  {p.name}\n' for p in files))
with zipfile.ZipFile(out/(prefix+'-Mac-Apple-Silicon-KOMPLETTPAKET.zip'),'w') as z:
    for p in [*files,out/'SHA256SUMS.txt']:z.write(p,p.name)
