#!/usr/bin/env bash
set -euo pipefail

PORT=8787
SVC=augur-api
BASE="http://127.0.0.1:${PORT}"

log(){ printf '%s\n' "$*" >&2; }

log "[a] stop service"
sudo systemctl stop "$SVC" || true

log "[b] kill anything still on :$PORT"
PIDS="$(sudo lsof -iTCP:${PORT} -sTCP:LISTEN -nP 2>/dev/null | awk 'NR>1{print $2}' | sort -u || true)"
if [ -n "${PIDS:-}" ]; then
  log "killing: ${PIDS}"
  sudo kill -9 ${PIDS} || true
fi

log "[c] start service"
sudo systemctl start "$SVC" || true

log "[d] wait for listener + health"
for i in $(seq 1 60); do
  if ss -ltnp 2>/dev/null | grep -q ":${PORT}"; then
    if curl -fsS "${BASE}/health" >/dev/null 2>&1; then
      log "[e] OK: listener + health"
      ss -ltnp | grep ":${PORT}" || true
      curl -sS "${BASE}/health" | python3 -m json.tool
      exit 0
    fi
  fi
  sleep 0.2
done

log "[x] FAILED: service did not become healthy"
sudo systemctl status "$SVC" --no-pager || true
sudo journalctl -u "$SVC" -n 200 --no-pager || true
exit 1
