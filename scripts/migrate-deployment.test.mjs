import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Fake only the external CLI boundary. No test can contact Cloudflare.
function migrate(app, environment, operation, fingerprint = '', lock = '') {
  const directory = mkdtempSync(join(tmpdir(), 'migration-cli-'));
  const trace = join(directory, 'trace');
  writeFileSync(join(directory, 'pnpm'), `#!/usr/bin/env node
import fs from 'node:fs';
fs.appendFileSync(process.env.TRACE, JSON.stringify(process.argv.slice(2)) + '\\n');
console.log(JSON.stringify({ target: { fingerprint: 'a'.repeat(64), accountId: 'account', resourceId: 'database' } }));
`, { mode: 0o755 });
  // An extensionless Node script needs CommonJS outside the repository.
  writeFileSync(join(directory, 'package.json'), '{"type":"module"}');
  try {
    const result = spawnSync('bash', [resolve('scripts/migrate-deployment.sh'), app, environment, operation, lock], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, TRACE: trace,
        CLOUDFLARE_ACCOUNT_ID: 'account', GITHUB_REPOSITORY: 'owner/repo', EXPECTED_TARGET_FINGERPRINT: fingerprint },
    });
    const calls = readFileSync(trace, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    return { ...result, calls };
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

test('missing fingerprint reports reviewed variable command and never applies', () => {
  for (const app of ['marketing-site', 'digital-garden']) for (const env of ['staging', 'production']) {
    const result = migrate(app, env, 'apply');
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.calls.length, 1);
    assert.ok(result.calls[0].includes('--status'));
    const variable = `${app}_${env}_MIGRATION_FINGERPRINT`.toUpperCase().replaceAll('-', '_');
    assert.ok(result.stderr.includes(`gh variable set ${variable} --repo "owner/repo" --body '${'a'.repeat(64)}'`), result.stderr);
  }
});

test('apply uses explicit account and staging target for both status and guarded mutation', () => {
  const result = migrate('marketing-site', 'staging', 'apply', 'b'.repeat(64));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.calls.length, 2);
  for (const args of result.calls) {
    assert.deepEqual(args.slice(args.indexOf('--wrangler-config'), args.indexOf('--account-id')), ['--wrangler-config', 'wrangler.jsonc']);
    assert.deepEqual(args.slice(args.indexOf('--account-id'), args.indexOf('--account-id') + 2), ['--account-id', 'account']);
    assert.ok(args.includes('--wrangler-env'));
  }
  assert.ok(result.calls[1].includes('--expected-target-fingerprint'));
  assert.ok(result.calls[1].includes('b'.repeat(64)));
});

test('status is read-only without a fingerprint and recovery passes exact lock id', () => {
  const status = migrate('digital-garden', 'production', 'status');
  assert.equal(status.status, 0, status.stderr);
  assert.equal(status.calls.length, 1);
  assert.ok(!status.calls[0].includes('--wrangler-env'));
  const recovery = migrate('digital-garden', 'production', 'recover', 'a'.repeat(64), '1794219515159');
  assert.equal(recovery.status, 0, recovery.stderr);
  assert.deepEqual(recovery.calls[1].slice(-4), ['--take-over-lock', '1794219515159', '--expected-target-fingerprint', 'a'.repeat(64)]);
});
