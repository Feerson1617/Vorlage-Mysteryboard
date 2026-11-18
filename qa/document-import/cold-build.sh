#!/bin/sh
# Run only from the root of a freshly extracted source ZIP.
set -eu
coldcheck_dir=cold-document-import-check
if [ -e "$coldcheck_dir" ]; then
  echo "Prüfordner existiert bereits. Bitte einen frisch entpackten Projektordner verwenden."
  exit 1
fi
mkdir "$coldcheck_dir"
cp artifacts/MysteryBoard-Universal.html "$coldcheck_dir/Referenz.html"
cp artifacts/MysteryBoard-Universal-SCORM-1.2.zip "$coldcheck_dir/Referenz-SCORM.zip"
node --version
npm --version
python3 --version
npm ci --cache /tmp/mysteryboard-document-import-npm-cache
npm run validate:mystery -- docs/test-evidence/document-import-integrity/downloads/import-docx-1024-entwurf.mysteryboard
npm run validate:mystery -- docs/test-evidence/document-import-integrity/downloads/import-pdf-1024-aufgabe.mysteryboard
node --input-type=module <<'CHECK'
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const dir = 'docs/test-evidence/document-import-integrity/downloads/';
const reference = JSON.parse(readFileSync('tests/fixtures/document-import/ORIGINAL-INHALTE.json'));
const word = JSON.parse(readFileSync(dir + 'import-docx-1024-entwurf.mysteryboard'));
const pdf = JSON.parse(readFileSync(dir + 'import-pdf-1024-aufgabe.mysteryboard'));
assert.equal(word.content.cards[0].source, reference.B[0].source);
assert.equal(word.content.cards[0].text, reference.B[0].paragraphs.join('\n\n'));
assert.equal(pdf.content.cards[0].source, reference.A[0].source);
console.log('Originaltext und genau eine Quelle in den echten Word-/PDF-Downloads bestätigt.');
CHECK
npm run create:mystery -- examples/ki-papierprobe/inhalt.json "$coldcheck_dir/Neue-Aufgabe.mysteryboard"
npm run validate:mystery -- "$coldcheck_dir/Neue-Aufgabe.mysteryboard"
cmp "$coldcheck_dir/Neue-Aufgabe.mysteryboard" examples/ki-papierprobe/Parkteich-Aufgabe-v1.mysteryboard
npm run build
npm run package:universal
cmp artifacts/MysteryBoard-Universal.html "$coldcheck_dir/Referenz.html"
cmp artifacts/MysteryBoard-Universal-SCORM-1.2.zip "$coldcheck_dir/Referenz-SCORM.zip"
echo "KALTSTART BESTANDEN: echte Word-/PDF-Importdokumente validiert; neue Aufgabe, Universal-HTML und SCORM bytegleich."
