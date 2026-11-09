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

for entry in marketing-site:14321:fixture; do
  IFS=: read -r app port seed_option <<< "$entry"
  state="$state_root/$app"
  cd "$root/apps/$app"
  pnpm exec wrangler d1 execute DB --local --persist-to "$state" --command 'SELECT 1'
  mapfile -t databases < <(find "$state/v3/d1" -name '*.sqlite' ! -name metadata.sqlite -type f)
  if [[ "${#databases[@]}" != 1 ]]; then
    echo "$app: expected one local D1 database, found ${#databases[@]}" >&2
    exit 1
  fi
  seed="$root/apps/$app/seed/seed.json"
  fixture=false
  if [[ "$mode" == fixture && "$seed_option" == fixture ]]; then
    fixture=true
    seed="$state/fixture.json"
    node "$root/scripts/seo-fixture.mjs" seed "$seed"
  elif [[ "$mode" == fixture ]]; then
    seed="$root/apps/$app/$seed_option"
  fi
  pnpm exec emdash seed "$seed" --database "${databases[0]}" --skip-media
  if [[ "$fixture" == true ]]; then
    node "$root/scripts/seo-fixture.mjs" seo "${databases[0]}"
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
  cleanup
  worker_pid=""
done
exit "$status"
