import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

test('marketing seed has no retired widget dependencies', () => {
  assert.doesNotMatch(read('apps/marketing-site/seed/seed.json'), /marketing-blocks:/);
});

test('page builder owns marketing rendering and retired modules are absent', () => {
  for (const path of [
    'apps/marketing-site/src/components/blocks',
    'apps/digital-garden/src/plugins/marketing-blocks',
    'apps/digital-garden/src/styles/theme.css',
    'packages/ui/src/components/TagList.astro',
  ]) assert.equal(existsSync(new URL(path, root)), false, path);
  assert.doesNotMatch(read('packages/ui/src/index.ts'), /TagList/);
});

test('shared layout only queries the menu it renders', () => {
  const base = read('packages/ui/src/components/Base.astro');
  assert.deepEqual([...base.matchAll(/\bgetMenu(?:WithCacheHint)?\s*\(\s*['"]([^'"]+)['"]/g)].map((match) => match[1]), ['primary']);
});

test('app layouts forward only supported named slots', () => {
  const base = read('packages/ui/src/components/Base.astro');
  const supported = [...base.matchAll(/<slot\s+name="([^"]+)"/g)].map((match) => match[1]);
  for (const app of ['marketing-site', 'digital-garden']) {
    const layout = read(`apps/${app}/src/layouts/Base.astro`);
    for (const [, name] of layout.matchAll(/<slot\s+name="([^"]+)"/g)) {
      assert.ok(supported.includes(name), `${app} forwards unsupported ${name}`);
    }
    assert.match(layout, /<slot\s*\/>/);
    assert.match(layout, /<slot name="links"/);
  }
});

test('app check scripts do not invoke the retired checker', () => {
  for (const app of readdirSync(new URL('apps/', root))) {
    const pkg = JSON.parse(read(`apps/${app}/package.json`));
    assert.doesNotMatch(pkg.scripts?.check ?? '', /check-site\.js/);
  }
});

test('static asset headers do not declare rules for Worker-rendered discovery routes', () => {
  for (const app of ['marketing-site', 'digital-garden']) {
    const headers = read(`apps/${app}/public/_headers`);
    assert.doesNotMatch(headers, /^\/(?:\.well-known|schema(?:\/|map\.xml)|sitemap\.xml)/m);
    assert.match(headers, /^\/_astro\/\*$/m);
  }
});

test('app source and shared packages have no template identity remnants', () => {
  function check(directory) {
    for (const entry of readdirSync(new URL(directory, root), { withFileTypes: true })) {
      if (['node_modules', '.astro', 'dist', '.wrangler'].includes(entry.name)) continue;
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) check(path);
      else if (/\.(?:astro|[cm]?[jt]sx?|css|json)$/.test(entry.name)) {
        assert.doesNotMatch(read(path), /Oatmeal|oatmeal\.dev|My Blog/, path);
      }
    }
  }
  for (const directory of ['apps/marketing-site/src', 'apps/digital-garden/src', 'packages']) check(directory);
});
