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
for entry in "marketing-site:$port:fixture"; do
  IFS=: read -r app port seed_option <<< "$entry"
  state="$state_root/$app"
  cd "$root/apps/$app"
  seed="$root/apps/$app/seed/seed.json"
  fixture=false
  if [[ "$mode" == fixture && "$seed_option" == fixture ]]; then
    fixture=true
    mkdir -p "$state"
    seed="$state/fixture.json"
    node "$root/scripts/seo-fixture.mjs" seed "$seed"
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
    node "$root/scripts/seo-fixture.mjs" seo "$database"
  fi
  ./node_modules/.bin/wrangler dev --config dist/server/wrangler.json --local \
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
  node "$root/scripts/validate-rendered-seo.mjs" "http://127.0.0.1:$port" || status=1
  if [[ "$fixture" == true ]]; then
    node "$root/scripts/seo-fixture.mjs" verify "http://127.0.0.1:$port" || status=1
  fi
  node "$root/scripts/check-rendered-media.mjs" "http://127.0.0.1:$port" "$seed" "${RENDERED_EVIDENCE_DIR:-}" || status=1
  cleanup
  worker_pid=""
done
exit "$status"
