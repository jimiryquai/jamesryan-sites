#!/usr/bin/env bash
# Run from the app directory; consume only this build's .emdash/migrations.json.
set -euo pipefail
app="${1:?app required}"
environment="${2:?environment required}"
operation="${3:?status, apply, check or recover required}"
lock_id="${4:-}"
case "$app" in marketing-site|digital-garden) ;; *) exit 2 ;; esac
case "$environment" in staging|production) ;; *) exit 2 ;; esac
variable="${app^^}_${environment^^}_MIGRATION_FINGERPRINT"
variable="${variable//-/_}"
args=(--wrangler-config wrangler.jsonc --account-id "${CLOUDFLARE_ACCOUNT_ID:?account required}")
if [[ "$environment" == staging ]]; then args+=(--wrangler-env staging); fi
case "$operation" in
  check) exec pnpm exec emdash migrate --check "${args[@]}" ;;
  status|apply|recover) ;;
  *) exit 2 ;;
esac
status_file=$(mktemp)
trap 'rm -f "$status_file"' EXIT
pnpm exec emdash migrate --status --json "${args[@]}" | tee "$status_file"
if [[ "$operation" == status ]]; then exit 0; fi
if [[ -z "${EXPECTED_TARGET_FINGERPRINT:-}" ]]; then
  node --input-type=module - "$status_file" "$variable" <<'JS'
import { readFileSync } from 'node:fs';
const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const fingerprint = report.target.fingerprint;
if (!/^[a-f0-9]{64}$/.test(fingerprint)) throw new Error('Invalid status target fingerprint');
console.error(`Missing GitHub Actions variable ${process.argv[3]}. Review the status target above, then run:`);
console.error(`gh variable set ${process.argv[3]} --repo "${process.env.GITHUB_REPOSITORY}" --body '${fingerprint}'`);
JS
  exit 1
fi
if [[ "$operation" == recover ]]; then
  [[ "$lock_id" =~ ^[0-9]+$ ]] || { echo 'Recovery requires a numeric lock id' >&2; exit 2; }
  args+=(--take-over-lock "$lock_id")
fi
pnpm exec emdash migrate --json "${args[@]}" --expected-target-fingerprint "$EXPECTED_TARGET_FINGERPRINT" < /dev/null
