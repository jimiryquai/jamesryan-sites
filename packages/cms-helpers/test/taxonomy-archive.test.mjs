import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { mock, test } from 'node:test';
const contexts = new AsyncLocalStorage();
const session = { editMode: true, preview: { id: 'draft' } };
let found = true;
const calls = [];
mock.module('emdash', { namedExports: {
  getRequestContext: () => contexts.getStore(),
  runWithContext: (ctx, fn) => contexts.run(ctx, fn),
  decodeSlug: slug => slug,
  getTerm: async (taxonomy, slug) => found ? { slug, label: 'Experiments' } : null,
  getEmDashCollection: async (collection, options) => {
    calls.push({ collection, options, context: contexts.getStore() });
    return { entries: [{ id: 'public', data: { id: 'ULID', title: 'Published' } }], cacheHint: { tags: ['posts'] } };
  },
  getTermsForEntries: async () => new Map([['ULID', [{ slug: 'tag', label: 'Tag' }]]]),
} });
const { getTaxonomyArchive } = await import('../src/taxonomy-archive.ts');

test('missing taxonomy term returns no archive without querying posts', async () => {
  found = false;
  assert.equal(await getTaxonomyArchive('tag', 'missing'), null);
  assert.equal(calls.length, 0);
  found = true;
});
for (const taxonomy of ['category', 'tag']) {
  test(`${taxonomy} archive selects published revisions, preserves session and propagates cache hints`, async () => {
    const hints = [];
    await contexts.run(session, async () => {
      const result = await getTaxonomyArchive(taxonomy, 'experiments', { enabled: true, set: hint => hints.push(hint) });
      assert.equal(result.term.label, 'Experiments');
      assert.equal(result.posts[0].tags[0].slug, 'tag');
      assert.deepEqual(result.posts[0].bylines, []);
      assert.equal(contexts.getStore(), session);
    });
    const call = calls.at(-1);
    assert.deepEqual(call.options, { status: 'published', where: { [taxonomy]: 'experiments' }, orderBy: { published_at: 'desc' } });
    assert.equal(call.context.editMode, false);
    assert.equal(call.context.preview, undefined);
    assert.deepEqual(hints, [{ tags: ['posts'] }]);
  });
}
