#!/usr/bin/env bash
set -euo pipefail

DATA="/var/www/augur/apps/api/data/accounts.json"

ACCOUNT_ID="acct_xrpl_0eeb48ab"
CHAIN="xrpl"
LABEL="xrpl-net-proof-2"
ADDR="rB3WNZc45gxzW31zxfXdkx8HusAhoqscPn"
NETWORK="mainnet"

mkdir -p "$(dirname "$DATA")"

python3 - <<PY
import json, os
from datetime import datetime, timezone

path="$DATA"

def now_iso():
  return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")

base={"ok":True,"accounts":[]}
if os.path.exists(path):
  try:
    with open(path,"r",encoding="utf-8") as f:
      base=json.load(f)
  except Exception:
    base={"ok":True,"accounts":[]}

if not isinstance(base,dict):
  base={"ok":True,"accounts":[]}
if "accounts" not in base or not isinstance(base["accounts"],list):
  base["accounts"]=[]

junk_addrs=set(["ADDRESS","rYOUR_ADDRESS"])
base["accounts"]=[
  a for a in base["accounts"]
  if not (isinstance(a,dict) and a.get("address_or_identifier") in junk_addrs)
]

real={
  "account_id":"$ACCOUNT_ID",
  "type":"onchain_wallet",
  "chain":"$CHAIN",
  "label":"$LABEL",
  "address_or_identifier":"$ADDR",
  "network":"$NETWORK",
  "created_at": now_iso(),
  "status":"active"
}

found=False
for i,a in enumerate(base["accounts"]):
  if isinstance(a,dict) and a.get("account_id")==real["account_id"]:
    base["accounts"][i]=real
    found=True
    break
if not found:
  base["accounts"].append(real)

tmp=path+".tmp"
with open(tmp,"w",encoding="utf-8") as f:
  json.dump(base,f,indent=2,sort_keys=False)
  f.write("\n")
os.replace(tmp,path)

print(json.dumps({"ok":True,"action":"seed_real_account_only","path":path,"count":len(base["accounts"])}, indent=2))
PY

echo "[check] file exists + parses" >&2
ls -la "$DATA" >&2
python3 -m json.tool "$DATA" | head -n 120
