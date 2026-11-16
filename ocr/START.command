#!/bin/sh
cd "$(dirname "$0")" || exit 1
command -v python3 >/dev/null || { echo 'Python 3 fehlt. Bitte Python 3 von python.org installieren oder das OCR-SCORM-Paket im LMS verwenden.'; read answer; exit 1; }
python3 start-ocr.py
