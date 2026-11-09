#!/usr/bin/env bash
# Run from the app directory; consume only this build's .emdash/migrations.json.
set -euo pipefail
app="${1:?app required}"
environment="${2:?environment required}"
operation="${3:?status, apply, check or recover required}"
lock_id="${4:-}"
fail_argument() {
  printf '{"error":"%s"}\n' "$1"
  echo "$1" >&2
  exit 2
}
case "$app" in marketing-site|digital-garden) ;; *) fail_argument 'Unknown app' ;; esac
case "$environment" in staging|production) ;; *) fail_argument 'Unknown environment' ;; esac
variable="${app^^}_${environment^^}_MIGRATION_FINGERPRINT"
variable="${variable//-/_}"
args=(--wrangler-config wrangler.jsonc --account-id "${CLOUDFLARE_ACCOUNT_ID:?account required}")
if [[ "$environment" == staging ]]; then args+=(--wrangler-env staging); fi
case "$operation" in
  check) exec pnpm exec emdash migrate --check --json "${args[@]}" ;;
  status|apply|recover) ;;
  *) fail_argument 'Unknown migration operation' ;;
esac
status_file=$(mktemp)
trap 'rm -f "$status_file"' EXIT
pnpm exec emdash migrate --status --json "${args[@]}" > "$status_file"
if [[ "$operation" == status ]]; then cat "$status_file"; exit 0; fi
# Progress stays on stderr; stdout contains one machine-readable operation result.
cat "$status_file" >&2
if [[ -z "${EXPECTED_TARGET_FINGERPRINT:-}" ]]; then
  node --input-type=module - "$status_file" "$variable" <<'JS'
import { readFileSync } from 'node:fs';
const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const fingerprint = report.target.fingerprint;
if (!/^[a-f0-9]{64}$/.test(fingerprint)) throw new Error('Invalid status target fingerprint');
console.error(`Missing GitHub Actions variable ${process.argv[3]}. Review the status target above, then run:`);
const command = `gh variable set ${process.argv[3]} --repo "${process.env.GITHUB_REPOSITORY}" --body '${fingerprint}'`;
console.error(command);
console.log(JSON.stringify({ error: 'Missing reviewed target fingerprint', variable: process.argv[3], target: report.target, command }));
JS
  exit 1
fi
if [[ "$operation" == recover ]]; then
  [[ "$lock_id" =~ ^[0-9]+$ ]] || fail_argument 'Recovery requires a numeric lock id'
  args+=(--take-over-lock "$lock_id")
fi
pnpm exec emdash migrate --json "${args[@]}" --expected-target-fingerprint "$EXPECTED_TARGET_FINGERPRINT" < /dev/null
