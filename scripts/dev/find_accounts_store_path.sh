#!/usr/bin/env bash
set -euo pipefail

ROOT="/var/www/augur/apps/api/src"

echo "[1] search for accounts store usage" >&2
grep -RIn --line-number -E 'accounts\.json|data\/accounts|ACCOUNTS|accountsFile|readFile.*accounts|writeFile.*accounts' "$ROOT" || true

echo >&2
echo "[2] list data dir" >&2
ls -la /var/www/augur/apps/api/data || true

echo >&2
echo "[3] show seeded file path and first lines" >&2
ls -la /var/www/augur/apps/api/data/accounts.json || true
head -n 40 /var/www/augur/apps/api/data/accounts.json || true

echo >&2
echo "[4] live API read" >&2
curl -sS http://127.0.0.1:8787/api/accounts | python3 -m json.tool | head -n 120
