#!/usr/bin/env bash
set -euo pipefail

MONTH="${1:-$(date +%Y-%m)}"
OUTDIR="${2:-/var/www/augur/public_exports}"
PORT="${PORT:-8787}"
BASE="${AUGUR_API_BASE:-http://127.0.0.1:${PORT}}"

curlj(){ curl -sS "$@" | python3 -m json.tool; }

echo "[1] restart + wait" >&2
sudo systemctl restart augur-api || true
for i in $(seq 1 80); do
  if curl -fsS "${BASE}/health" >/dev/null 2>&1; then break; fi
  sleep 0.1
done

echo "[2] accounts" >&2
curlj "${BASE}/api/accounts" | head -n 120

echo "[3] snapshot" >&2
curlj -X POST "${BASE}/api/snapshot"

echo "[4] monthly ${MONTH}" >&2
curlj -X POST -H 'content-type: application/json' -d "{\"month\":\"${MONTH}\"}" "${BASE}/api/monthly"

echo "[5] export_public ${OUTDIR} ${MONTH}" >&2
curlj -X POST -H 'content-type: application/json' -d "{\"outDir\":\"${OUTDIR}\",\"month\":\"${MONTH}\"}" "${BASE}/api/export/public"

echo "[6] show latest.json" >&2
python3 -m json.tool < "${OUTDIR}/latest.json" | head -n 160

echo "[7] ls" >&2
ls -la "${OUTDIR}"
