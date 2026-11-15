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
npm run validate:mystery -- docs/test-evidence/document-import/downloads/import-docx-1024-entwurf.mysteryboard
npm run validate:mystery -- docs/test-evidence/document-import/downloads/import-pdf-1024-aufgabe.mysteryboard
npm run create:mystery -- examples/ki-papierprobe/inhalt.json "$coldcheck_dir/Neue-Aufgabe.mysteryboard"
npm run validate:mystery -- "$coldcheck_dir/Neue-Aufgabe.mysteryboard"
cmp "$coldcheck_dir/Neue-Aufgabe.mysteryboard" examples/ki-papierprobe/Parkteich-Aufgabe-v1.mysteryboard
npm run build
npm run package:universal
cmp artifacts/MysteryBoard-Universal.html "$coldcheck_dir/Referenz.html"
cmp artifacts/MysteryBoard-Universal-SCORM-1.2.zip "$coldcheck_dir/Referenz-SCORM.zip"
echo "KALTSTART BESTANDEN: echte Word-/PDF-Importdokumente validiert; neue Aufgabe, Universal-HTML und SCORM bytegleich."
