import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addHomePostsBlock, planHomePostsBlock, HOME_POSTS_BLOCK } from './add-home-posts-block.mjs';

const hero = { _type: 'hero', _key: 'hero', _version: 1, variant: 'centered', heading: 'Hi' };

/** A fake live site serving only the pages content API, like the migration tests. */
function fakeSite({ home } = {}) {
  const item = {
    id: 'home-id', slug: 'home', status: 'published', draftRevisionId: null,
    data: structuredClone(home ?? { title: 'Home', layout: [hero] }),
  };
  const revisions = new Map([[item.id, 'rev-home-1']]);
  const store = new Map([[item.id, item]]);
  const calls = [];
  const http = async (url, options = {}) => {
    const { pathname } = new URL(url);
    const method = options.method ?? 'GET';
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ method, path: pathname, ...(body ? { body } : {}) });
    const reply = (data, status = 200) => Response.json({ success: true, data }, { status });
    if (method === 'GET' && (pathname === '/_emdash/api/content/pages/home' || pathname === '/_emdash/api/content/pages/home-id')) {
      return reply({ item: structuredClone(store.get('home-id')), _rev: revisions.get('home-id') });
    }
    if (method === 'PUT' && pathname === '/_emdash/api/content/pages/home-id') {
      if (body._rev !== revisions.get('home-id')) {
        return Response.json({ success: false, error: { code: 'CONFLICT', message: 'Page changed' } }, { status: 409 });
      }
      Object.assign(store.get('home-id').data, body.data);
      revisions.set('home-id', 'rev-home-2');
      store.get('home-id').draftRevisionId = 'rev-home-2';
      return reply({ item: structuredClone(store.get('home-id')) });
    }
    if (method === 'POST' && pathname === '/_emdash/api/content/pages/home-id/publish') {
      const stored = store.get('home-id');
      if (body._rev !== revisions.get('home-id')) {
        return Response.json({ success: false, error: { code: 'CONFLICT', message: 'Revision changed' } }, { status: 409 });
      }
      if (!stored.draftRevisionId) {
        return Response.json({ success: false, error: { code: 'CONFLICT', message: 'Nothing staged' } }, { status: 409 });
      }
      stored.draftRevisionId = null;
      return reply({ item: structuredClone(stored), _rev: revisions.get('home-id') });
    }
    return Response.json({ success: false, error: { code: 'NOT_FOUND', message: `no route ${method} ${pathname}` } }, { status: 404 });
  };
  return { store, calls, http };
}

test('plans the posts block immediately after the hero, before the blocks that follow it', () => {
  const cta = { _type: 'cta', _key: 'cta', _version: 1 };
  const plan = planHomePostsBlock({ layout: [hero, cta] });
  assert.equal(plan.action, 'add-home-posts-block');
  assert.deepEqual(plan.layout, [hero, HOME_POSTS_BLOCK, cta]);
});

test('plans the posts block at the end when home has no hero, and on an empty layout', () => {
  const cta = { _type: 'cta', _key: 'cta', _version: 1 };
  assert.deepEqual(planHomePostsBlock({ layout: [cta] }).layout, [cta, HOME_POSTS_BLOCK]);
  assert.deepEqual(planHomePostsBlock({}).layout, [HOME_POSTS_BLOCK]);
});

test('a home that already has a posts block plans nothing, whatever its variant', () => {
  assert.equal(planHomePostsBlock({ layout: [hero, HOME_POSTS_BLOCK] }).action, 'unchanged');
  assert.equal(planHomePostsBlock({ layout: [{ _type: 'posts', _key: 'p', _version: 1, variant: 'list' }] }).action, 'unchanged');
});

test('a foreign block holding the posts key stops the plan instead of colliding', () => {
  const plan = planHomePostsBlock({ layout: [hero, { _type: 'cta', _key: 'posts', _version: 1 }] });
  assert.equal(plan.action, 'stopped');
  assert.match(plan.stopReason[0], /cta.*'posts'/);
});

test('plans against the live home and writes nothing by default', async () => {
  const site = fakeSite();
  const result = await addHomePostsBlock({ site: 'http://localhost:4999', token: 'fake', http: site.http });
  assert.equal(result.page.action, 'add-home-posts-block');
  assert.equal(result.page.applied, false);
  assert.equal(result.applied, false);
  assert.equal(site.calls.filter((call) => call.method !== 'GET').length, 0);
  assert.deepEqual(result.page.moves, [{ after: 'hero', to: 'posts', key: 'posts' }]);
});

