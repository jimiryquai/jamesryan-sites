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
  pnpm exec emdash seed "$seed" --database "${databases[0]}" --uploads-dir "$state/uploads"
  bucket=$(node --input-type=module -e 'import fs from "node:fs"; console.log(JSON.parse(fs.readFileSync("dist/server/wrangler.json")).r2_buckets.find(bucket => bucket.binding === "MEDIA").bucket_name)')
  # The seed CLI writes filesystem uploads; this Worker serves media from R2.
  while IFS=$'\t' read -r key content_type; do
    pnpm exec wrangler r2 object put "$bucket/$key" \
      --file "$state/uploads/$key" --content-type "$content_type" --local --persist-to "$state"
  done < <(node --input-type=module - "${databases[0]}" <<'NODE'
import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync(process.argv[2]);
for (const row of db.prepare('SELECT storage_key, mime_type FROM media').all()) {
  console.log(`${row.storage_key}\t${row.mime_type}`);
}
db.close();
NODE
  )
  if [[ -n "${RENDERED_EVIDENCE_DIR:-}" ]]; then
    mkdir -p "$RENDERED_EVIDENCE_DIR"
    node --input-type=module - "${databases[0]}" "$RENDERED_EVIDENCE_DIR/media-rows.json" <<'NODE'
import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';
const db = new DatabaseSync(process.argv[2]);
writeFileSync(process.argv[3], JSON.stringify(db.prepare('SELECT id, filename, storage_key, alt, caption, width, height FROM media').all(), null, 2));
db.close();
NODE
  fi
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
  node "$root/scripts/check-rendered-media.mjs" "http://127.0.0.1:$port" "$seed" "${RENDERED_EVIDENCE_DIR:-}" || status=1
  cleanup
  worker_pid=""
done
exit "$status"
