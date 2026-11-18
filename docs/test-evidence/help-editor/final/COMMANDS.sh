#!/bin/sh
# From the extracted project root; Node.js 24, npm, Python3, Chromium required.
set -eu
npm ci
CLASSROOM_SCORM=1 npm run check
npm run test:rc2
npm run package:universal
# Independent black-box check, against an extracted acceptance ZIP:
# node qa/help-review/pruefen.mjs /path/to/acceptance
# Optional WebKit launch probe (requires matching browser installation/libs):
# node docs/test-evidence/help-editor/final/webkit-probe.mjs
