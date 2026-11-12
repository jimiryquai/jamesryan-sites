import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(new URL('../apps/marketing-site/package.json', import.meta.url));
const { unstable_readConfig: readConfig } = require('wrangler');
const apps = ['marketing-site', 'digital-garden'];
const configs = apps.flatMap((app) => [undefined, 'staging'].map((env) =>
  readConfig({ config: `apps/${app}/wrangler.jsonc`, env }, { hideWarnings: true })));

test('every site and environment has isolated D1, R2 and session storage', () => {
  for (const [key, field] of [['d1_databases', 'database_id'], ['r2_buckets', 'bucket_name'], ['kv_namespaces', 'id']]) {
    const identities = configs.map((config) => {
      assert.equal(config[key].length, 1);
      const identity = config[key][0][field];
      assert.ok(identity, `${config.name}: missing ${field}`);
      return identity;
    });
    assert.equal(new Set(identities).size, 4, `${key} must be isolated`);
  }
});

test('garden uses its own worker with a staging domain and no production route', () => {
  assert.equal(configs[2].name, 'jamesryan-me');
  assert.deepEqual(configs[2].routes, []);
  assert.deepEqual(configs[3].routes, [{ pattern: 'staging.jamesryan.me', custom_domain: true }]);
});

test('Usermaven workspace key is set only in marketing-site production vars', () => {
  assert.equal(configs[0].vars?.USERMAVEN_KEY, 'UMNstP14wS');
  assert.equal(configs[1].vars?.USERMAVEN_KEY, undefined);
  assert.equal(configs[2].vars?.USERMAVEN_KEY, undefined);
  assert.equal(configs[3].vars?.USERMAVEN_KEY, undefined);
});
