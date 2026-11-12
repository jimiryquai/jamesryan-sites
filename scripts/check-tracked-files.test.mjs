import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');

const runtimeDirectoryNames = new Set(['.wrangler', '.emdash']);

export function forbiddenTrackedPaths(lsFilesOutput) {
  return String(lsFilesOutput)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.split('/').some((segment) => runtimeDirectoryNames.has(segment)));
}

const trackedRuntimePathspecs = [
  '.wrangler*',
  '**/.wrangler*',
  '.emdash*',
  '**/.emdash*',
];

test('empty git ls-files output passes the runtime-artifact guard', () => {
  assert.deepEqual(forbiddenTrackedPaths(''), []);
  assert.deepEqual(forbiddenTrackedPaths('\n'), []);
});

test('synthetic .wrangler and .emdash paths fail the runtime-artifact guard', () => {
  const output = [
    'README.md',
    '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/db.sqlite',
    'apps/marketing-site/seed/.emdash/schema.json',
    'apps/digital-garden/seed/.emdash/types.ts',
  ].join('\n');

  assert.deepEqual(forbiddenTrackedPaths(output), [
    '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/db.sqlite',
    'apps/marketing-site/seed/.emdash/schema.json',
    'apps/digital-garden/seed/.emdash/types.ts',
  ]);
});

test('git tracks no .wrangler or .emdash paths', () => {
  const output = execFileSync('git', ['ls-files', ...trackedRuntimePathspecs], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(forbiddenTrackedPaths(output).length, 0);
  assert.equal(output, '');
});
