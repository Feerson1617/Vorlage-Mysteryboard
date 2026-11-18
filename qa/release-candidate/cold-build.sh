#!/bin/sh
# Run from the root of the actually extracted source ZIP. No source checkout,
# installed node_modules, symlinks to another project or network runtime needed.
set -eu
coldcheck_dir=cold-check
if [ -e "$coldcheck_dir" ]; then
  echo "cold-check existiert bereits. Für diese Prüfung einen frisch entpackten Projektordner verwenden."
  exit 1
fi
mkdir "$coldcheck_dir"
cp artifacts/MysteryBoard-Universal.html "$coldcheck_dir/Referenz.html"
cp artifacts/MysteryBoard-Universal-SCORM-1.2.zip "$coldcheck_dir/Referenz-SCORM.zip"
node --version
npm --version
python3 --version
npm ci --cache /tmp/mysteryboard-rc-npm-cache
npm run validate:mystery -- examples/ki-papierprobe/inhalt.json
npm run create:mystery -- examples/ki-papierprobe/inhalt.json "$coldcheck_dir/Neue-Aufgabe.mysteryboard"
npm run validate:mystery -- "$coldcheck_dir/Neue-Aufgabe.mysteryboard"
npm run validate:mystery -- examples/ki-papierprobe/Parkteich-Lehrkraftentwurf-v1.mysteryboard
cmp "$coldcheck_dir/Neue-Aufgabe.mysteryboard" examples/ki-papierprobe/Parkteich-Aufgabe-v1.mysteryboard
npm run build
npm run package:universal
cmp artifacts/MysteryBoard-Universal.html "$coldcheck_dir/Referenz.html"
cmp artifacts/MysteryBoard-Universal-SCORM-1.2.zip "$coldcheck_dir/Referenz-SCORM.zip"
echo "KALTSTART BESTANDEN: neue importierbare Aufgabe, Universal-HTML und SCORM sind bytegleich zu den mitgelieferten Referenzen."
