#!/usr/bin/env bash
set -euo pipefail

ROOT="/var/www/augur"
SRC="$ROOT/cli/augur"
DST="/usr/local/bin/augur"

[ -f "$SRC" ] || { echo "[augur] missing $SRC"; exit 1; }

# remove any legacy entrypoints

sudo install -m 0755 "$SRC" "$DST"
echo "[augur] installed $DST"
