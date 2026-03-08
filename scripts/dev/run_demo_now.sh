#!/usr/bin/env bash
set -euo pipefail

MONTH="${1:-$(date -u +%Y-%m)}"
OUTDIR="${2:-/var/www/augur/public_exports}"

echo "[run] month=$MONTH outdir=$OUTDIR" >&2

sudo systemctl restart augur-api

# wait for API
for i in $(seq 1 50); do
  if curl -fsS http://127.0.0.1:8787/health >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

echo "[run] accounts" >&2
curl -sS http://127.0.0.1:8787/api/accounts | python3 -m json.tool | head -n 120

echo "[run] monthly" >&2
curl -sS -X POST -H 'content-type: application/json' \
  -d "{\"month\":\"$MONTH\"}" \
  http://127.0.0.1:8787/api/monthly | python3 -m json.tool

echo "[run] export_public" >&2
curl -sS -X POST -H 'content-type: application/json' \
  -d "{\"outDir\":\"$OUTDIR\",\"month\":\"$MONTH\"}" \
  http://127.0.0.1:8787/api/export/public | python3 -m json.tool

echo "[run] latest.json" >&2
cat "$OUTDIR/latest.json" | python3 -m json.tool | head -n 160

echo "[run] ls $OUTDIR" >&2
ls -la "$OUTDIR"
