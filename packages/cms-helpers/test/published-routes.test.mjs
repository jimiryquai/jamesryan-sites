import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

const records = {
  pages: [{ id: 'contact', status: 'published', data: { title: 'Contact' } },
    { id: 'pricing', status: 'draft', data: { title: 'Pricing' } }],
  posts: [], projects: [],
};
mock.module('emdash', { namedExports: {
  async getEmDashCollection(collection, { status }) {
    return { entries: records[collection].filter(entry => entry.status === status), cacheHint: {} };
  },
} });
const { getPublishedRoutes } = await import('../src/published-routes.ts');

test('routes include published pages, exclude missing and draft pages, and require published projects for the listing', async () => {
  const routes = await getPublishedRoutes();
  assert.ok(routes.has('/contact'));
  assert.equal(routes.has('/pricing'), false);
  assert.equal(routes.has('/privacy-policy'), false);
  assert.equal(routes.has('/projects'), false);
  records.projects.push({ id: 'draft-project', status: 'draft', data: { title: 'Draft' } });
  assert.equal((await getPublishedRoutes()).has('/projects'), false);
  records.projects.push({ id: 'launched', status: 'published', data: { title: 'Launched' } });
  const launched = await getPublishedRoutes();
  assert.ok(launched.has('/projects'));
  assert.ok(launched.has('/projects/launched'));
  assert.equal(launched.has('/projects/draft-project'), false);
});
