#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ -z "${PRIVATE_PDF_URL:-}" ]]; then
  echo "::error::P01 gesperrt: Repository-Actions-Secret STUDIO_QA_PDF_URL fehlt." >&2
  exit 1
fi
if [[ "$PRIVATE_PDF_URL" != https://* ]]; then
  echo "::error::P01 gesperrt: STUDIO_QA_PDF_URL muss eine HTTPS-Downloadadresse sein." >&2
  exit 1
fi

destination=$1
mkdir -p "$(dirname "$destination")"
download=$(mktemp "${destination}.XXXXXX")
trap 'rm -f -- "$download"' EXIT

if ! curl --disable --silent --fail --location --globoff \
    --proto '=https' --proto-redir '=https' --connect-timeout 15 \
    --max-time 60 --max-redirs 5 --max-filesize 2000000 \
    --output "$download" --url "$PRIVATE_PDF_URL"; then
  echo "::error::P01 gesperrt: Die private PDF ist nicht abrufbar. Bitte Ablaufzeit, Downloadberechtigung und HTTPS-Direktdownload prüfen." >&2
  exit 1
fi

expected=07efd68057712f082819456c099a971f335c035f70b70076cda79c35bf914693
if ! printf '%s  %s\n' "$expected" "$download" | shasum -a 256 -c >/dev/null 2>&1; then
  echo "::error::P01 gesperrt: Die heruntergeladene Datei hat nicht die SHA-256 der Original-PDF. Bitte das unveränderte Original verlinken." >&2
  exit 1
fi

mv -- "$download" "$destination"
echo 'P01-Originaldatei empfangen. SHA-256 geprüft.'