test('applies with _rev, republishes the published home, and verifies the write', async () => {
  const site = fakeSite();
  const result = await addHomePostsBlock({ site: 'http://localhost:4999', token: 'fake', apply: true, http: site.http });
  assert.equal(result.applied, true);
  assert.equal(result.page.applied, true);
  assert.equal(result.page.published, true);
  const put = site.calls.find((call) => call.method === 'PUT');
  assert.equal(put.path, '/_emdash/api/content/pages/home-id');
  assert.equal(put.body._rev, 'rev-home-1');
  assert.deepEqual(put.body.data.layout.map((block) => block._type), ['hero', 'posts']);
  assert.deepEqual(put.body.data.layout[1], HOME_POSTS_BLOCK);
  assert.equal(put.body.data.title, 'Home');
  const publish = site.calls.find((call) => call.method === 'POST');
  assert.equal(publish.body._rev, 'rev-home-2');
  assert.equal(site.store.get('home-id').status, 'published');
  assert.equal(site.store.get('home-id').draftRevisionId, null);
});

test('a draft home is written but not published', async () => {
  const site = fakeSite({ home: { title: 'Home', layout: [hero] } });
  site.store.get('home-id').status = 'draft';
  const result = await addHomePostsBlock({ site: 'http://localhost:4999', token: 'fake', apply: true, http: site.http });
  assert.equal(result.page.published, undefined);
  assert.equal(site.calls.filter((call) => call.method === 'POST').length, 0);
  assert.equal(result.page.applied, true);
});

test('a second apply run changes nothing', async () => {
  const site = fakeSite();
  await addHomePostsBlock({ site: 'http://localhost:4999', token: 'fake', apply: true, http: site.http });
  const writes = site.calls.filter((call) => call.method !== 'GET').length;
  const rerun = await addHomePostsBlock({ site: 'http://localhost:4999', token: 'fake', apply: true, http: site.http });
  assert.equal(rerun.page.action, 'unchanged');
  assert.equal(rerun.applied, false);
  assert.equal(site.calls.filter((call) => call.method !== 'GET').length, writes);
});

test('a home response without _rev refuses an unguarded write', async () => {
  const noRev = async () => Response.json({ success: true, data: { item: { id: 'home-id', slug: 'home', status: 'draft', data: { title: 'Home', layout: [hero] } } } });
  const result = await addHomePostsBlock({ site: 'http://localhost:4999', token: 'fake', apply: true, http: noRev });
  assert.equal(result.applied, false);
  assert.match(result.page.error.message, /no _rev/);
});

test('write failures shape the wire error and fail the run', async () => {
  const site = fakeSite();
  const failing = async (url, options = {}) => {
    if ((options.method ?? 'GET') === 'PUT') {
      return Response.json({ success: false, error: { code: 'CONFLICT', message: 'Page changed' } }, { status: 409 });
    }
    return site.http(url, options);
  };
  const result = await addHomePostsBlock({ site: 'http://localhost:4999', token: 'fake', apply: true, http: failing });
  assert.equal(result.applied, false);
  assert.equal(result.page.error.code, 'CONFLICT');
});

test('main prints JSON by default, a table with --table, and guards the destination', async () => {
  const { main } = await import('./add-home-posts-block.mjs');
  const site = fakeSite();
  const outputs = [];
  const json = await main(['http://localhost:4999'], { token: 'fake', http: site.http, out: (text) => outputs.push(text) });
  assert.equal(json, 0);
  assert.equal(JSON.parse(outputs[0]).page.action, 'add-home-posts-block');
  const table = await main(['http://localhost:4999', '--table'], { token: 'fake', http: site.http, out: (text) => outputs.push(text) });
  assert.equal(table, 0);
  assert.match(outputs[1], /add-home-posts-block/);
  const insecure = await main(['http://example.test'], { token: 'fake', http: async () => assert.fail('must not call out'), out: (text) => outputs.push(text) });
  assert.equal(insecure, 1);
  assert.match(outputs[2], /HTTPS/);
});
