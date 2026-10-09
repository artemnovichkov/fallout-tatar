#!/usr/bin/env bash
# Regenerates all pixel art into public/assets/ (needs python3 + Pillow + numpy).
# Optional: PREVIEW=path.png to also write a 3x contact sheet.
set -euo pipefail
cd "$(dirname "$0")/.."
PY="python3 -I"
$PY tools/art/gen_chars.py
$PY tools/art/gen_tiles.py
$PY tools/art/gen_objects.py
$PY tools/art/gen_icons.py
$PY tools/portrait.py
$PY tools/art/gen_portraits.py
if [ -n "${PREVIEW:-}" ]; then $PY tools/art/preview.py "$PREVIEW"; fi
