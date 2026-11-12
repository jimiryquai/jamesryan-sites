#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
state_root="$(mktemp -d)"
worker_pid=""
cleanup() {
  if [[ -n "$worker_pid" ]]; then
    kill "$worker_pid" 2>/dev/null || true
    wait "$worker_pid" 2>/dev/null || true
  fi
  rm -f -- "$root/apps/marketing-site/dist/server/wrangler.unconfigured.json"
}
finish() {
  cleanup
  rm -rf -- "$state_root"
}
trap finish EXIT

status=0
mode="${1:-fixture}"
if [[ "$mode" != fixture && "$mode" != --real-seed ]]; then
  echo "usage: bash scripts/check-rendered-seo.sh [--real-seed]" >&2
  exit 2
fi

# Let the OS choose a free port so simultaneous worktree checks stay isolated.
port=$(node --input-type=module -e 'import net from "node:net"; const server = net.createServer(); server.listen(0, "127.0.0.1", () => { console.log(server.address().port); server.close(); });')
entries=("marketing-site:$port:fixture")
if [[ "$mode" == fixture ]]; then entries+=("marketing-site:$port:unpublished" "digital-garden:$port:code"); fi
for entry in "${entries[@]}"; do
  IFS=: read -r app port seed_option <<< "$entry"
  state="$state_root/$app-$seed_option"
  cd "$root/apps/$app"
  seed="$root/apps/$app/seed/seed.json"
  fixture=false
  if [[ "$mode" == fixture && ( "$seed_option" == fixture || "$seed_option" == unpublished ) ]]; then
    fixture=true
    mkdir -p "$state"
    seed="$state/fixture.json"
    seed_action=seed
    if [[ "$seed_option" == unpublished ]]; then seed_action=seed-unpublished; fi
    node "$root/scripts/seo-fixture.mjs" "$seed_action" "$seed"
  elif [[ "$seed_option" == code ]]; then
    seed="$state/fixture.json"
    node "$root/scripts/seo-fixture.mjs" seed-garden-code "$seed"
  elif [[ "$mode" == fixture ]]; then
    seed="$root/apps/$app/$seed_option"
  fi
  seed_result=$(node "$root/scripts/seed-local.mjs" "$root/apps/$app" "$seed" "$state")
  database=$(node --input-type=module -e 'console.log(JSON.parse(process.argv[1]).database)' "$seed_result")
  if [[ -n "${RENDERED_EVIDENCE_DIR:-}" ]]; then
    mkdir -p "$RENDERED_EVIDENCE_DIR"
    node --input-type=module - "$seed_result" "$RENDERED_EVIDENCE_DIR/media-rows.json" <<'NODE'
import { writeFileSync } from 'node:fs';
writeFileSync(process.argv[3], JSON.stringify(JSON.parse(process.argv[2]).media, null, 2));
NODE
  fi
  if [[ "$fixture" == true ]]; then
    node "$root/scripts/seo-fixture.mjs" seo "$database" "$seed"
  fi
  wrangler_config="dist/server/wrangler.json"
  if [[ "$seed_option" == unpublished ]]; then
    wrangler_config="dist/server/wrangler.unconfigured.json"
    node --input-type=module - "dist/server/wrangler.json" "$wrangler_config" <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
const config = JSON.parse(readFileSync(process.argv[2], 'utf8'));
delete config.vars;
writeFileSync(process.argv[3], JSON.stringify(config, null, 2));
NODE
  fi
  ./node_modules/.bin/wrangler dev --config "$wrangler_config" --local \
    --infer-origin-from-routes=false \
    --persist-to "$state" --port "$port" --inspector-port 0 &
  worker_pid=$!
  ready=false
  for _ in {1..60}; do
    if curl --silent --fail "http://127.0.0.1:$port/sitemap.xml" >/dev/null; then
      ready=true
      break
    fi
    if ! kill -0 "$worker_pid" 2>/dev/null; then break; fi
    sleep 1
  done
  if [[ "$ready" != true ]]; then
    echo "$app: worker failed to become ready" >&2
    exit 1
  fi
  echo "Validating $app"
  if [[ "$seed_option" == code ]]; then
    node "$root/scripts/seo-fixture.mjs" verify-code "http://127.0.0.1:$port" || status=1
    cleanup
    worker_pid=""
    continue
  fi
  node "$root/scripts/validate-rendered-seo.mjs" "http://127.0.0.1:$port" || status=1
  if [[ "$fixture" == true ]]; then
    verify_action=verify
    if [[ "$seed_option" == unpublished ]]; then verify_action=verify-unpublished; fi
    node "$root/scripts/seo-fixture.mjs" "$verify_action" "http://127.0.0.1:$port" "$database" || status=1
  fi
  node "$root/scripts/check-rendered-media.mjs" "http://127.0.0.1:$port" "$seed" "${RENDERED_EVIDENCE_DIR:-}" || status=1
  node "$root/scripts/check-rendered-markdown.mjs" "http://127.0.0.1:$port" "$seed" "${RENDERED_EVIDENCE_DIR:-}" || status=1
  cleanup
  worker_pid=""
done
exit "$status"
