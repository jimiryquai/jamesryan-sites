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
trap cleanup EXIT

status=0
for entry in marketing-site:14321 digital-garden:14322; do
  app="${entry%:*}"
  port="${entry#*:}"
  state="$state_root/$app"
  cd "$root/apps/$app"
  pnpm exec wrangler d1 execute DB --local --persist-to "$state" --command 'SELECT 1'
  mapfile -t databases < <(find "$state/v3/d1" -name '*.sqlite' ! -name metadata.sqlite -type f)
  if [[ "${#databases[@]}" != 1 ]]; then
    echo "$app: expected one local D1 database, found ${#databases[@]}" >&2
    exit 1
  fi
  pnpm exec emdash seed seed/seed.json --database "${databases[0]}" --skip-media
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
  cleanup
  worker_pid=""
done
exit "$status"
