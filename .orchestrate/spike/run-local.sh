#!/usr/bin/env bash
# THROWAWAY SPIKE (ticket 25): one command to run the local visual-editor
# compatibility experiment server on http://127.0.0.1:4337.
#
#   bash .orchestrate/spike/run-local.sh          # build + seed + serve (stays in foreground)
#   RUN_STOP=1 bash .orchestrate/spike/run-local.sh   # same, but exits after readiness probe
#
# Isolation: fresh .spike-state D1/R2/KV under apps/marketing-site (gitignored),
# port 4337 only, ephemeral inspector port, telemetry disabled everywhere.
# Never reads .env files or live tokens; no remote resources are contacted.
set -euo pipefail

root="$(cd "$(dirname "$0")/../../" && pwd)"
app="$root/apps/marketing-site"
port="${VX_PORT:-4337}"
state="$app/.spike-state"

cd "$root"

# 0. Stop our previous daemon (ours only — never another worktree's server,
# esp. port 4331) before the port check, so reruns are clean.
(cd "$app" && ./node_modules/.bin/astro dev stop --config spike.config.mjs >/dev/null 2>&1 || true)
sleep 1

# 1. Port must be free (never touch 4331 or any other running server).
if ss -tlnH "sport = :$port" | grep -q .; then
  echo "port $port is already in use; refusing to start" >&2
  exit 1
fi

# 2. Fixture seed (extends the site seed with the vx pages + shared content).
node .orchestrate/spike/spike-fixture.mjs

# 3. Build once: seed-local needs dist/server/wrangler.json.
cd "$app"
ASTRO_TELEMETRY_DISABLED=1 WRANGLER_SEND_METRICS=false pnpm build >/dev/null

# 4. Fresh isolated state, then seed into it.
rm -rf "$state"
node "$root/scripts/seed-local.mjs" "$app" "$root/.orchestrate/spike/fixture/fixture.json" "$state" \
  > "$root/.orchestrate/evidence/25-seed-result.json"

# 5. workerd version skew: seed-local's wrangler writes a 3-column _cf_ALARM
# into DO metadata.sqlite; astro dev's older workerd inserts 2 values and
# crashes. The alarms table is transient scheduling data — drop and let dev
# recreate it (lesson from feat/14-layout-only, 2026-11-12).
node - "$state" <<'NODE'
import { readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
const state = process.argv[2];
const dirs = [join(state, "v3")];
for await (const walk of dirs) {
  const entries = await readdir(walk, { recursive: true, withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    if (!e.isFile() || e.name !== "metadata.sqlite") continue;
    const file = join(e.parentPath, e.name);
    const db = new DatabaseSync(file);
    try { db.exec("DROP TABLE IF EXISTS _cf_ALARM"); console.log("dropped _cf_ALARM:", file); }
    finally { db.close(); }
  }
}
NODE

# 6. Serve (astro 7 daemonizes).
cd "$app"
ASTRO_TELEMETRY_DISABLED=1 WRANGLER_SEND_METRICS=false ./node_modules/.bin/astro dev \
  --config spike.config.mjs --port "$port" --host 127.0.0.1 >/dev/null 2>&1 &
for _ in $(seq 1 90); do
  curl -sf "http://127.0.0.1:$port/sitemap.xml" >/dev/null && break
  sleep 1
done
curl -sf "http://127.0.0.1:$port/sitemap.xml" >/dev/null || { echo "server never became ready" >&2; exit 1; }
echo "READY http://127.0.0.1:$port"
echo "admin (fixture dev session): http://127.0.0.1:$port/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin"
echo "editor: http://127.0.0.1:$port/_emdash/admin/plugins/visual-editor/"
echo "stop with: cd apps/marketing-site && ./node_modules/.bin/astro dev stop --config spike.config.mjs"
