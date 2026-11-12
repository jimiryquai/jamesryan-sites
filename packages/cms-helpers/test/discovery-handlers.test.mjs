import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { mock, test } from 'node:test';
const contexts = new AsyncLocalStorage();
const reads = [];
mock.module('emdash', { namedExports: {
  getRequestContext: () => contexts.getStore(),
  runWithContext: (ctx, fn) => contexts.run(ctx, fn),
  getSiteSettingsWithCacheHint: async () => ({ data: {}, cacheHint: { tags: ['settings'] } }),
  getEmDashCollection: async (collection, options) => {
    reads.push({ collection, options, context: contexts.getStore() });
    return { entries: collection === 'posts' ? [{ id: 'public', data: { title: 'Published post', updatedAt: new Date('2026-01-01'), publishedAt: new Date('2026-01-01') } }] : [], cacheHint: { tags: [collection] } };
  },
} });
const { robots, rss, schemaMap, apiCatalog } = await import('../src/discovery-handlers.ts');
const request = (hints, site = 'https://jamesryan.me///') => ({ site: site ? new URL(site) : undefined, url: new URL('http://localhost:4322/discovery'), cache: { enabled: true, set: hint => hints.push(hint) } });

test('robots publishes normalized sitemap URLs and content signals using configured site or request origin', async () => {
  for (const site of ['https://jamesryan.me///', undefined]) {
    const ctx = request([], site ?? '');
    const response = await robots(ctx);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'text/plain; charset=utf-8');
    assert.equal(response.headers.get('Content-Signal'), 'ai-train=no, search=yes, ai-input=yes');
    assert.equal(response.headers.get('Cache-Control'), 'public, max-age=3600, s-maxage=3600');
    const origin = site ? 'https://jamesryan.me' : 'http://localhost:4322';
    const body = await response.text();
    assert.ok(body.includes(`Sitemap: ${origin}/sitemap.xml`));
    assert.ok(body.includes(`Sitemap: ${origin}/schemamap.xml`));
    assert.doesNotMatch(body, /\.me\/\/|4322\/\//);
  }
});

for (const [name, handler] of [['schemaMap', schemaMap], ['apiCatalog', apiCatalog]]) {
  test(`${name} discovers only published collections, normalizes URLs and carries cache and CORS policy`, async () => {
    const hints = [];
    reads.length = 0;
    const response = await handler(request(hints));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(response.headers.get('Cache-Control'), 'public, max-age=300');
    const body = await response.text();
    assert.ok(body.includes('https://jamesryan.me/schema/posts.json'));
    assert.doesNotMatch(body, /schema\/(?:pages|projects)\.json|\.me\/\//);
    if (name === 'apiCatalog') assert.ok(body.includes('/schemamap.xml'));
    assert.deepEqual(new Set(hints.flatMap(hint => hint.tags)), new Set(['posts', 'pages', 'projects']));
    for (const read of reads) assert.equal(read.options.status, 'published');
  });
  test(`${name} suppresses revision overlays inside preview and disables shared caching`, async () => {
    const session = { editMode: true, preview: { id: 'draft' }, db: 'request database' };
    await contexts.run(session, async () => {
      const hints = [];
      reads.length = 0;
      const response = await handler(request(hints));
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
      assert.ok(hints.includes(false));
      for (const read of reads) {
        assert.equal(read.context.editMode, false);
        assert.equal(read.context.preview, undefined);
        assert.equal(read.context.db, session.db);
      }
      assert.equal(contexts.getStore(), session);
    });
  });
}

test('RSS derives unset tagline from the configured site identity', async () => {
  const response = await rss(request([], 'https://jamesryan.dev'));
  assert.match(await response.text(), /AI-native marketer &amp; engineer building intelligent marketing engines and software tools\./);
});
