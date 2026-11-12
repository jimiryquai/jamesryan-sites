import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const readPackage = path => JSON.parse(readFileSync(new URL(`../${path}/package.json`, import.meta.url)));

test('workspace typechecking covers every shared package and app, with garden telemetry disabled and unused dependencies removed', () => {
  const garden = readPackage('apps/digital-garden');
  for (const command of ['dev', 'build', 'typecheck']) {
    assert.match(garden.scripts[command], /^ASTRO_TELEMETRY_DISABLED=1 WRANGLER_SEND_METRICS=false /);
  }
  for (const name of ['kysely', 'ulidx']) {
    for (const dependencies of ['dependencies', 'devDependencies', 'optionalDependencies']) assert.equal(garden[dependencies]?.[name], undefined);
  }
  assert.equal(readPackage('.').scripts.typecheck, 'pnpm -r --if-present typecheck');
  for (const path of ['packages/cms-helpers', 'packages/ui', 'packages/astro-config', 'apps/marketing-site', 'apps/digital-garden']) {
    assert.ok(readPackage(path).scripts.typecheck, `${path}: missing typecheck`);
  }
});
