#!/usr/bin/env bash
# Regenerates all pixel art into public/assets/ (needs python3 + Pillow + numpy).
# Optional: PREVIEW=path.png to also write a 3x contact sheet (PREVIEW_V2=path.png for the v2 assets).
set -euo pipefail
cd "$(dirname "$0")/.."
PY="python3 -I"
$PY tools/art/gen_chars.py
$PY tools/art/gen_chars_v2.py
$PY tools/art/gen_tiles.py
$PY tools/art/gen_tiles_v2.py
$PY tools/art/gen_objects.py
$PY tools/art/gen_objects_v2.py
$PY tools/art/gen_icons.py      # also appends the v2 icons (gen_icons_v2.py)
$PY tools/portrait.py
$PY tools/art/gen_portraits.py
$PY tools/art/gen_portraits_v2.py
if [ -n "${PREVIEW:-}" ]; then $PY tools/art/preview.py "$PREVIEW"; fi
if [ -n "${PREVIEW_V2:-}" ]; then $PY tools/art/preview_v2.py "$PREVIEW_V2"; fi
