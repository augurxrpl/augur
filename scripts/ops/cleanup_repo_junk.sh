#!/usr/bin/env bash
set -euo pipefail

cd /var/www/augur

rm -f PATH_FROM_GREP || true

rm -f apps/api/src/index.ts.bak.* || true

rm -f apps/api/src/augur_extras.ts || true
rm -f apps/api/src/augur_patch_routes.ts || true

rm -f scripts/augur_fix_all_now.sh || true
rm -f scripts/demo_artifact_flow.sh || true
rm -f scripts/diag_augur_cli.sh || true
rm -f scripts/fix_augur_all.sh || true
rm -f scripts/purge_junk_accounts.sh || true
rm -f scripts/recover_api.sh || true
rm -f scripts/recover_api_and_seed_accounts.sh || true
rm -f scripts/recover_api_wait_verify.sh || true
rm -f scripts/test_json_outputs.sh || true

rm -rf public_exports/ || true

echo '{"ok":true,"action":"cleanup_repo_junk"}'
