#!/usr/bin/env bash
set -euo pipefail

ROOT="/var/www/augur"
MONTH="${1:-}"

[ -n "$MONTH" ] || {
  echo "[augur] usage: export_public.sh YYYY-MM"
  exit 1
}

SRC="$ROOT/vault/sample_vault/reports/monthly/$MONTH/summary.json"
DST_DIR="$ROOT/public_data"
DST="$DST_DIR/summary.json"

if [ ! -f "$SRC" ]; then
  echo "[augur] missing monthly summary: $SRC"
  echo "[augur] run: augur monthly $MONTH"
  exit 1
fi

mkdir -p "$DST_DIR"
cp -f "$SRC" "$DST"

echo "[augur] exported $MONTH -> public_data/summary.json"
