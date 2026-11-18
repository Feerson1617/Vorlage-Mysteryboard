#!/usr/bin/env bash
# Reproduce the independent comparison; this is NOT the missing Touch-Vergleich.cjs.
# Serve /workspace in a separate terminal first:
# python3 -m http.server 5175 --bind 127.0.0.1 --directory /workspace
set -euo pipefail
cd /workspace/Vorlage-Mysteryboard
mkdir -p /workspace/r1-baselines/{2518a53,545ece1} /workspace/mysteryboard-r1-evidence
for revision in 2518a53 545ece1; do
  for size in klein umfangreich; do
    git show "${revision}:artifacts/MysteryBoard-${size}.html" > "/workspace/r1-baselines/${revision}/MysteryBoard-${size}.html"
  done
done

MB_EVENT_MODE=pointer-only MB_REPORT=/workspace/mysteryboard-r1-evidence/2518a53-no-click.json \
  node scripts/r1-reference.mjs \
  http://127.0.0.1:5175/r1-baselines/2518a53/MysteryBoard-klein.html \
  http://127.0.0.1:5175/r1-baselines/2518a53/MysteryBoard-umfangreich.html

# A successful diagnostic command here means the expected fault (0/10) reproduced.
MB_EVENT_MODE=pointer-only MB_EXPECTED_DIALOGS=0 MB_REPORT=/workspace/mysteryboard-r1-evidence/545ece1-no-click.json \
  node scripts/r1-reference.mjs \
  http://127.0.0.1:5175/r1-baselines/545ece1/MysteryBoard-klein.html \
  http://127.0.0.1:5175/r1-baselines/545ece1/MysteryBoard-umfangreich.html

MB_EVENT_MODE=pointer-only MB_REPORT=/workspace/mysteryboard-r1-evidence/r1-no-click.json \
  node scripts/r1-reference.mjs \
  http://127.0.0.1:5175/Vorlage-Mysteryboard/artifacts/MysteryBoard-klein.html \
  http://127.0.0.1:5175/Vorlage-Mysteryboard/artifacts/MysteryBoard-umfangreich.html

MB_EVENT_MODE=native MB_REPORT=/workspace/mysteryboard-r1-evidence/r1-native.json \
  node scripts/r1-reference.mjs \
  http://127.0.0.1:5175/Vorlage-Mysteryboard/artifacts/MysteryBoard-klein.html \
  http://127.0.0.1:5175/Vorlage-Mysteryboard/artifacts/MysteryBoard-umfangreich.html
