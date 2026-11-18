"""Explicit private delivery. Output must stay outside the source repository.
Usage: package-private.py PUBLIC.zip CASES.json DOWNLOADS PREVIEWS AUDIT_DIR OUT.zip
"""
import hashlib
import json
from pathlib import Path
import sys
import zipfile

public, case_file, downloads, previews, audit, output = map(Path, sys.argv[1:7])
source = Path(__file__).resolve().parents[2]
output = output.resolve()
assert not output.is_relative_to(source), 'Private Originaldaten außerhalb des Repositorys ablegen.'
assert not output.exists()
cases = json.loads(case_file.read_text())
payloads = {}
with zipfile.ZipFile(public) as z:
    assert z.testzip() is None
    for name in z.namelist():
        if name.startswith(('projekt/', 'pruefprotokolle/')) or name in ('MysteryBoard-Universal.html', 'MysteryBoard-Universal-SCORM-1.2.zip', 'PDF-KARTEN-UND-PFEILE-ANLEITUNG.md', 'PDF-KARTEN-UND-PFEILE-PRUEFBERICHT.md', 'VERSION.json', 'ERGEBNIS.json'):
            payloads[name] = z.read(name)
    version = json.loads(z.read('VERSION.json'))
version.update({'privateOriginalDelivery': True, 'containsUploadedOriginals': True, 'containsDerivedOriginalTasks': True})
payloads['VERSION.json'] = (json.dumps(version, indent=2)+'\n').encode()
case_records = []
for index, case in enumerate(cases, 1):
    alias = case['alias']
    label = ''.join(c for c in case.get('fileLabel', alias) if c.isalnum() or c in '-_')
    original = Path(case['pdf']).resolve()
    original_name = 'originale/'+label+'.pdf'
    payloads[original_name] = original.read_bytes()
    record = {**case, 'pdf': '../'+original_name, 'uploadedFileName': original.name, 'uploadedSha256': hashlib.sha256(original.read_bytes()).hexdigest()}
    sco_name = f'MysteryBoard-{label}-SCORM-1.2.zip'
    record['classroomZip'] = '../'+sco_name
    case_records.append(record)
    payloads[sco_name] = (downloads / f'{alias}-1024-SCORM-1.2.zip').read_bytes()
    for kind, german in (('aufgabe', 'Aufgabe'), ('entwurf', 'Entwurf')):
        payloads[f'MysteryBoard-{label}-{german}.mysteryboard'] = (downloads / f'{alias}-1024-{kind}.mysteryboard').read_bytes()
    for path in downloads.iterdir():
        if path.is_file() and (path.name.startswith(alias+'-') or path.name.startswith('regionen-'+alias+'-')) and path.suffix.lower() != '.zip':
            payloads['browserdownloads/'+path.name] = path.read_bytes()
    for path in previews.glob(f'document-{index}-*'):
        if path.is_file():
            payloads['originalvergleich/'+path.name] = path.read_bytes()
    parsed = json.loads((previews / f'document-{index}-parsed.json').read_text())
    sections = parsed.get('pdfLayout', {}).get('sections', [])
    payloads[f'originalvergleich/{label}-Dokumentabschnitte.txt'] = '\n\n'.join(f'Seite {b["page"]}\n{b["text"]}' for b in sections).encode()
    rows = [f'# {label}: vollständiger Kartenvergleich', '']
    assert len(parsed['cards']) == len(case['cards'])
    for n, (expected, actual) in enumerate(zip(case['cards'], parsed['cards']), 1):
        assert expected['title'] == actual['title'] and expected['text'] == actual['text']
        rows += [f'## {n}: {expected["title"] or "Kartenfeld"}', '', 'Original:', '', expected['text'], '', 'Erkannt:', '', actual['text'], '', 'Ergebnis: Überschrift, Text und sichtbare Absätze stimmen überein.', '']
    payloads[f'originalvergleich/{label}-Kartenvergleich.md'] = '\n'.join(rows).encode()
for name in ('original-browser-tests.log', 'independent-output-verification.json', 'card-by-card-comparison.json', 'baseline-summary.jsonl', 'final-preview.log'):
    payloads['private-pruefprotokolle/'+name] = (audit / name).read_bytes()
payloads['private-cases.json'] = (json.dumps(case_records, ensure_ascii=False, indent=2)+'\n').encode()
payloads['PRIVAT-START.md'] = '''# Privates Original-Abnahmepaket

Dieses Paket enthält die hochgeladenen Originale und daraus im Browser erzeugte Aufgaben. Es wird nicht öffentlich veröffentlicht. Die zwei einzelnen Aufgaben-SCORM-ZIPs unentpackt in itslearning importieren; das große Abnahmepaket selbst ist keine SCORM-Ressource.

Der vollständige Kartenvergleich steht unter originalvergleich/. Dort bleiben Kopf-/Fragetexte und Arbeitsauftrag zusätzlich als Text verfügbar. Die übrigen vorläufigen PDF-Bereichsdaten gehören nicht zum MysteryBoard-Speicherformat.

Die beiden Haupt-SCORM-Pakete stammen aus den tatsächlichen 1024er-Browserabläufen. Die weiteren Ansichtsgrößen sind vollständig protokolliert; ihre Aufgaben-, Entwurfs-, PNG- und Wiederherstellungsdateien liegen in browserdownloads/. Wiederholte Programm-ZIPs dieser zusätzlichen Ansichtsgrößen sind im Paket nicht nochmals enthalten; deren SHA-256-Werte stehen im unabhängigen Prüfprotokoll.

Unabhängige Kontrolle im entpackten Paket:

    python3 projekt/qa/pdf-regions/verify-outputs.py private-cases.json browserdownloads MysteryBoard-Universal.html

Für eine neue vollständige Browserprüfung nach npm ci / Chromium-Installation im Verzeichnis projekt:

    npm run build:universal
    node scripts/prepare-universal-tests.mjs
    PDF_REGION_CASES=../private-cases.json PDF_REGION_DOWNLOADS=dist/private-downloads AUTHORING_EXAMPLES_DIR=dist/private-downloads npx playwright test tests/browser/pdf-regions.spec.ts --reporter=list

Die Originale liegen außerhalb des Quellprojekts. Originaldaten und daraus erzeugte Aufgaben nicht in öffentliche Repositories kopieren. Die tatsächliche Safari-/Schul-iPad-/itslearning-Abnahme und native Safari-Druckfunktion bleiben offen. VERSION.json, SHA256SUMS.txt und PRUEFSUMMEN.json nennen Quellstand und Integrität.
'''.encode()
entries = [{'file': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()} for name, data in sorted(payloads.items())]
payloads['PRUEFSUMMEN.json'] = (json.dumps(entries, ensure_ascii=False, indent=2)+'\n').encode()
payloads['SHA256SUMS.txt'] = ''.join(e['sha256']+'  '+e['file']+'\n' for e in entries).encode()
output.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name, data in sorted(payloads.items()):
        z.writestr(name, data)
with zipfile.ZipFile(output) as z:
    assert z.testzip() is None
    for e in entries:
        assert hashlib.sha256(z.read(e['file'])).hexdigest() == e['sha256']
result = {'file': output.name, 'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'sourceCommit': version['sourceCommit'], 'entries': len(payloads), 'zipCrc': 'passed', 'allEntryChecksums': 'passed', 'private': True}
output.with_suffix('.integrity.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(result, indent=2))
